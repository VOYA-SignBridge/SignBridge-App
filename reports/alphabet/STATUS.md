# Trạng thái hiện tại — 2026-09-13

Active alphabet hiện là bản thử **`model.tflite`**. Đã sửa hash, tensor names, model không-signature và output probabilities; APK ở **camera_diagnosis/alphabet-model-trial-arm.apk**. Android `OK (4 tests)` và release build đạt. Xem **camera_diagnosis/MODEL_TRIAL.md**. Chưa có checkpoint/validation/preprocessing metadata của model mới nên chưa thể kết luận accuracy.

Bản vá mới nhất: **camera_diagnosis/alphabet-camera-v2.1-arm.apk** kiểm tra payload native để sửa lỗi `.map` trên `undefined` khi JavaScript mới chạy cùng APK cũ. 14 Node tests, typecheck/lint và release build đạt; xem **camera_diagnosis/EVENT_GUARD.md**. Bản này giữ model và word mode.

Sau phản hồi nhận diện sai A/O/C/S/X, Y→I, M→N, O/C→T: đã build **camera v2** sửa slot identity theo Collector, reset khi mất tay và xóa ký tự cũ khi dự đoán mới chưa đạt. Thêm ghi mẫu có nhãn thật và script replay .pt/TFLite/Android. Xem **camera_diagnosis/RESULT.md** và APK **camera_diagnosis/alphabet-camera-v2-arm.apk**. 11 Node tests, 3 Android tests, typecheck/lint và build đạt. **Accuracy camera vẫn chưa được xác nhận; cần JSON mẫu lỗi thực.**

## Kết quả conversion trước đó

Đã nhận ZIP Colab PASS, tích hợp binary mới và pass kiểm chứng local + Android. APK debug và release ARM đã build, xác thực hashes và đóng gói đúng assets. Regression timestamp đã sửa; WordMode giữ nguyên.

Xem **RESULT.md** để có báo cáo cuối, số liệu trước/sau, tên model/labels, lệnh và giới hạn accuracy thực. Kết quả machine-readable nằm trong **colab_20260913_114142/**; báo cáo baseline cũ vẫn ở **baseline/**. Conversion mới không còn bị chặn: đã thực hiện trên Colab.
