# Chạy conversion trên Google Colab

## HandGCN với cây thư mục `/content` đã có

Dùng **`Convert_HandGCN_Existing_Colab_Layout.ipynb`** hoặc copy bốn cell trong **`LiteRT HandGCN Existing Colab Layout.txt`**. Bản này dùng trực tiếp:

- `/content/models/base.py` và `/content/models/hd_gcn.py`
- `/content/handgcn_alphabet_20260913_175720.pt`
- `/content/handgcn_alphabet_20260913_175720.json`
- `/content/deploy_manifest.json`
- `/content/alphabet_converter_env`

Không cần upload lại file qua hộp thoại. Chọn **Runtime → Run all**; notebook sẽ kiểm tra hash của model, metadata, manifest và source, tái sử dụng virtualenv nếu đủ dependency, rồi tải `handgcn_export_<timestamp>_PASS.zip`. Nếu môi trường cũ thiếu hoặc sai phiên bản, notebook tự sửa dependency trong chính `/content/alphabet_converter_env`.

## HandGCN `handgcn_alphabet_20260913_175720.pt`

Dùng notebook **`Convert_HandGCN_FP32_Logits.ipynb`**, hoặc copy từng khối trong **`LiteRT HandGCN Conversion.txt`** vào Colab. Chọn **Runtime → Run all**, rồi upload cùng lúc:

- `handgcn_alphabet_20260913_175720.pt`
- `handgcn_alphabet_20260913_175720.json`
- `deploy_manifest.json`

Notebook kiểm tra SHA-256 của cả ba file, nhúng nguyên kiến trúc `HandGCNModel` từ `VOYA-Collector/processed/train_utils/models/hd_gcn.py`, load weights `strict=True`, chạy `torch.export(strict=True)`, convert trực tiếp sang **FP32 logits**, serialize/load lại và so sánh 64 chuỗi landmark. Không thêm Softmax vào TFLite; registry sinh ra dùng `outputType=logits` và `applySoftmax=true`, để Android Softmax đúng một lần.

Kết quả được tải về dưới dạng `handgcn_export_<timestamp>_PASS.zip` hoặc `_FAILED.zip`. Gửi lại nguyên ZIP để audit và tích hợp. Converter độc lập là `convert_handgcn_colab.py`; có lệnh `audit` không cần converter và lệnh `convert` dành cho Linux/Colab.

## BiGRU cũ

1. Mở `Convert_Alphabet_FP32.ipynb` bằng **File → Upload notebook** trong [Google Colab](https://colab.research.google.com/).
2. Chọn **Runtime → Run all**. Khi được hỏi, upload đúng `bigru_attention_alphabet_20260818_114440.pt` ở gốc dự án. CPU đủ dùng, không cần GPU. Dependencies được cài trong virtualenv của Colab, không cài trên Windows.
3. Notebook tự tải ZIP `alphabet_export_<timestamp>_PASS.zip`. Gửi lại nguyên ZIP cho Codex tiếp tục tích hợp và kiểm tra Android. Nếu conversion lỗi, cell cuối tải ZIP `_FAILED.zip` chứa log; gửi lại file đó để chẩn đoán.

Notebook đã nhúng đầy đủ `convert_alphabet_colab.py`; không phải upload thêm thư mục VOYA-Collector.

`convert_alphabet_colab.py` cũng chạy độc lập trên Linux sau khi cài requirements-convert-linux.txt. Đặt script và checkpoint cùng thư mục rồi chạy:

```bash
python convert_alphabet_colab.py convert --output-dir alphabet_export_run1
```

Mỗi lần chạy dùng thư mục output mới. Script không ghi đè checkpoint hay tự kích hoạt model trong app.

ZIP kết quả gồm:

- `bigru_attention_alphabet_20260818_114440_verified_fp32.tflite`
- `bigru_attention_alphabet_20260818_114440_verified_labels.json` và `labels.json`, lấy đúng index từ checkpoint
- `report.json`: versions, config đã xác minh, metrics PyTorch / ngay sau convert / sau serialize-load; không tự công bố accuracy nếu thiếu test data
- `registry-entry.json`: signature và tên tensor đọc từ binary thật, SHA-256 model và labels
- `raw.f32`, `input.f32`, `golden.json`, `fixtures.npz`: dữ liệu đối chiếu Python/Kotlin/Android
- `checkpoint.json`, `requirements-frozen.txt`, `conversion.log`

Có 64 chuỗi landmark có cấu trúc: một tay, hai tay, mất detection, frame trống, Z âm, cổ tay lệch gốc và thiếu landmark. Chỉ PASS khi argmax khớp 100% và logits đạt `atol=1e-4, rtol=1e-4` ở mọi bước. Đây là kiểm chứng số học, không phải độ chính xác nhận diện trên video thật.

Nếu có test data thật, upload thêm `test_data.npz` vào `/content` trước cell cuối. Định dạng bắt buộc: `x` float32 `[N,60,126]` đã chuẩn hóa bằng pipeline train; `y` integer `[N]` dùng index 0–29 của chính checkpoint; tùy chọn `sample_ids`. Script không normalize lại `x`.

Kiến trúc được sao nguyên từ `VOYA-Collector/processed/train_utils/models/bigru_attention.py` và `base.py`. Checkpoint có metadata TCN cũ nên manifest pin theo SHA-256 và kiểm tra bằng weights: H=64, layers=2, dropout=0.3. Không dùng `levels=3` làm số tầng GRU. Không retrain, quantize hoặc thay kiến trúc.

Đã kiểm tra cú pháp toàn bộ cells và chạy bản Python độc lập với checkpoint thật. Ngày 2026-09-13, ZIP Colab trả về đã được kiểm chứng: conversion và serialize/load pass trên 64 input; bản mới cũng pass 64/64 argmax trên Android. Kết quả cụ thể và trạng thái tích hợp nằm trong `reports/alphabet/RESULT.md` của dự án. Mỗi lần export mới vẫn phải kiểm chứng lại theo hash và fixtures của lần đó.
