const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const Module = require('node:module');
const filename = path.resolve(__dirname, '../../src/utils/alphabetSampling.ts');
const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const mod = new Module(filename, module);
mod._compile(compiled, filename);
const { AlphabetSampler } = mod.exports;
const frame = (v) => Array(126).fill(v);

test('60 samples at 30 FPS span 1967ms, regardless of callback arrival time', () => {
  const s = new AlphabetSampler();
  for (let i = 0; i < 60; i++) s.append(frame(i + 1), 100000 + Math.round(i * 1000 / 30));
  const snapshot = s.snapshot();
  assert.equal(snapshot.length, 60);
  assert.deepEqual(snapshot.map((f) => f[0]), Array.from({length:60}, (_,i) => i+1));
});
test('slow callbacks preserve time with zero bins, never stretch the gesture', () => {
  const s = new AlphabetSampler();
  for (let i = 0; i < 60; i += 2) s.append(frame(i + 1), Math.round(i * 1000 / 30));
  s.append(frame(60), 1967);
  const x = s.snapshot();
  assert.equal(x[1][0], 0);
  assert.equal(x[2][0], 3);
  assert.equal(x[59][0], 60);
});
test('native millisecond truncation must not drop every third 30 FPS frame', () => {
  const s = new AlphabetSampler();
  // Native timestamp uses integer division of camera nanoseconds by 1_000_000.
  // This produces 0,33,66,100,... rather than rounded 0,33,67,100,... .
  for (let i = 0; i < 60; i++) s.append(frame(i + 1), 100000 + Math.floor(i * 1000 / 30));
  const x = s.snapshot();
  assert.ok(x, 'All 60 source frames must fill one window');
  assert.deepEqual(x.map((f) => f[0]), Array.from({length:60}, (_,i) => i+1));
});
test('empty detection is a real zero frame in the window', () => {
  const s = new AlphabetSampler();
  for (let i = 0; i < 60; i++) s.append(frame(i === 20 ? 0 : 1), i * 1000 / 30);
  assert.deepEqual(s.snapshot()[20], frame(0));
});
test('rejects duplicate/out-of-order/invalid timestamps and nonfinite features', () => {
  const s = new AlphabetSampler();
  assert.equal(s.append(frame(1), 10).accepted, true);
  for (const t of [10, 9, NaN, Infinity]) assert.equal(s.append(frame(2), t).accepted, false);
  assert.equal(s.append(frame(NaN), 20).accepted, false);
  assert.equal(s.append([1], 20).accepted, false);
});
test('keeps latest sample within a time bin and copies caller data', () => {
  const s = new AlphabetSampler();
  const f = frame(1);
  s.append(f, 0); f[0] = 99;
  assert.equal(s.append(frame(2), 1).accepted, false);
  for (let i = 1; i < 60; i++) s.append(frame(3), i * 1000 / 30);
  assert.equal(s.snapshot()[0][0], 2);
  const a = s.snapshot(); a[0][0] = 999;
  assert.equal(s.snapshot()[0][0], 2);
});
test('long interruption starts a fresh window; explicit reset handles mode changes', () => {
  const s = new AlphabetSampler();
  s.append(frame(1), 0);
  assert.equal(s.append(frame(2), 5000).restarted, true);
  assert.equal(s.snapshot(), null);
  s.reset();
  assert.equal(s.append(frame(3), 0).accepted, true);
});
test('word model, registry and WordMode are unchanged from the initial workspace', () => {
  const crypto = require('node:crypto');
  const root = path.resolve(__dirname, '../..');
  const before = JSON.parse(fs.readFileSync(path.join(root, 'scripts/alphabet/fixtures/registry-before.json')));
  const after = JSON.parse(fs.readFileSync(path.join(root, 'android/app/src/main/assets/tflite_models.json')));
  assert.equal(after.modes.word, before.modes.word);
  assert.equal(after.defaultModel, before.defaultModel);
  for (const [id, value] of Object.entries(before.models)) assert.deepEqual(after.models[id], value);
  const hash = crypto.createHash('sha256').update(fs.readFileSync(path.join(root, 'src/components/translation/WordMode.tsx'))).digest('hex');
  assert.equal(hash, 'ae718dc87ae5269be45791e68d96211bc0a42fd6d8217c277701fec30397fadb');
});
