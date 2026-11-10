package expo.modules.revelavision

import ai.onnxruntime.OnnxTensor
import ai.onnxruntime.OrtEnvironment
import ai.onnxruntime.OrtSession
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Matrix
import android.net.Uri
import androidx.exifinterface.media.ExifInterface
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.nio.FloatBuffer

private const val MODEL_ASSET = "skin_model.onnx"
private const val INPUT_SIZE = 224

// Android counterpart of the Core ML module in ios/. The graph takes raw RGB
// pixels (0-255, NCHW) and returns one sigmoid score per class, in the order
// listed in assets/models/skin_model.json.
class RevelaVisionModule : Module() {
  private val environment: OrtEnvironment by lazy { OrtEnvironment.getEnvironment() }

  private val session: OrtSession by lazy {
    val context = appContext.reactContext ?: throw ModelUnavailable("React context is not available")
    val bytes = try {
      context.assets.open(MODEL_ASSET).use { it.readBytes() }
    } catch (e: Exception) {
      throw ModelUnavailable("$MODEL_ASSET is missing from the app assets")
    }
    environment.createSession(bytes, OrtSession.SessionOptions())
  }

  override fun definition() = ModuleDefinition {
    Name("RevelaVision")

    AsyncFunction("predict") { uri: String -> predict(uri) }
  }

  private fun predict(uri: String): List<Double> {
    val bitmap = loadBitmap(uri) ?: throw InvalidImage(uri)
    val scaled = Bitmap.createScaledBitmap(bitmap, INPUT_SIZE, INPUT_SIZE, true)

    val pixels = IntArray(INPUT_SIZE * INPUT_SIZE)
    scaled.getPixels(pixels, 0, INPUT_SIZE, 0, 0, INPUT_SIZE, INPUT_SIZE)
    val plane = INPUT_SIZE * INPUT_SIZE
    val data = FloatArray(3 * plane)
    for (i in pixels.indices) {
      val p = pixels[i]
      data[i] = ((p shr 16) and 0xFF).toFloat() // R
      data[plane + i] = ((p shr 8) and 0xFF).toFloat() // G
      data[2 * plane + i] = (p and 0xFF).toFloat() // B
    }

    OnnxTensor.createTensor(environment, FloatBuffer.wrap(data), longArrayOf(1, 3, INPUT_SIZE.toLong(), INPUT_SIZE.toLong())).use { input ->
      session.run(mapOf(session.inputNames.first() to input)).use { result ->
        @Suppress("UNCHECKED_CAST")
        val scores = (result[0].value as Array<FloatArray>)[0]
        return scores.map { it.toDouble().coerceIn(0.0, 1.0) }
      }
    }
  }

  private fun loadBitmap(uri: String): Bitmap? {
    val parsed = Uri.parse(uri)
    val path = if (parsed.scheme == "file") parsed.path else if (parsed.scheme == null) uri else null
    val resolver = appContext.reactContext?.contentResolver

    val decoded = if (path != null) {
      BitmapFactory.decodeFile(path)
    } else {
      resolver?.openInputStream(parsed)?.use { BitmapFactory.decodeStream(it) }
    } ?: return null

    // BitmapFactory ignores EXIF rotation; UIImage on iOS applies it, so do the same.
    val orientation = try {
      if (path != null) {
        ExifInterface(path).getAttributeInt(ExifInterface.TAG_ORIENTATION, ExifInterface.ORIENTATION_NORMAL)
      } else {
        resolver?.openInputStream(parsed)?.use { ExifInterface(it).getAttributeInt(ExifInterface.TAG_ORIENTATION, ExifInterface.ORIENTATION_NORMAL) }
          ?: ExifInterface.ORIENTATION_NORMAL
      }
    } catch (e: Exception) {
      ExifInterface.ORIENTATION_NORMAL
    }

    val matrix = Matrix()
    when (orientation) {
      ExifInterface.ORIENTATION_ROTATE_90 -> matrix.postRotate(90f)
      ExifInterface.ORIENTATION_ROTATE_180 -> matrix.postRotate(180f)
      ExifInterface.ORIENTATION_ROTATE_270 -> matrix.postRotate(270f)
      ExifInterface.ORIENTATION_FLIP_HORIZONTAL -> matrix.postScale(-1f, 1f)
      ExifInterface.ORIENTATION_FLIP_VERTICAL -> matrix.postScale(1f, -1f)
      ExifInterface.ORIENTATION_TRANSPOSE -> { matrix.postRotate(90f); matrix.postScale(-1f, 1f) }
      ExifInterface.ORIENTATION_TRANSVERSE -> { matrix.postRotate(270f); matrix.postScale(-1f, 1f) }
      else -> return decoded
    }
    return Bitmap.createBitmap(decoded, 0, 0, decoded.width, decoded.height, matrix, true)
  }
}

private class InvalidImage(uri: String) : CodedException("ERR_INVALID_IMAGE", "Could not read image at $uri", null)
private class ModelUnavailable(message: String) : CodedException("ERR_MODEL_NOT_FOUND", message, null)
