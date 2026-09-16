const fs = require('node:fs/promises');
const path = require('node:path');
// Use Expo's in-process image compiler; no external image CLI is needed.
process.env.EXPO_IMAGE_UTILS_NO_SHARP = '1';
const { generateImageAsync, generateImageBackgroundAsync, compositeImagesAsync } = require('@expo/image-utils');
const { setIconAsync } = require('@expo/prebuild-config/build/plugins/icons/withAndroidIcons');

async function main() {
  const projectRoot = path.resolve(__dirname, '..');
  const { expo } = JSON.parse(await fs.readFile(path.join(projectRoot, 'app.json'), 'utf8'));
  const adaptive = expo.android.adaptiveIcon;
  // Keep the CTU diamond entirely within Android's adaptive-icon safe area.
  const size = 1024;
  const logoSize = 600;
  const { source } = await generateImageAsync({ projectRoot }, {
    src: path.resolve(projectRoot, expo.icon), width: logoSize, height: logoSize,
    resizeMode: 'contain', backgroundColor: 'transparent',
  });
  const background = await generateImageBackgroundAsync({
    width: size, height: size, resizeMode: 'contain', backgroundColor: 'transparent',
  });
  const foreground = await compositeImagesAsync({
    foreground: source, background, x: (size - logoSize) / 2, y: (size - logoSize) / 2,
  });
  await fs.writeFile(path.resolve(projectRoot, adaptive.foregroundImage), foreground);
  await setIconAsync(projectRoot, {
    icon: adaptive.foregroundImage,
    backgroundColor: adaptive.backgroundColor,
    backgroundImage: null,
    monochromeImage: null,
    isAdaptive: true,
  });
  console.log('Updated CTU launcher icons for all five Android density buckets.');
}

main().catch(error => { console.error(error); process.exitCode = 1; });
