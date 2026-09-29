import CoreML
import ExpoModulesCore
import UIKit

public final class RevelaVisionModule: Module {
  public func definition() -> ModuleDefinition {
    Name("RevelaVision")

    AsyncFunction("predict") { (uri: String) throws -> [Double] in
      try self.predict(uri: uri)
    }
  }

  private func predict(uri: String) throws -> [Double] {
    guard let image = loadImage(uri: uri), let cgImage = image.cgImage else {
      throw VisionError.invalidImage
    }

    let modelURL = Bundle(for: RevelaVisionModule.self).url(
      forResource: "skin_model",
      withExtension: "mlmodelc"
    ) ?? Bundle.main.url(forResource: "skin_model", withExtension: "mlmodelc")

    guard let modelURL else {
      throw VisionError.modelNotFound
    }

    let model = try MLModel(contentsOf: modelURL)
    guard let imageInput = model.modelDescription.inputDescriptionsByName.first(where: {
      $0.value.type == .image
    })?.key else {
      throw VisionError.inputNotFound
    }

    let pixelBuffer = try makePixelBuffer(from: cgImage, width: 224, height: 224)
    let input = try MLDictionaryFeatureProvider(dictionary: [
      imageInput: MLFeatureValue(pixelBuffer: pixelBuffer)
    ])
    let output = try model.prediction(from: input)

    guard let outputName = output.featureNames.first,
          let probabilities = output.featureValue(for: outputName)?.multiArrayValue else {
      throw VisionError.outputNotFound
    }

    return (0..<probabilities.count).map { index in
      min(max(probabilities[index].doubleValue, 0), 1)
    }
  }

  private func loadImage(uri: String) -> UIImage? {
    if let url = URL(string: uri), url.isFileURL {
      return UIImage(contentsOfFile: url.path)
    }
    return UIImage(contentsOfFile: uri)
  }

  private func makePixelBuffer(from image: CGImage, width: Int, height: Int) throws -> CVPixelBuffer {
    var pixelBuffer: CVPixelBuffer?
    let attributes = [
      kCVPixelBufferCGImageCompatibilityKey: true,
      kCVPixelBufferCGBitmapContextCompatibilityKey: true,
    ] as CFDictionary

    let status = CVPixelBufferCreate(
      kCFAllocatorDefault,
      width,
      height,
      kCVPixelFormatType_32BGRA,
      attributes,
      &pixelBuffer
    )
    guard status == kCVReturnSuccess, let pixelBuffer else {
      throw VisionError.pixelBufferCreationFailed
    }

    CVPixelBufferLockBaseAddress(pixelBuffer, [])
    defer { CVPixelBufferUnlockBaseAddress(pixelBuffer, []) }

    guard let baseAddress = CVPixelBufferGetBaseAddress(pixelBuffer),
          let context = CGContext(
            data: baseAddress,
            width: width,
            height: height,
            bitsPerComponent: 8,
            bytesPerRow: CVPixelBufferGetBytesPerRow(pixelBuffer),
            space: CGColorSpaceCreateDeviceRGB(),
            bitmapInfo: CGImageAlphaInfo.premultipliedFirst.rawValue
              | CGBitmapInfo.byteOrder32Little.rawValue
          ) else {
      throw VisionError.pixelBufferCreationFailed
    }

    context.draw(image, in: CGRect(x: 0, y: 0, width: width, height: height))
    return pixelBuffer
  }
}

private enum VisionError: Error {
  case invalidImage
  case modelNotFound
  case inputNotFound
  case outputNotFound
  case pixelBufferCreationFailed
}
