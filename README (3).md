# Hướng dẫn tích hợp Model nhận diện ngôn ngữ ký hiệu trên Web (JavaScript)

## Các file trong bộ export

| File                                      | Phân loại                | Mô tả                                                                                                                                                   |
| ----------------------------------------- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tcn_20260624_232642.tflite`              | **Bắt buộc trên Web**    | Model AI đã tối ưu hóa sang định dạng TensorFlow Lite (bộ não nhận diện chạy offline).                                                                  |
| `tcn_20260624_232642_display_labels.json` | **Bắt buộc trên Web**    | Bảng ánh xạ từ index lớp sang tiếng Việt hiển thị (ví dụ: `{ "0": "rang muối", "1": "tôm", ... }`).                                                     |
| `tcn_20260624_232642.json`                | _Chỉ dùng ở Backend/Dev_ | Cấu hình model chi tiết và ánh xạ nhãn kỹ thuật gốc. Được dùng bởi script Python để sinh ra file display labels ở trên, không cần đưa lên web frontend. |

---

## Thông số kỹ thuật

| Thông số                  | Giá trị                                               |
| ------------------------- | ----------------------------------------------------- |
| **Số từ vựng**            | 42 lớp                                                |
| **Input [0] — `inputs`**  | shape `[1, 60, 126]`, dtype `float32`                 |
| **Input [1] — `lengths`** | shape `[1]`, dtype `int32`                            |
| **Output — `logits`**     | shape `[1, 42]`, dtype `float32`                      |
| **Feature**               | MediaPipe Hands: **2 tay × 21 điểm × 3 tọa độ = 126** |
| **Buffer**                | Tích lũy **60 frame liên tiếp** mới dự đoán 1 lần     |

---

## Luồng hoạt động tổng quan

```
Webcam (trình duyệt)
   → MediaPipe Hands (JS)
   → Mỗi frame: [left_hand(63) + right_hand(63)] = vector 126 float32
   → Buffer tích lũy đủ 60 frame
   → TFLite Runtime (JS) nhận tensor [1, 60, 126]
   → Output [1, 42] → argmax → class_index (VD: 0)
   → Tra display_labels.json → "rang muối"
   → Hiển thị lên màn hình
```

> **Model chạy hoàn toàn trên trình duyệt của người dùng** (client-side).  
> Không cần gửi dữ liệu lên server, không cần backend AI.

---

## Bước 1: Cài thư viện cần thiết

Thêm vào `<head>` của HTML:

```html
<!-- MediaPipe Hands -->
<script src="https://cdn.jsdelivr.net/npm/@mediapipe/hands/hands.js"></script>
<script src="https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js"></script>

<!-- TensorFlow.js + TFLite Runtime -->
<script src="https://cdn.jsdelivr.net/npm/@tensorflow/tfjs"></script>
<script src="https://cdn.jsdelivr.net/npm/@tensorflow/tfjs-tflite/dist/tf-tflite.min.js"></script>
```

---

## Bước 2: Đặt 2 file cần thiết lên server

Chỉ cần copy **2 file bắt buộc** vào thư mục tĩnh (static) của web server:

```
/public
  ├── tcn_20260624_232642.tflite
  └── tcn_20260624_232642_display_labels.json
```

> 💡 **Lưu ý:** File cấu hình `tcn_20260624_232642.json` chứa thông tin cấu hình huấn luyện chi tiết của mô hình, được dùng ở bước chuẩn bị và không cần thiết cho quá trình chạy inference trên trình duyệt.
>
> Khi người dùng truy cập trang Web, trình duyệt sẽ tự động tải 2 file này về máy để chạy inference trực tiếp hoàn toàn offline.

---

## Bước 3: Load bảng nhãn (1 dòng)

File `display_labels.json` đã được chuẩn bị sẵn, không cần parse gì thêm:

```javascript
// { "0": "rang muối", "1": "tôm", "2": "lột da cá", ... }
const displayLabels = await fetch(
  "tcn_20260624_232642_display_labels.json",
).then((r) => r.json());

// Dùng:
const name = displayLabels[classIndex]; // "rang muối"
```

---

## Bước 4: Load TFLite model

```javascript
tflite.setWasmPath(
  "https://cdn.jsdelivr.net/npm/@tensorflow/tfjs-tflite/wasm/",
);

const tfliteModel = await tflite.loadTFLiteModel("tcn_20260624_232642.tflite");

console.log("Model loaded!");
```

---

## Bước 5: Trích xuất đặc trưng từ MediaPipe Hands

```javascript
const hands = new Hands({
  locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
});

hands.setOptions({
  maxNumHands: 2,
  modelComplexity: 1,
  minDetectionConfidence: 0.5,
  minTrackingConfidence: 0.5,
});

/**
 * Trích xuất vector 126 chiều từ kết quả MediaPipe.
 * Thứ tự BẮT BUỘC: [tay trái (63 số)] + [tay phải (63 số)]
 * Nếu không phát hiện thấy bàn tay → điền zeros.
 */
function extractFeatures(results) {
  const left = new Float32Array(63).fill(0); // 21 điểm × 3
  const right = new Float32Array(63).fill(0);

  if (results.multiHandLandmarks && results.multiHandedness) {
    for (let i = 0; i < results.multiHandLandmarks.length; i++) {
      const landmarks = results.multiHandLandmarks[i];
      const label = results.multiHandedness[i].label; // "Left" hoặc "Right"
      const target = label === "Left" ? left : right;

      for (let j = 0; j < landmarks.length; j++) {
        target[j * 3] = landmarks[j].x;
        target[j * 3 + 1] = landmarks[j].y;
        target[j * 3 + 2] = landmarks[j].z;
      }
    }
  }

  const combined = new Float32Array(126);
  combined.set(left, 0);
  combined.set(right, 63);
  return combined;
}
```

---

## Bước 6: Chạy inference

```javascript
const BUFFER_SIZE = 60;
const FEATURE_DIM = 126;
const frameBuffer = [];

async function runInference() {
  if (frameBuffer.length < BUFFER_SIZE) return null;

  const flat = new Float32Array(BUFFER_SIZE * FEATURE_DIM);
  for (let i = 0; i < BUFFER_SIZE; i++) {
    flat.set(frameBuffer[i], i * FEATURE_DIM);
  }

  const inputTensor = tf.tensor3d(flat, [1, BUFFER_SIZE, FEATURE_DIM]);
  const lengthTensor = tf.tensor1d([BUFFER_SIZE], "int32");

  const outputTensor = tfliteModel.predict({
    inputs: inputTensor,
    lengths: lengthTensor,
  });

  const logits = await outputTensor.data(); // Float32Array(42)
  const classIndex = logits.indexOf(Math.max(...logits));

  inputTensor.dispose();
  lengthTensor.dispose();
  outputTensor.dispose();

  return classIndex;
}
```

---

## Bước 7: Vòng lặp Camera + Hiển thị kết quả

```javascript
const camera = new Camera(videoElement, {
  onFrame: async () => {
    await hands.send({ image: videoElement });
  },
  width: 640,
  height: 480,
});

hands.onResults(async (results) => {
  const feat = extractFeatures(results);
  frameBuffer.push(feat);
  if (frameBuffer.length > BUFFER_SIZE) frameBuffer.shift();

  const classIndex = await runInference();
  if (classIndex !== null) {
    document.getElementById("result").textContent = displayLabels[classIndex];
  }
});

camera.start();
```

---

## Lưu ý quan trọng

> ⚠️ **Thứ tự tay:** Luôn đặt **tay trái trước (0–62)**, tay phải sau (63–125).  
> MediaPipe Hands JS trả về nhãn "Left"/"Right" từ góc nhìn camera đã được mirror sẵn.

> ⚠️ **CORS:** File `.tflite` phải được serve từ HTTP server.  
> Không thể mở trực tiếp bằng `file://`. Dùng `npx serve .` để test local.

> ⚠️ **Sliding window:** Không nên xóa trắng buffer sau mỗi lần predict.  
> Giữ nguyên buffer và chỉ pop frame cũ nhất (`shift`) để kết quả mượt hơn.

---

## Bảng 42 từ vựng

| Index | Tên tiếng Việt | Label Key             |
| ----- | -------------- | --------------------- |
| 0     | rang muối      | vn/hoa-de/rang-muoi   |
| 1     | tôm            | vn/hoa-de/tom         |
| 2     | lột da cá      | vn/hoa-de/lot-da-ca   |
| 3     | lột vỏ tôm     | vn/hoa-de/lot-vo-tom  |
| 4     | lấy chỉ tôm    | vn/hoa-de/lay-chi-tom |
| 5     | Cắt kỳ         | vn/hoa-de/cat-ky      |
| 6     | D              | vn/bang-chu-cai/d     |
| 7     | E              | vn/bang-chu-cai/e     |
| 8     | M              | vn/bang-chu-cai/m     |
| 9     | N              | vn/bang-chu-cai/n     |
| 10    | O              | vn/bang-chu-cai/o     |
| 11    | P              | vn/bang-chu-cai/p     |
| 12    | Q              | vn/bang-chu-cai/q     |
| 13    | R              | vn/bang-chu-cai/r     |
| 14    | S              | vn/bang-chu-cai/s     |
| 15    | T              | vn/bang-chu-cai/t     |
| 16    | U              | vn/bang-chu-cai/u     |
| 17    | V              | vn/bang-chu-cai/v     |
| 18    | đánh vẩy cá    | vn/hoa-de/danh-vay-ca |
| 19    | A              | vn/bang-chu-cai/a     |
| 20    | B              | vn/bang-chu-cai/b     |
| 21    | C              | vn/bang-chu-cai/c     |
| 22    | G              | vn/bang-chu-cai/g     |
| 23    | H              | vn/bang-chu-cai/h     |
| 24    | I              | vn/bang-chu-cai/i     |
| 25    | K              | vn/bang-chu-cai/k     |
| 26    | L              | vn/bang-chu-cai/l     |
| 27    | X              | vn/bang-chu-cai/x     |
| 28    | Y              | vn/bang-chu-cai/y     |
| 29    | cắt đầu cá     | vn/hoa-de/cat-dau-ca  |
| 30    | Miến Điện      | vn/trung/mien-dien    |
| 31    | Z              | vn/bang-chu-cai/z     |
| 32    | nhân viên      | vn/can-tho/nhan-vien  |
| 33    | máy khoan      | vn/can-tho/may-khoan  |
| 34    | khoan          | vn/can-tho/khoan      |
| 35    | đồ đạc         | vn/can-tho/do-dac     |
| 36    | cà phê         | vn/can-tho/ca-phe     |
| 37    | chào cờ        | vn/can-tho/chao-co    |
| 38    | phục vụ        | vn/can-tho/phuc-vu    |
| 39    | vào lớp        | vn/can-tho/vao-lop    |
| 40    | nặn mụn        | vn/spa/nan-mun        |
| 41    | úp móng        | vn/spa/up-mong        |

---

> Được tạo tự động từ dự án VOYA-Collector.  
> Ngày Train: 2026-06-24 | Train: 463 mẫu | Val: 100 | Test: 85
