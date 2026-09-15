# Bản thử `model.tflite`

Lỗi ban đầu `model: model SHA-256 mismatch` là đúng: registry khai báo SHA của model Colab cũ (`524c028a…`), còn binary `model.tflite` có SHA-256 `910de8cf5d73a244e1fbc1b791230cf21b484189c9ee0568a8806140ca716cd0`.

Không chỉ khác hash: model mới không có TFLite Signature và không dùng tên `args_0/output_0`. Metadata thật:

- Input tensor `inputs_0`, float32 `[1,60,126]`.
- Output tensor `Identity`, float32 `[1,30]`.
- Không quantize: 108 tensor float32, 11 tensor int32.
- Operator cuối là `SOFTMAX`; output là xác suất, không phải logits. Kiểm tra zero/random input đều hữu hạn và tổng xác suất bằng 1.
- `model.json` có đủ 30 index 0–29, SHA-256 `2c5e2ecea0f0a66fac11d2032e8c75ea5e5750f249cb9aee4b04083f1969b493`.

Đã cập nhật entry `model` theo metadata thật và giữ `modes.alphabet = model`. `AlphabetRuntime` giờ hỗ trợ an toàn hai dạng: model có signature và model một input/output tensor thường. Với output probabilities, confidence lấy trực tiếp xác suất lớn nhất và không Softmax lần hai. Runtime vẫn kiểm tra hash, tensor name/shape/dtype/quantization và phân phối xác suất trước khi trả kết quả.

Model cũ không bị xóa. Golden test cũ được ghim rõ vào ID model Colab để tiếp tục kiểm chứng regression; thêm smoke/parity test riêng cho active `model.tflite`.

Kết quả:

- Registry/hash/tensor metadata: đạt.
- 14 kiểm thử JS/TypeScript liên quan camera/sampling/word: đạt; lint và typecheck đạt.
- Android debug + androidTest x86 build: đạt.
- Android instrumentation: `OK (4 tests)`. Output của `model.tflite` trên zero input khớp LiteRT Python trong tolerance `1e-5`.
- Release ARM64/ARM32: build thành công; APK chứa đúng registry/model/labels và JavaScript bundle.
- APK: `alphabet-model-trial-arm.apk`, SHA-256 `6ab52e3f568cb16f875c89be2554bad74329376ea74c013e8dad14cd1d8b628e`.
- Word mode vẫn trỏ tới `tcn_dialect-hoa-de_20260721_160609`; không sửa đường inference word.

Chưa có checkpoint `.pt`, validation data hay metadata preprocessing thuộc riêng `model.tflite`, nên chưa thể đo accuracy hoặc chứng minh `swapHandedness=true`, `mirrorInput=false` và normalization hiện tại là hợp đồng train của model mới. Bản này cho phép thử camera đúng runtime; không tuyên bố accuracy trước khi thu mẫu thực.
