# Điều tra lỗi camera alphabet — camera v2

Người dùng báo A/O/C/S/X không nhận, Y→I, M→N, O→T, C→T. Chưa có mẫu landmark/video thực của các lần sai này nên **chưa xác định nguyên nhân của từng cặp và chưa tuyên bố sửa xong accuracy**. Parity trước đây đo cùng tensor, không kiểm chứng toàn bộ camera.

## Những khác biệt đã xác nhận và sửa

1. `extract126` tin handedness từng frame: đổi nhãn Left/Right làm cùng tay chuyển block; hai detection cùng nhãn ghi đè một tay. Collector dùng `frontend/src/utils/handIdentity.ts` để giữ slot bằng wrist và timestamp. Alphabet v2 gửi danh sách detection đầy đủ, port đúng resolver, xuất ngược về MP slots để Kotlin vẫn swap đúng một lần. Không mirror tọa độ, không đổi model/nhãn/normalization. Kiểm thử tình huống đổi nhãn, collision và 1.000 chuỗi thay đổi đều đạt. Điều này xác nhận lỗi cấu trúc đầu vào, chưa xác nhận nó gây các cặp sai người dùng báo.
2. Khi dự đoán mới thấp confidence, UI trước đó vẫn giữ ký tự lớn của lần cũ. Giờ xóa ký tự cũ khi confidence thấp hoặc đang chờ xác nhận nhãn mới. Giữ threshold 0.65 và hai lần xác nhận; không remap/hard-code ký tự.
3. Collector realtime xóa buffer khi không có tay; app trước giữ gesture cũ và zeros. Giờ explicit empty detection reset window và hủy kết quả cũ. Sampler vẫn đánh dấu callback bị thiếu bằng zero; tác động của chính sách này cần đo trên điện thoại trước khi đổi.

## Cần dữ liệu thực để kiểm tra tiếp

- Camera Android xoay bitmap theo sensor và dùng màn hình portrait. Collector capture yêu cầu 1280×720, tọa độ MediaPipe chuẩn hóa theo chiều rộng/cao riêng. Chưa có input thực để xác định tỷ lệ hình gây bao nhiêu sai số. Bản này ghi imageWidth/imageHeight; chưa áp dụng phép scale phỏng đoán.
- Collector ghi nhận corpus lịch sử trộn mirror conventions; serving hiện dùng `MIRROR_SERVING_PAYLOAD=false`. Không có test corpus đúng checkpoint để đổi mirror/swap dựa trên accuracy. Giữ orientation đã xác minh, script replay có thí nghiệm độc lập và không tự chọn theo confidence.
- Detector có thể trả callback chậm hoặc mất hand; JSON ghi timestamp, detections trước ổn định slot, raw frame và chính xác 60 frame đưa vào inference.

## Cách thu mẫu lỗi

1. Cài `alphabet-camera-v2-arm.apk` trong thư mục báo cáo này. Mở alphabet và **Ghi mẫu nhận diện sai**.
2. Nhập ký tự thực sự đang làm (A, O, C, S, X, Y, M…), giữ ký hiệu 3 giây rồi bấm **Ghi mẫu**. Lặp lại 2–3 lần mỗi ký tự, cả lần đúng và sai nếu có. Tối đa 30 mẫu mỗi file.
3. Bấm **Lưu JSON**, chọn/tạo thư mục được Android cho phép, lưu trước khi rời alphabet. Gửi file `alphabet-errors-….json`. Dữ liệu không tự gửi đi; không thu ảnh/video.
4. Đặt JSON nhận được vào `reports/alphabet/camera_samples/`, rồi chạy:

```powershell
.alphabet-tools/python/python.exe scripts/alphabet/replay_camera.py --input reports/alphabet/camera_samples/alphabet-errors.json --output reports/alphabet/camera_samples/replay.json
```

Script kiểm tra model hash và nhãn, chạy exact tensor qua .pt/TFLite, đối chiếu logits Android đã lưu, xuất top5, accuracy trên các clip gửi, zero count, FPS callback, kích thước ảnh và thử riêng mirror/swap. Accuracy của tập mẫu lỗi được chọn không phải accuracy tổng quát. Không convert/retrain và không cài dependency mới.

## Artifact và kiểm tra

- APK ARM64/ARM32: `alphabet-camera-v2-arm.apk`, SHA256 `d9a1ad29eb4835d29c301546ac64d6ea491d955f7a52f821c748b46f887e0313`.
- Model giữ `bigru_attention_alphabet_20260818_114440_colab_524c028a_fp32`, SHA256 `524c028ac9861d5c1d82bcedd2e1f92dc45f342ef97e775409fcaf393075d13c`.
- 11 Node tests đạt, gồm 8 sampling/word regression và 3 camera identity tests. TypeScript và ESLint phần sửa đạt.
- Debug + androidTest x86 build thành công; chạy lại trên emulator-5554: **OK (3 tests)**, gồm golden raw/preprocessed→logits và labels. Đây không phải kiểm thử nhận diện camera/UX ghi JSON trên điện thoại.
- Release build thành công; `verify_apk.py` xác nhận tất cả model/labels khớp workspace, gồm word. Source map xác nhận bốn source mới/sửa được bundle đúng vào APK.
- Script replay chạy smoke test với golden fixture, parity .pt/TFLite và logits fixture đạt. `replay-synthetic-smoke.json` là **fixture tổng hợp**, không phải mẫu camera người dùng.
- Bản APK trước sửa được giữ tại `before-camera-fix.apk`.

## File thay đổi trong lần này

`HandLandmarksModule.kt` thêm metadata/detections alphabet và trả logits alphabet; `AlphabetMode.tsx`; thêm `AlphabetDiagnostics.tsx`, `alphabetHandIdentity.ts`, `alphabetCamera.ts`, `test_camera.cjs`, `replay_camera.py`. Manifest triển khai ghi rõ chính sách camera v2. WordMode, đường predict word, word event/throttle, model/label assets và registry giữ nguyên.
