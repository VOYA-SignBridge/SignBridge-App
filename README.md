# Welcome to your Expo app 👋

This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

## Get started

1. Install dependencies

   ```bash
   npm install
   ```

2. Create your local env file

   Copy `.env.example` to `.env` and fill in your backend and Supabase values.

3. Start the app

   ```bash
   npx expo start
   ```

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

You can start developing by editing the files inside the **app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

## Get a fresh project

When you're ready, run:

```bash
npm run reset-project
```

This command will move the starter code to the **app-example** directory and create a blank **app** directory where you can start developing.

## Learn more

To learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

## Join the community

Join our community of developers creating universal apps.

- [Expo on GitHub](https://github.com/expo/expo): View our open source platform and contribute.
- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.

## Alphabet HandGCN on-device (Android)

Alphabet uses `handgcn_alphabet_20260914_094314.pte`, bundled with its original
`.pte.metadata.json` in `android/app/src/main/assets`. It runs locally through
the `AlphabetModel` Kotlin bridge and ExecuTorch 1.4.0/XNNPACK CPU. No model
download, HTTP inference request or Python server is involved. Word mode still
uses its existing TFLite bridge, model registry, normalization and UI.

The current native camera/landmark implementation is Android-only. Build a
64-bit Android app (arm64-v8a phone or x86_64 emulator, Android API 26+). Expo Go,
32-bit emulators and iOS do not contain this native runtime. Reloading Metro
alone cannot install the new model/runtime; rebuild the native app:

```powershell
npm run android
# Or build an APK for a physical 64-bit Android phone:
cd android
.\gradlew.bat :app:assembleDebug -PreactNativeArchitectures=arm64-v8a
```

The local inference contract is:

1. The existing camera supplies unmirrored MediaPipe normalized XYZ landmarks.
   `onAlphabetHands` preserves full float precision and handedness scores for
   both detections; the existing word events remain unchanged.
2. `src/utils/alphabet/realtimeFlatten.ts` and `handIdentity.ts` port the supplied
   reference frontend: swap raw MediaPipe handedness into anatomical slots,
   keep wrist anchors to prevent identity flips, and preserve two detections
   even when their labels match. Do **not** mirror X. Each raw frame is 126
   floats: left 21 XYZ landmarks, then right 21 XYZ landmarks. Absent hands are zero.
3. Collect 60 real frames, oldest first. The existing native throttle is 50 ms,
   so first recognition requires roughly 3 seconds or more of visible hands.
   Debounced hand loss, camera gaps and unmount invalidate stale predictions.
4. Kotlin applies the server's exact `hands126_v1` independently to each hand:
   subtract wrist XY, calculate XY span over points with translated norm > 1e-6,
   divide XY by the maximum span if > 1e-6, and leave Z unchanged. A whole empty
   hand stays zero. Zero triples inside a nonempty hand are translated too,
   matching Python (different from the legacy TFLite helper).
5. Call `forward` with **one** float32 tensor `[1, 60, 126]`. The PTE contains the
   graph/weights; no lengths tensor or manual GCN reshaping is needed. Output is
   `[1, 30]` logits. Stable softmax, argmax and the metadata's ordered
   `idx_to_label` produce `{modelId, classIndex, label, label_key, confidence}`.
   Labels such as Â, Ă, Đ, Ô, Ơ and Ư are decoded directly from metadata.
6. The alphabet UI retains its 65% confidence threshold, two consecutive matching
   predictions and suppression of duplicate committed letters until hand reset
   or a different stable letter. Inference runs on a serial native worker;
   initialization verifies the model checksum and warms up the actual graph.

**Reference discrepancy:** the exported metadata says `MP_Left(63)+MP_Right(63)`,
but the supplied serving frontend swaps raw handedness and applies identity
tracking. This integration intentionally follows the executable serving client,
including `MIRROR_SERVING_PAYLOAD=false`, and then the server's normalization.
Metadata is preserved verbatim. This does not resolve the reference corpus's
documented mixed mirror conventions; recognition quality needs real camera tests.

Validation commands:

```powershell
node scripts/test-alphabet.cjs
npx tsc --noEmit
cd android
.\gradlew.bat :app:testDebugUnitTest
# Start/connect a 64-bit emulator or phone first:
.\gradlew.bat :app:connectedDebugAndroidTest -PreactNativeArchitectures=x86_64
```

The Android instrumentation tests execute the bundled PTE and React Native
bridge, compare logits to golden outputs from the original `.pt` checkpoint,
and verify metadata decoding. `scripts/generate-alphabet-fixtures.py` regenerates
golden data with the supplied Python normalization and original HandGCN
architecture; pass `--checkpoint` pointing to the matching checkpoint. Generated
fixtures are test-only assets, not production assets.

Runtime integration reference: [ExecuTorch Android documentation](https://docs.pytorch.org/executorch/stable/using-executorch-android.html).

## Switching word/legacy TFLite models (Android)

TFLite models are registered in
`android/app/src/main/assets/tflite_models.json`. The native module no longer
hard-codes a model filename or its tensor dimensions.

To add or replace a model:

1. Copy the `.tflite` model and its display-label JSON file into
   `android/app/src/main/assets/`.
2. Add a model entry under `models` in `tflite_models.json`. Set its sequence
   length, feature dimension, class count, signature/input/output names, and
   preprocessing flags to match the exported model.
3. Point `modes.word` to the new model ID. Set
   `defaultModel` for callers that still use `predictTcn(frames)`.
4. Rebuild the Android app so the new assets are packaged into the APK.

`modes.alphabet` and old alphabet assets are retained for legacy callers; they
are no longer used by `AlphabetMode`, which calls the dedicated PTE module.

`applySoftmax` should be `true` when the model returns logits and `false` when
it already returns probabilities. `mirrorInput` swaps left/right hands and
mirrors the X coordinate at prediction time; raw MediaPipe landmarks remain
the shared event format. The current MediaPipe pipeline emits 126 features
(21 XYZ landmarks for each of two hands), so registered models must use
`featureDimension: 126`.
