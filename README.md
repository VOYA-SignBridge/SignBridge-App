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

## Switching TFLite models (Android)

TFLite models are registered in
`android/app/src/main/assets/tflite_models.json`. The native module no longer
hard-codes a model filename or its tensor dimensions.

To add or replace a model:

1. Copy the `.tflite` model and its display-label JSON file into
   `android/app/src/main/assets/`.
2. Add a model entry under `models` in `tflite_models.json`. Set its sequence
   length, feature dimension, class count, signature/input/output names, and
   preprocessing flags to match the exported model.
3. Point `modes.alphabet` and/or `modes.word` to the new model ID. Set
   `defaultModel` for callers that still use `predictTcn(frames)`.
4. Rebuild the Android app so the new assets are packaged into the APK.

`applySoftmax` should be `true` when the model returns logits and `false` when
it already returns probabilities. `mirrorInput` swaps left/right hands and
mirrors the X coordinate at prediction time; raw MediaPipe landmarks remain
the shared event format. The current MediaPipe pipeline emits 126 features
(21 XYZ landmarks for each of two hands), so registered models must use
`featureDimension: 126`.
