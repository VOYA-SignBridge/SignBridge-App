# Đối chiếu HandGCN PyTorch và `model.tflite`

## Kết luận

`model.tflite` là bản chuyển đổi số học đúng của checkpoint HandGCN được cung cấp. Không có bằng chứng conversion làm hỏng class index. Lỗi runtime ban đầu nằm ở hợp đồng output: PyTorch trả logits nhưng TFLite đã nhúng Softmax và trả xác suất; registry cũ lại khai báo logits nên Android Softmax lần hai. Với 30 lớp, confidence sau lần Softmax thứ hai có upper bound `exp(1)/(exp(1)+29) = 0.0857008`, thấp hơn hẳn ngưỡng app `0.65`; mọi kết quả đều bị UI loại dù argmax có đúng. Entry `model` hiện đã khai báo `outputType=probabilities`, `applySoftmax=false`.

Nếu người dùng đã thử APK `alphabet-model-trial-arm.apk` sau khi sửa hợp đồng output mà vẫn nhận diện tệ, nguyên nhân còn lại nằm ở chất lượng/generalization checkpoint hoặc dữ liệu camera đưa vào model, không nằm ở phép chuyển TFLite.

## Bằng chứng model

- Checkpoint SHA-256 `b891cb0d157de813ce0376eceb0935dc6cc3557f31c6fd513bfdfc3449726318`, 574.331 byte. `model.tflite` SHA-256 `910de8cf5d73a244e1fbc1b791230cf21b484189c9ee0568a8806140ca716cd0`, 560.624 byte.
- Checkpoint `model_type=HandGCN`, `[60,126]`, 30 lớp, `hands126_v1`; cấu hình 42 nodes, GCN 64×2, temporal 128, dropout 0.3, max-distance 2. Source hiện có khởi tạo và `load_state_dict(strict=True)` thành công, không thiếu/thừa key.
- TFLite: input `inputs_0` float32 `[1,60,126]`; output `Identity` float32 `[1,30]`; không có Signature; không quantize. Tất cả tensor là float32/int32, operator cuối là Softmax.
- Trên 64 chuỗi landmark có cấu trúc: `softmax(PyTorch logits)` và TFLite đạt 64/64 argmax agreement; max absolute error `3.5762786865234375e-7`, mean absolute error `6.441373294156552e-9`; không sample đổi argmax.
- 30/30 nhãn trong checkpoint, deploy manifest và `model.json` trùng index.
- Android test chạy model tensor thường và đối chiếu 30 xác suất của zero input với LiteRT Python trong tolerance `1e-5`; toàn bộ 4 Android tests pass. Golden parity của model BiGRU cũ vẫn pass riêng.

## Bất đồng đã xác nhận

1. **Output contract (đã sửa):** `HandGCNModel.forward` trả logits. Deploy manifest ghi activation Softmax và binary TFLite có Softmax cuối. Registry ban đầu gắn metadata của BiGRU/logits cho binary mới, đồng thời sai hash, signature và tensor names. Hash/signature giúp model fail-fast; sau khi bỏ các lỗi đó, double Softmax là lỗi làm confidence không bao giờ đạt ngưỡng.
2. **Temporal missing-frame policy (chưa đo trên điện thoại người dùng):** checkpoint train với `temporal_mask_prob=0.0`; dữ liệu train vì vậy không được augment bằng whole-frame temporal masks. App lại chèn frame 126 số zero cho mỗi tick 30 FPS không có callback. Trên 64 fixture tổng hợp, giữ 1/2 frame làm 43/64 sample rơi dưới threshold; giữ 1/3 làm 43/64 đổi argmax; giữ 1/4 làm 64/64 đổi argmax. Đây là sensitivity test, không phải accuracy. Cần JSON camera thật để biết máy người dùng thực tế chèn bao nhiêu zero.
3. **Detector domain (chưa định lượng):** nguồn Collector mô tả corpus được ghi bằng web `@mediapipe/hands` modelComplexity 1. Android dùng MediaPipe Tasks `hand_landmarker.task` ở LIVE_STREAM. Cùng 21 điểm không bảo đảm phân phối landmark giống nhau. Không có video/landmark validation gốc trong các file người dùng gửi để đo khác biệt này.
4. **Provenance/model quality:** checkpoint tự ghi `run_purpose="smoke_test"`, dù metric lịch sử là test accuracy `0.9521277`, macro-F1 `0.9521864` trên 376 one-hand samples (147 left-only, 229 right-only, 0 both). CSV/NPZ và dataset checksum `9f893c…` không có trong workspace/attachments, nên không thể tái tính metric, confusion matrix hoặc kiểm tra leakage/near-duplicate split. Metric này không chứng minh accuracy camera Android.

## Những phần không bất đồng

- Shape/dtype/class count và label order khớp.
- Checkpoint contract `MP_Left(63)+MP_Right(63)` được backend Collector canonicalize thành `swapped_mp_handedness_slots`; cấu hình app `swapHandedness=true` phù hợp cách hiểu chính thức đó.
- `hands126_v1` và preprocessing Android cùng wrist-center XY, scale từng tay, giữ Z với detection đầy đủ. Chưa có sample train gốc để kiểm tra phân phối thực tế.
- Softmax nhúng trong TFLite là hợp lệ vì so sánh với `torch.softmax` đạt sai số rất nhỏ; đây không phải lỗi conversion.

## Dữ liệu cần để kết luận lỗi camera còn lại

Thu JSON bằng nút **Ghi mẫu nhận diện sai** trên APK thử mới. File cần có các mẫu đúng/sai của A, O, C, S, X, Y, I, M, N, T. Script `replay_camera.py` hiện hỗ trợ cả TFLite có Signature/logits và model tensor thường/probabilities; nó kiểm tra Android ↔ LiteRT, số frame zero, callback FPS, top-5 và mirror/swap experiments. Không có checkpoint conversion tương ứng trong workspace thì script không gán nhầm model `.pt` khác cho parity.
