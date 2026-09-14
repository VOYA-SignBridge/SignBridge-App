/* global __dirname: readonly */
// Expo's emulator discovery requires ANDROID_HOME or emulator on PATH, even
// when Gradle already knows the SDK through android/local.properties.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const projectRoot = path.resolve(__dirname, '..');
const propertiesPath = path.join(projectRoot, 'android', 'local.properties');
let localSdk;
if (fs.existsSync(propertiesPath)) {
  const properties = fs.readFileSync(propertiesPath, 'utf8');
  const value = properties.match(/^\s*sdk\.dir\s*=\s*(.+)$/m)?.[1]?.trim();
  // Java properties escape Windows backslashes, colons and spaces.
  if (value) localSdk = value.replace(/\\([\\: =])/g, '$1');
}
const defaultSdk = process.platform === 'win32'
  ? path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'), 'Android', 'Sdk')
  : process.platform === 'darwin'
    ? path.join(os.homedir(), 'Library', 'Android', 'sdk')
    : path.join(os.homedir(), 'Android', 'Sdk');
const adbName = process.platform === 'win32' ? 'adb.exe' : 'adb';
const sdk = [process.env.ANDROID_HOME, process.env.ANDROID_SDK_ROOT, localSdk, defaultSdk]
  .find((candidate) => candidate && fs.existsSync(path.join(candidate, 'platform-tools', adbName)));

if (!sdk) {
  console.error('Android SDK not found. Set ANDROID_HOME or sdk.dir in android/local.properties.');
  process.exit(1);
}

const result = spawnSync(process.execPath, [
  require.resolve('expo/bin/cli'), 'run:android', ...process.argv.slice(2),
], {
  cwd: projectRoot,
  stdio: 'inherit',
  env: {
    ...process.env,
    NODE_ENV: process.env.NODE_ENV || 'development',
    ANDROID_HOME: sdk,
    ANDROID_SDK_ROOT: sdk,
  },
});
if (result.error) console.error(`Could not start Expo: ${result.error.message}`);
process.exit(result.status ?? 1);
