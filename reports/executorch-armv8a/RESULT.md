# ExecuTorch ARMv8-A rebuild — 2026-09-15

## Result

Built ExecuTorch 1.4.0 from tag commit
`3dd7ccd1d863fad22639dd2d918ae34a41ce45f0` for `arm64-v8a`, Android API 26,
using Android NDK 27.1.12297006 and
`-march=armv8-a -mno-outline-atomics` for C and C++.

The rebuilt library contains **zero LSE instructions**. The original library
crashed on the Vivo V2206 / SM6225 at `ldaddal`, offset `0x1c6eb0`; this device
does not advertise the ARM `atomics` feature.

The application's Gradle dependency now uses the local AAR. The updated debug
APK was installed over the existing app on device `10AC8B1UPE000HA` and the
app was reopened successfully with Metro connected over USB.

## Artifacts

- AAR: `android/app/libs/executorch-android-1.4.0-armv8a.aar`
  - SHA-256: `0aa60a65001734982e8a38c7bdb75629b49e9c8c1b31201ba391482b7fa68380`
- ARM64 library:
  - SHA-256: `ec5fe23cdd1069a3a88bd58adc2930d6b8161395c550cc5673827f817d06cdc3`
- Debug APK: `android/app/build/outputs/apk/debug/app-debug.apk`
  - SHA-256: `546bc7d4c0b31d577fc38ef18e67b985d47040069cf01dd981af268af8667ad4`
- Rebuild script: `scripts/native/build_executorch_armv8a.py`
- Build instructions: `scripts/native/README-executorch.md`

Only the AAR's original ARM64 native library changed; Java classes, x86_64
native code and original resources compare byte-for-byte with Maven 1.4.0.
License notices were added as an asset. The rebuilt ARM64 runtime includes
Module/Tensor JNI, XNNPACK and portable CPU operators. LLM/ASR, training and
profiling are outside this build's scope.

## Verification

- Native CMake/Ninja build: **PASS**, 1001 tasks.
- Instruction disassembly audit: **PASS**, zero LSE instructions.
- Android debug app and instrumentation APK build: **PASS**.
- Packaged native library hash matches the rebuilt library: **PASS**.
- Active TCN model asset hash remains
  `d7a6bee0b62477a1602ed2b24529e2e873d01463c8acb95c0a77cd6179caea12`.
- **7/7 existing instrumentation tests passed on the physical V2206**:
  - Active TCN ExecuTorch model load, warm-up and expected FP32 logits.
  - BiGRU ExecuTorch parity against PyTorch on 64 fixtures.
  - Both TFLite probability-model tests.
  - MediaPipe HandLandmarker initialization.
  - Hand ordering/negative-Z preprocessing and non-finite-input rejection.
- BiGRU parity: **64/64 argmax agreement**, max absolute error
  `4.76837158203125e-6`, preprocessing error `0`.
- App launch after testing: Android reports `Status: ok`.

Evidence: `configure.log`, `build.log`, `instruction-audit.json`,
`android-build.log`, `apk-verification.json`, `device-tests.log`,
`device-parity.json`, and `source-portability.patch` in this directory.

This validates the native runtime on the affected CPU. It does not measure
recognition accuracy on live camera gestures. The installed APK is a debug
build and still requires Metro for its JavaScript bundle.
