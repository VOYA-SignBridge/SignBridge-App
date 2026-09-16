const fs = require('node:fs/promises');
const path = require('node:path');
process.env.EXPO_IMAGE_UTILS_NO_SHARP = '1';
const { setSplashImageDrawablesForThemeAsync } = require('@expo/prebuild-config/build/plugins/unversioned/expo-splash-screen/withAndroidSplashImages');

async function main() {
  const projectRoot = path.resolve(__dirname, '..');
  const { expo } = JSON.parse(await fs.readFile(path.join(projectRoot, 'app.json'), 'utf8'));
  const splash = expo.plugins.find(plugin => Array.isArray(plugin) && plugin[0] === 'expo-splash-screen')[1];
  for (const theme of ['light', 'dark']) {
    const image = path.resolve(projectRoot, theme === 'dark' ? splash.dark?.image ?? splash.image : splash.image);
    const backgroundColor = theme === 'dark' ? splash.dark?.backgroundColor ?? splash.backgroundColor : splash.backgroundColor;
    await setSplashImageDrawablesForThemeAsync({
      mdpi: image, hdpi: image, xhdpi: image, xxhdpi: image, xxxhdpi: image,
      backgroundColor,
    }, theme, projectRoot, splash.imageWidth);
  }
  console.log('Updated CTU splash images for light/dark themes and all five Android densities.');
}

main().catch(error => { console.error(error); process.exitCode = 1; });
