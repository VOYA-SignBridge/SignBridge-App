// Run the actual TypeScript encoder without React Native or a test framework.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { test } = require('node:test');

function loadTs(filename) {
  const source = fs.readFileSync(filename, 'utf8');
  const js = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const module = { exports: {} };
  const localRequire = (name) => loadTs(path.resolve(path.dirname(filename), `${name}.ts`));
  vm.runInThisContext(`(function(require, module, exports) { ${js}\n})`, { filename })(
    localRequire, module, module.exports,
  );
  return module.exports;
}

const { flattenRealtimeHands } = loadTs(path.resolve(__dirname, '../src/utils/alphabet/realtimeFlatten.ts'));
const hand = (x) => Array.from({ length: 21 }, (_, i) => ({ x: x + i * 0.001, y: 0.6 - i * 0.01, z: -i * 0.003 }));
const detection = (hands, labels) => ({
  multiHandLandmarks: hands,
  multiHandedness: labels.map((label, i) => ({ label, score: 0.99 - i * 0.01 })),
});

test('raw MediaPipe Right becomes anatomical left, with unchanged XYZ and missing right zeroed', () => {
  const points = hand(0.23);
  const frame = flattenRealtimeHands(detection([points], ['Right']));
  assert.equal(frame.length, 126);
  assert.deepEqual(Array.from(frame.slice(0, 63)), points.flatMap((p) => [p.x, p.y, p.z]).map(Math.fround));
  assert.ok(frame.slice(63).every((v) => v === 0));
});

test('both hands survive duplicate labels and reversed detector order', () => {
  const anchors = {};
  const left = hand(0.2);
  const right = hand(0.8);
  const first = flattenRealtimeHands(detection([left, right], ['Right', 'Right']), undefined, { anchors, now: 1000 });
  const second = flattenRealtimeHands(detection([right, left], ['Left', 'Left']), undefined, { anchors, now: 1060 });
  assert.equal(first[0], Math.fround(0.2));
  assert.equal(first[63], Math.fround(0.8));
  assert.deepEqual(first, second);
});

test('a rotating solo hand keeps its slot, then reacquires by label after anchor expiry', () => {
  const anchors = {};
  const points = hand(0.2);
  const first = flattenRealtimeHands(detection([points], ['Right']), undefined, { anchors, now: 1000 });
  const second = flattenRealtimeHands(detection([points], ['Left']), undefined, { anchors, now: 1100 });
  assert.deepEqual(first, second);
  const reacquired = flattenRealtimeHands(detection([points], ['Left']), undefined, { anchors, now: 1600 });
  assert.ok(reacquired.slice(0, 63).every((v) => v === 0));
  assert.equal(reacquired[63], Math.fround(0.2));
});

test('empty input clears reused buffers and nonfinite coordinates are zero-filled', () => {
  const buffer = new Float32Array(126).fill(1);
  assert.ok(flattenRealtimeHands(null, buffer).every((v) => v === 0));
  const points = hand(0.2);
  points[3] = { x: NaN, y: Infinity, z: -Infinity };
  const frame = flattenRealtimeHands(detection([points], ['Right']));
  assert.deepEqual(Array.from(frame.slice(9, 12)), [0, 0, 0]);
});
