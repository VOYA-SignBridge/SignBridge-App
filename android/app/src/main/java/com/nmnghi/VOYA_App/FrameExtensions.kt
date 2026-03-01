package com.nmnghi.VOYA_App

import android.graphics.Bitmap
import android.graphics.Matrix
import androidx.camera.core.ImageProxy
import com.google.mediapipe.framework.image.BitmapImageBuilder
import com.google.mediapipe.framework.image.MPImage

// Chuyển ImageProxy (YUV) → MPImage (RGB) + tự xoay theo rotation của camera
fun ImageProxy.toMPImage(): MPImage {
    val bitmap = this.toBitmapWithRotation()
    return BitmapImageBuilder(bitmap).build()
}

private fun ImageProxy.toBitmapWithRotation(): Bitmap {
    val yBuffer = planes[0].buffer
    val uBuffer = planes[1].buffer
    val vBuffer = planes[2].buffer

    val ySize = yBuffer.remaining()
    val uSize = uBuffer.remaining()
    val vSize = vBuffer.remaining()

    val nv21 = ByteArray(ySize + uSize + vSize)

    // copy Y, V, U vào mảng NV21
    yBuffer.get(nv21, 0, ySize)
    vBuffer.get(nv21, ySize, vSize)
    uBuffer.get(nv21, ySize + vSize, uSize)

    val argb = IntArray(width * height)
    decodeYUV420SP(argb, nv21, width, height)

    var bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
    bitmap.setPixels(argb, 0, width, 0, 0, width, height)

    // Xoay bitmap theo rotation của camera (0 / 90 / 180 / 270)
    val rotation = imageInfo.rotationDegrees
    if (rotation != 0) {
        val matrix = Matrix()
        matrix.postRotate(rotation.toFloat())
        bitmap = Bitmap.createBitmap(
            bitmap, 0, 0,
            bitmap.width, bitmap.height,
            matrix, true
        )
    }

    return bitmap
}

// Chuyển NV21 (YUV420) → RGB
private fun decodeYUV420SP(
    rgb: IntArray,
    yuv420sp: ByteArray,
    width: Int,
    height: Int
) {
    val frameSize = width * height
    var j = 0
    var yp = 0

    while (j < height) {
        var uvp = frameSize + (j shr 1) * width
        var u = 0
        var v = 0

        var i = 0
        while (i < width) {
            val y = (0xff and yuv420sp[yp].toInt()) - 16
            if (y < 0) {
                rgb[yp] = 0xff000000.toInt()
            } else {
                if (i and 1 == 0) {
                    v = (0xff and yuv420sp[uvp++].toInt()) - 128
                    u = (0xff and yuv420sp[uvp++].toInt()) - 128
                }

                val y1192 = 1192 * y
                var r = y1192 + 1634 * v
                var g = y1192 - 833 * v - 400 * u
                var b = y1192 + 2066 * u

                if (r < 0) r = 0 else if (r > 262143) r = 262143
                if (g < 0) g = 0 else if (g > 262143) g = 262143
                if (b < 0) b = 0 else if (b > 262143) b = 262143

                rgb[yp] = 0xff000000.toInt() or
                        ((r shl 6) and 0xff0000) or
                        ((g shr 2) and 0xff00) or
                        ((b shr 10) and 0xff)
            }
            i++
            yp++
        }
        j++
    }
}
