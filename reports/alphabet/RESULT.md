# Tích hợp `voya_tcn_alphabet_30class_fp32.pte` — 2026-09-15

Alphabet hiện dùng `voya_tcn_alphabet_30class_fp32_executorch_d7a6bee0` qua ExecuTorch Android 1.4.0 trên `x86_64` và `arm64-v8a`. PTE có SHA-256 `d7a6bee0b62477a1602ed2b24529e2e873d01463c8acb95c0a77cd6179caea12`, chỉ có method `forward`, input FP32 `[1,60,126]` và output logits FP32 `[1,30]`; app áp dụng softmax đúng một lần.

PTE chạy thành công trên 64 fixtures bằng ExecuTorch desktop, toàn bộ output hữu hạn. Compile Kotlin/AndroidTest x86_64 pass; toàn bộ 7/7 instrumentation tests trên AVD `SignBridge_x86_64` pass, gồm khởi tạo MediaPipe HandLandmarker, kiểm tra PTE hiện hành, TFLite fallback, preprocessing và inference parity. Sampling tests pass 8/8. Chỉ build debug APK phục vụ instrumentation, không build release.

Crash khi mở camera được xác định là `UnsatisfiedLinkError`: MediaPipe `tasks-vision:0.10.14` không đóng gói JNI cho `x86_64`. Dependency đã được nâng lên `0.10.35`; `tasks-core:0.10.35` có `libmediapipe_tasks_jni.so` cho `x86_64`, và test khởi tạo HandLandmarker thật trên emulator đã pass.

File không có metadata sidecar, checkpoint hoặc labels đi kèm. Tạm thời entry dùng label order của `tcn_alphabet_20260912_121104_display_labels.json` và preprocessing `alphabet_hands126_v1`; hai contract này chưa thể xác minh từ chính PTE. PTE cũng không phải cùng model với TCN TFLite cũ: chỉ 5/64 argmax trùng trên fixtures và max absolute difference `36.0822372`.

Trên x86 32-bit, runtime tự fallback về `model_bigru.tflite`. Word mode vẫn là `tcn_dialect-hoa-de_20260721_160609` và không được chỉnh. Audit nằm tại `reports/alphabet/voya_tcn_pte_d7a6bee0/audit.json`.

---

# Tích hợp BiGRU Attention `.pte` bằng ExecuTorch — 2026-09-15

Alphabet hiện dùng `bigru_attention_alphabet_20260914_092530_executorch_1dca17c6` qua ExecuTorch Android 1.4.0. Model có input FP32 `[1,60,126]`, output logits FP32 `[1,30]`; app áp dụng softmax đúng một lần. SHA-256 của PTE là `1dca17c68fbc3fb5e00a136590b0090d189ad8544a9af60b4503bddfa4eb6f16`; metadata là `eb154c5d340e5badd3ba70df3051517b7b7cf4e6752300d17ceb0d558ea2a4f0`; checkpoint nguồn là `cd39e37c53b6726b2bd5511b5925148b4d1a778b56d2bc0542521d384cbc538d`.

PTE đã được chạy độc lập bằng ExecuTorch 1.4.0 và so với checkpoint PyTorch trên 64 fixture có cấu trúc. Kết quả đạt 64/64 argmax, max absolute error `5.7220458984375e-06`, mean absolute error `8.675424965076672e-07`, pass `atol=rtol=1e-4`. Checkpoint báo test accuracy `0.9654255319148937`, macro F1 `0.9656328561401024`; đây là metric dataset của checkpoint, chưa phải accuracy camera thực tế.

Runtime Android xác minh hash model/metadata/labels, contract 60×126 → 30, thứ tự 30 nhãn và output hữu hạn; nó chạy smoke inference khi nạp. `compileDebugKotlin` và `compileDebugAndroidTestKotlin` pass; sampling test pass 8/8, gồm kiểm tra word mode không đổi. Không assemble APK. Instrumentation chưa chạy vì AVD hiện có là x86 32-bit, trong khi AAR ExecuTorch hỗ trợ `x86_64` và `arm64-v8a`; cần AVD x86_64 hoặc điện thoại arm64 để thử camera.

`modes.word` vẫn là `tcn_dialect-hoa-de_20260721_160609`; code và model word không được chỉnh trong lần tích hợp PTE. Audit và golden nằm tại `reports/alphabet/executorch_bigru_20260914_092530/`.

---

# Tích hợp thử `model_bigru.tflite` — 2026-09-14

Alphabet hiện trỏ tới `model_bigru_dc868da1`; word vẫn là `tcn_dialect-hoa-de_20260721_160609`. Binary được giữ dưới tên hash-specific `model_bigru_dc868da1.tflite`, SHA-256 `dc868da1644295ff10976f3eeee0681be13e6168f7da228611126312c0a50638`.

Model là FP32 plain-tensor, không có signature: input `inputs_0 [1,60,126]`, output `Identity [1,30]`. Output là xác suất đã Softmax, nên registry dùng `outputType=probabilities` và `applySoftmax=false`. Hash model/labels, tensor contract và tổng xác suất đều pass; Kotlin app/androidTest compile pass và 8/8 sampling tests pass. Không assemble APK.

Model mới không khớp checkpoint BiGRU đã biết trên fixtures: chỉ 25/64 argmax trùng, max absolute probability error `0.888389647`. Đảo hai block tay hoặc đảo thời gian không cải thiện. Vì không có checkpoint/manifest đi kèm model mới, đây là entry trial để đo camera thật; kết quả audit nằm trong `reports/alphabet/model_bigru_dc868da1/audit.json`. HandGCN và các BiGRU đã kiểm chứng vẫn còn trong registry để quay lại mà không chép lại binary.

---

# Kết quả tích hợp HandGCN Alphabet từ Colab — 2026-09-14

Alphabet hiện dùng `handgcn_alphabet_20260913_175720_colab_f780742c_fp32`; word vẫn dùng `tcn_dialect-hoa-de_20260721_160609`. Model FP32 logits có SHA-256 `f780742c8da0538ad89e0e3c4a67f0c6d6e069f224a41d8c812375f598f302a2`, input `[1,60,126]`, output `[1,30]`, signature `serving_default` với `args_0` và `output_0`. Labels có SHA-256 `2c5e2ecea0f0a66fac11d2032e8c75ea5e5750f249cb9aee4b04083f1969b493`.

ZIP `handgcn_export_20260914_043035_778536_PASS.zip` có SHA-256 `f65e935468d4d81f551c3f04c00167d8e11a3489479d7ab2c403eddbc489a443`. Checkpoint, sidecar, deploy manifest và strict state-dict load đều pass. PyTorch → TFLite serialize/load đạt 64/64 argmax, max absolute error `9.5367431640625e-06`, `atol=rtol=1e-4`.

Khi tích hợp, golden raw đã được đổi từ thứ tự giải phẫu `[Left,Right]` sang thứ tự raw MediaPipe mà app thực nhận; Kotlin sau đó swap đúng một lần. `AlphabetPreprocessing` cũng được sửa để khớp chính xác `normalize_single_hand` khi một landmark hoặc wrist bị zero. So sánh 64×60 frame cho max preprocessing error `0`. `compileDebugKotlin` và `compileDebugAndroidTestKotlin` pass; chưa assemble/cài APK hoặc chạy instrumentation trong lần cập nhật này.

Artifact và audit đầy đủ nằm trong `reports/alphabet/handgcn_colab_20260914_043035/`. Accuracy camera thật vẫn cần đo trên emulator/thiết bị; parity 64/64 chỉ chứng minh conversion và preprocessing không làm đổi đầu ra của checkpoint trên fixtures.

---

# Kết quả tích hợp BiGRU Alphabet từ Colab — 2026-09-13

Đã tích hợp binary mới từ ZIP người dùng gửi, kiểm chứng lại bằng checkpoint local, chạy golden test bằng LiteRT Android 1.0.1, build APK debug và APK release dành cho điện thoại ARM. Chỉ alphabet được thay đổi; WordMode và cấu hình/model word giữ nguyên. Không cài litert-converter trên máy Windows.

## Model và nhãn đang dùng

- Mode alphabet: `bigru_attention_alphabet_20260818_114440_colab_524c028a_fp32`.
- Model trong `android/app/src/main/assets/`: `bigru_attention_alphabet_20260818_114440_colab_524c028a_fp32.tflite`.
- Labels: `bigru_attention_alphabet_20260818_114440_colab_524c028a_labels.json`; 30 index liên tục 0–29, tên lấy từ `idx_to_label.label_original` của checkpoint và đối chiếu ngược `label_to_idx`.
- Model SHA-256: `524c028ac9861d5c1d82bcedd2e1f92dc45f342ef97e775409fcaf393075d13c`.
- Checkpoint SHA-256: `0f6626b2857827645c7139e4870d02cfd905e5fcf9c3b4d879d266415f0237eb`.
- ZIP nguồn: `alphabet_export_20260913_114142_292718_PASS.zip`, SHA-256 `319e1a3f4dbfbd918077bb31ed3cff80ed66010db813e3b61056b89c7a26459f`.
- Binary mới: 1.604.632 bytes. Các binary cũ không bị ghi đè; entry alphabet mới có hậu tố hash để phân biệt rõ.
- Input FP32 `[1,60,126]`; logits FP32 `[1,30]`; không có tensor quantized; cả 4690 tensor đã được kiểm tra metadata ở local.
- Signature đọc từ binary: `serving_default`; input key `args_0`, tensor `serving_default_args_0`; output key `output_0`, tensor `serving_default_output_0_output`.

## Sai số và argmax agreement

Các phép so sánh dùng cùng 64 chuỗi có cấu trúc landmark, bao gồm một tay, hai tay, mất detection, frame trống, Z âm, wrist lệch gốc và landmark thiếu. Không có mẫu đổi argmax ở bất kỳ bước nào.

| So sánh | Số mẫu; argmax agreement | Max absolute error | Mean absolute error | Max relative error |
|---|---|---|---|---|
| Colab PyTorch → ngay sau convert | 64/64; 100% | 4.76837158e-06 | 5.4695635e-07 | 0.00030221525 |
| Colab PyTorch → TFLite sau serialize/load | 64/64; 100% | 4.76837158e-06 | 5.4695635e-07 | 0.00030221525 |
| Ngay sau convert → sau serialize/load | 64/64; 100% | 0 | 0 | 0 |
| PyTorch local → TFLite local, binary mới | 64/64; 100% | 2.38418579e-06 | 3.84772041e-07 | 0.000106496678 |
| Colab PyTorch → Android normalized input | 64/64; 100% | 4.76837158e-06 | 9.25711659e-07 | 0.000629189356 |
| Colab TFLite → Android normalized input | 64/64; 100% | 4.76837158e-06 | 7.82067461e-07 | 0.000327072953 |
| Colab PyTorch → Android raw input + preprocessing | 64/64; 100% | 4.76837158e-06 | 9.25711659e-07 | 0.000629189356 |

Tolerance: `atol=1e-4`, `rtol=1e-4`; mẫu số relative error có floor `1e-6`. Relative error lớn nhất nằm gần logits bằng zero; đánh giá pass đồng thời bằng absolute/relative tolerance và argmax. Mean relative error và toàn bộ logits từng mẫu nằm trong JSON kèm theo.

Python/Kotlin preprocessing: max error **0** trên 64×60 frames. Cả **30/30 labels** khớp Android. Native mean inference trên emulator `sdk_gphone_x86`: **2.631 ms**; đây không phải FPS camera hoặc benchmark điện thoại thật.

Trước khi nhận ZIP, binary cũ cũng đã đạt 64/64 parity: max abs PyTorch/Python TFLite `2.384185791015625e-6`; Android/PyTorch `4.76837158203125e-6`. Vì vậy conversion cũ chưa có bằng chứng làm hỏng logits; không tuyên bố conversion mới làm tăng accuracy thực.

## Các lỗi/nguy cơ đã xác nhận, theo mức ảnh hưởng

1. **Lệch thời gian lấy mẫu.** Code cũ lọc ở native mỗi 50ms và JS mỗi 50ms, không gửi empty detection. Camera 30 FPS thường còn khoảng 15 FPS sau bộ lọc native, nên cửa sổ 60 frame có thể dài khoảng 4 giây hoặc hơn. Alphabet hiện lấy timestamp camera, chia mốc 30 FPS, zero-fill mốc mất frame/empty detection và bỏ callback cũ; reset khi gián đoạn dài hơn một cửa sổ. Tác động accuracy trên video thật chưa đo được.
2. **Lỗi lượng tử hóa timestamp trong bản sửa đầu.** Timestamp native dùng chia nguyên từ ns xuống ms, tạo `0,33,66,100,…`. Cách floor mốc từng gây gộp frame 66ms vào mốc 33ms, chèn zero giả và không đủ 60 frame khi đã nhận 60 frame. Regression test tái hiện lỗi trước sửa. Đã chuyển sang mốc thời gian gần nhất bằng `Math.round`; đủ 60/60 frame và 8/8 test pass.
3. **Label order cũ trong Git HEAD sai 8 index đầu.** Checkpoint dùng `A, Â, Ă, B, C, D, Đ, E,…`, không phải thứ tự cũ `D, E, A, Ă, Â, B, C, Đ,…`. Label sửa có sẵn của người dùng đã đúng và được giữ nguyên. Bản Colab mới sinh labels trực tiếp từ checkpoint; không sort nhãn.
4. **Metadata checkpoint mang cấu hình TCN.** `levels=3` không phải số tầng GRU. Shape weights chứng minh hidden=64, có l0/l1 và reverse cho cả hai tầng. Manifest pin checkpoint hash, giữ dropout=0.3 và dùng đúng kiến trúc từ VOYA-Collector; `strict=True` pass. Không thay kiến trúc hoặc retrain.
5. **Model selection và provenance chưa rõ.** Hai file cũ và `_fp32` có SHA giống nhau. Giờ alphabet trỏ tới entry mới riêng của binary Colab; runtime xác minh hash model/labels, signature, names, shapes, dtype, quantization và logits hữu hạn. APK thực tế đã được mở và đối chiếu toàn bộ model/labels trong registry với workspace, kể cả word.

## Pipeline cuối

Camera không mirror → MediaPipe → raw `[MP_Left(63), MP_Right(63)]` + timestamp → event alphabet riêng → buffer raw 60 frame theo 30 FPS → Kotlin đổi hai block một lần → normalize XY quanh wrist từng tay và scale riêng, giữ Z → TFLite → logits → softmax ổn định → class index → label checkpoint.

Không làm tròn landmarks trước inference. Missing hand/landmark giữ zero; thiếu wrist thì zero-fill cả tay. Golden tests kiểm tra swap/mirror/negative Z/missing points. UI threshold và số lần xác nhận nhãn giữ nguyên. Preprocessing chỉ chạy trên raw input; đường debug/golden normalized input không normalize lại.

## Build, test và APK

- Import/audit ZIP: pass hash checkpoint, nguồn kiến trúc, labels, input, report và parity local; không thực thi mã từ archive.
- `node --test scripts/alphabet/test_sampling.cjs`: **8/8 pass**, có test giữ nguyên WordMode và các registry entry cũ.
- ESLint và TypeScript riêng các file alphabet sửa: pass, không warning.
- `:app:assembleDebug :app:assembleDebugAndroidTest -PreactNativeArchitectures=x86`: pass.
- `AlphabetParityTest` trên emulator-5554: **OK (3 tests)**; binary mới được nạp đúng hash.
- `:app:assembleRelease -PreactNativeArchitectures=arm64-v8a,armeabi-v7a`: pass.
- APK điện thoại: `android/app/build/outputs/apk/release/app-release.apk`, 128,272,361 bytes, có JavaScript bundle và hai ABI `arm64-v8a`, `armeabi-v7a`.
- APK SHA-256: `bc68bdab07aa1e8b8af6c965911cb13c21088d0e04edf805015bf21236904b80`.
- Debug và release đều pass `scripts/alphabet/verify_apk.py`; tất cả assets model/label/registry khớp workspace. Release dùng signing config có sẵn của dự án (debug key), phù hợp cài kiểm thử trực tiếp.

## Phạm vi file thay đổi

Ở bước nhận ZIP này: thêm model/labels Colab với tên riêng; đổi `modes.alphabet` và thêm entry trong `tflite_models.json`; cập nhật 3 golden assets của androidTest; sửa `src/utils/alphabetSampling.ts` và bổ sung regression test; thêm `import_colab_result.py`, `verify_apk.py` và báo cáo.

Ở phần triển khai trước đó: `HandLandmarksModule.kt`, `HandLandmarkerHolder.kt`, `hands_landmarkPlugin.kt`, hai lớp `alphabet/AlphabetRuntime.kt` và `AlphabetPreprocessing.kt`, `AlphabetMode.tsx`, kiểu config `tfliteModels.ts`, Gradle dependencies cho androidTest, script conversion/Colab và fixtures. `SignLanguageCamera.tsx`, `WordMode.tsx`, các binary/labels TCN, `modes.word` và `defaultModel` giữ nguyên.

## Lệnh để tái kiểm tra

```powershell
.alphabet-tools/python/python.exe scripts/alphabet/import_colab_result.py --zip 'C:/Users/LENOVO/Downloads/alphabet_export_20260913_114142_292718_PASS.zip' --output-dir reports/alphabet/colab_20260913_114142 --activate
node --test scripts/alphabet/test_sampling.cjs
node node_modules/eslint/bin/eslint.js src/components/translation/AlphabetMode.tsx src/config/tfliteModels.ts src/utils/alphabetSampling.ts
node node_modules/typescript/bin/tsc --noEmit -p scripts/alphabet/tsconfig.json
# Chạy Gradle từ thư mục android:
./gradlew.bat :app:assembleDebug :app:assembleDebugAndroidTest -PreactNativeArchitectures=x86
./gradlew.bat :app:assembleRelease '-PreactNativeArchitectures=arm64-v8a,armeabi-v7a'
# Sau khi adb install -r app-debug.apk và app-debug-androidTest.apk:
adb -s emulator-5554 shell am instrument -w -r -e class com.nmnghi.VOYA_App.alphabet.AlphabetParityTest com.nmnghi.VOYA_App.test/androidx.test.runner.AndroidJUnitRunner
.alphabet-tools/python/python.exe scripts/alphabet/verify_apk.py --apk android/app/build/outputs/apk/release/app-release.apk --report reports/alphabet/colab_20260913_114142/apk-release-assets.json --abis arm64-v8a,armeabi-v7a
```

Import đã chạy; muốn audit lại phải dùng output-dir mới và bỏ `--activate` để không ghi đè assets. Conversion đã chạy trên Colab qua `convert_alphabet_colab.py convert --output-dir …`, torch 2.11.0+cpu, litert-torch 0.9.4, litert-converter 0.4.0, LiteRT 2.2.0; xem `requirements-frozen.txt` và `conversion.log` trong thư mục kết quả.

## Giới hạn còn lại

**Accuracy nhận diện thật chưa thể kết luận.** Không có NPZ feature data validation/test đúng checkpoint trong workspace/ZIP. `93.0362%` là metric lịch sử của checkpoint, không phải accuracy app mới đo. 100% ở trên là **argmax agreement trên fixtures**, không phải nhận diện đúng 100% trên camera.

Handedness/mirror đã thống nhất với mã serving của Collector và được kiểm tra bằng tensor; vẫn cần video/điện thoại thật để đo hiệu ứng detector và quy ước corpus lịch sử. APK ARM đã build/kiểm tra đóng gói nhưng chưa có điện thoại ARM kết nối để chạy golden test phần cứng. Full typecheck toàn repo vẫn gồm frontend Collector thiếu dependencies; kiểm tra riêng phần app sửa đã pass. Các giới hạn này không ảnh hưởng kết luận parity số học trên những runtime đã chạy.
