# ExecuTorch for ARMv8-A

The Maven `org.pytorch:executorch-android:1.4.0` arm64 library executes an LSE
`ldaddal` instruction in JNI tensor cleanup. On the connected Vivo V2206 / SM6225,
which has no `atomics` CPU feature, opening alphabet mode terminates the app with
`SIGILL` at library offset `0x1c6eb0` (original Build ID
`48d11ec5338cce6c3fe6dc125458740fa56af085`).

`build_executorch_armv8a.py` rebuilds the same ExecuTorch tag using
`-march=armv8-a -mno-outline-atomics`. It includes Module/Tensor JNI, XNNPACK,
and portable CPU operators, with optional ARM extensions disabled. LLM/ASR,
training and profiling JNI are outside this app's runtime configuration.
Model files and recognition preprocessing are separate from the library.

The script replaces only `jni/arm64-v8a/libexecutorch.so` in the original AAR.
Java classes, Android resources and the original x86_64 library are preserved.
It rejects a native library containing LSE instructions before packaging it.

## Rebuild on Windows

Prerequisites: Git, Python 3.11 with PyTorch/torchgen 2.13.0 and PyYAML,
Android NDK `27.1.12297006`, and the original Maven AAR in Gradle's cache.
Run from the application repository root. This workspace already has the
matching host `flatc` 24.3.25 in `.alphabet-tools/executorch-runtime/`.
Use `--flatc <path>` to provide the same version from another location.

```powershell
python -m venv --system-site-packages .alphabet-tools/executorch-armv8a/venv
python -m pip install --target .alphabet-tools/executorch-armv8a/host-tools cmake==3.31.6 ninja==1.11.1.4
git -c core.longpaths=true clone --depth 1 --branch v1.4.0 https://github.com/pytorch/executorch.git .alphabet-tools/executorch-armv8a/executorch
git -c core.longpaths=true -C .alphabet-tools/executorch-armv8a/executorch submodule update --init --depth 1 --jobs 6 third-party/flatbuffers third-party/flatcc third-party/json third-party/gflags third-party/pocketfft backends/xnnpack/third-party/XNNPACK backends/xnnpack/third-party/FP16 backends/xnnpack/third-party/FXdiv backends/xnnpack/third-party/cpuinfo backends/xnnpack/third-party/pthreadpool
.alphabet-tools/executorch-armv8a/venv/Scripts/python.exe scripts/native/build_executorch_armv8a.py
```

For subsequent builds, run only the last command. `--ndk`, `--base-aar`,
`--flatc`, and `--jobs` override machine-specific inputs. `--package-only`
rechecks and packages an already compiled library.

The source directory must be named `executorch` as required by upstream.
The build script applies two CMake portability changes in the local source
checkout: use the matching host `flatc`, and use CMake to extract fbjni instead
of requiring a separate `unzip` executable.

## Outputs and integration

- `android/app/libs/executorch-android-1.4.0-armv8a.aar`
- Adjacent `.json`: source commit, compiler options, NDK and SHA-256 hashes.
- `reports/executorch-armv8a/`: configure/build logs and instruction audit.

`android/app/build.gradle` consumes the local AAR and explicitly declares the
fbjni, nativeloader and AndroidX dependencies from the original Maven POM.
The native library must be included in a new APK; Metro reload cannot replace it.

```powershell
./android/gradlew.bat -p android :app:assembleDebug :app:assembleDebugAndroidTest -PreactNativeArchitectures=arm64-v8a
```

Verify the packaged library hash, then run the existing
`AlphabetParityTest` instrumentation tests on an ARM64 device without LSE.
They cover the active TCN model, BiGRU golden-output parity and MediaPipe loading.

Upstream source and license: https://github.com/pytorch/executorch/tree/v1.4.0
(BSD 3-Clause; dependencies retain their respective upstream licenses).
