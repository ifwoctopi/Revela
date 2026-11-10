"""Converts the Core ML skin model (MobileNetV2-style, torch -> coremltools neural network)
to ONNX so the same weights can run on Android.

coremltools can read the model spec on any OS but cannot export ONNX, so this walks the
spec's layers and emits the equivalent ONNX nodes. Only the layer kinds the model uses
are supported; anything else fails loudly.

Usage (repo root):
    pip install coremltools onnx onnxruntime numpy torch
    python tools/skin-model/convert_coreml_to_onnx.py

The ONNX input is raw RGB pixels, NCHW float32, range 0-255, 224x224. The Core ML
preprocessing (scale by 1/255, mean/std normalisation) is baked into the graph.
Output "probabilities" is shape [1, 5], one sigmoid score per class (multi-label).
"""

import json
import sys
from pathlib import Path

import numpy as np
import onnx
from onnx import TensorProto, helper, numpy_helper
import coremltools as ct

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "mobile/modules/revela-vision/ios/skin_model.mlmodel"
DST = ROOT / "mobile/assets/models/skin_model.onnx"
SIZE = 224


def build(spec):
    nn = spec.neuralNetwork
    image_input = spec.description.input[0].name
    scale = nn.preprocessing[0].scaler.channelScale if nn.preprocessing else 1.0
    inits, nodes = [], []

    def const(name, array):
        inits.append(numpy_helper.from_array(np.asarray(array, dtype=np.float32), name))
        return name

    def node(op, ins, out, **attrs):
        nodes.append(helper.make_node(op, ins, [out], name=f"{out}_{op}", **attrs))

    # Core ML applies channelScale to the image before the first layer.
    node("Mul", [image_input, const("pre_scale", [scale])], "pre_scaled")
    rename = {image_input: "pre_scaled"}
    r = lambda n: rename.get(n, n)

    for layer in nn.layers:
        kind = layer.WhichOneof("layer")
        d = getattr(layer, kind)
        ins = [r(i) for i in layer.input]
        out = layer.output[0]

        if kind == "loadConstantND":
            inits.append(numpy_helper.from_array(
                np.array(d.data.floatValue, dtype=np.float32).reshape(list(d.shape)), out))
        elif kind == "activation":
            which = d.WhichOneof("NonlinearityType")
            if which == "linear":
                a, b = d.linear.alpha, d.linear.beta
                scaled = f"{out}_a" if b else out
                node("Mul", [ins[0], const(f"{out}_alpha", [a])], scaled)
                if b:
                    node("Add", [scaled, const(f"{out}_beta", [b])], out)
            elif which == "sigmoid":
                node("Sigmoid", ins, out)
            else:
                sys.exit(f"unsupported activation: {which}")
        elif kind == "add":
            if len(ins) == 1:
                node("Add", [ins[0], const(f"{out}_alpha", [d.alpha])], out)
            else:
                node("Add", ins, out)
        elif kind == "multiply":
            if len(ins) == 1:
                node("Mul", [ins[0], const(f"{out}_alpha", [d.alpha])], out)
            else:
                node("Mul", ins, out)
        elif kind == "clip":
            node("Clip", [ins[0], const(f"{out}_min", [d.minVal]), const(f"{out}_max", [d.maxVal])], out)
        elif kind == "convolution":
            if d.isDeconvolution or list(d.dilationFactor) not in ([], [1, 1]):
                sys.exit(f"unsupported convolution in {layer.name}")
            kh, kw = d.kernelSize
            weights = np.array(d.weights.floatValue, dtype=np.float32).reshape(
                d.outputChannels, d.kernelChannels, kh, kw)
            pad_type = d.WhichOneof("ConvolutionPaddingType")
            if pad_type == "valid":
                b = d.valid.paddingAmounts.borderAmounts
                pads = [b[0].startEdgeSize, b[1].startEdgeSize, b[0].endEdgeSize, b[1].endEdgeSize] if len(b) == 2 else [0, 0, 0, 0]
            elif pad_type == "same":
                sys.exit(f"'same' padding not expected in {layer.name}")
            else:
                sys.exit(f"unsupported padding {pad_type}")
            args = [ins[0], const(f"{out}_w", weights)]
            if d.hasBias:
                args.append(const(f"{out}_b", np.array(d.bias.floatValue, dtype=np.float32)))
            node("Conv", args, out, kernel_shape=[kh, kw], strides=list(d.stride) or [1, 1],
                 pads=pads, group=d.nGroups or 1)
        elif kind == "pooling":
            if d.type != 1 or not d.globalPooling:  # 1 = AVERAGE
                sys.exit(f"unsupported pooling in {layer.name}")
            node("GlobalAveragePool", ins, out)
        elif kind == "reshapeStatic":
            node("Reshape", [ins[0], const_i64(inits, f"{out}_shape", list(d.targetShape))], out)
        elif kind == "innerProduct":
            weights = np.array(d.weights.floatValue, dtype=np.float32).reshape(d.outputChannels, d.inputChannels)
            args = [ins[0], const(f"{out}_w", weights)]
            if d.hasBias:
                args.append(const(f"{out}_b", np.array(d.bias.floatValue, dtype=np.float32)))
            node("Gemm", args, out, transB=1)
        else:
            sys.exit(f"unsupported layer {kind} ({layer.name})")

    output = spec.description.output[0].name
    graph = helper.make_graph(
        nodes, "skin_model",
        [helper.make_tensor_value_info(image_input, TensorProto.FLOAT, [1, 3, SIZE, SIZE])],
        [helper.make_tensor_value_info(output, TensorProto.FLOAT, [1, len(json.loads(spec.description.metadata.userDefined["classes"]))])],
        initializer=inits,
    )
    model = helper.make_model(graph, opset_imports=[helper.make_opsetid("", 13)])
    model.ir_version = 8
    onnx.checker.check_model(model)
    return model


def const_i64(inits, name, values):
    inits.append(numpy_helper.from_array(np.asarray(values, dtype=np.int64), name))
    return name


def main():
    spec = ct.models.MLModel(str(SRC), skip_model_load=True).get_spec()
    model = build(spec)
    DST.parent.mkdir(parents=True, exist_ok=True)
    onnx.save(model, DST)
    meta = dict(spec.description.metadata.userDefined)
    (DST.parent / "skin_model.json").write_text(json.dumps({
        "classes": json.loads(meta["classes"]),
        "inputSize": SIZE,
        "threshold": float(meta["threshold"]),
        "input": "RGB, NCHW float32, 0-255 (normalisation is inside the graph)",
    }, indent=2) + "\n")
    print(f"wrote {DST} ({DST.stat().st_size / 1e6:.1f} MB)")


if __name__ == "__main__":
    main()
