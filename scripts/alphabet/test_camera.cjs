const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const Module = require('node:module');
const root = path.resolve(__dirname, '../..');
function load(relative, custom = {}) {
  const file = path.join(root, relative);
  const m = new Module(file, module);
  const normalRequire = m.require.bind(m);
  m.require = (id) => custom[id] ?? normalRequire(id);
  m._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, file);
  return m.exports;
}
const identity = load('src/utils/alphabetHandIdentity.ts');
const collector = load('VOYA-Collector/frontend/src/utils/handIdentity.ts');
const { AlphabetHandTracker, readAlphabetFrame } = load('src/utils/alphabetCamera.ts', { './alphabetHandIdentity': identity });
const points = (x) => Array.from({ length: 21 }, (_, i) => ({ x: x + i * 0.002, y: 0.5 + i * 0.003, z: -i * 0.001 }));
const detection = (label, x, score = 0.9) => ({ label, landmarks: points(x), score });

test('old APK payload reports rebuild requirement instead of calling map on undefined', () => {
  const oldEvent = { timestampMs: 100, handCount: 1, frame: Array(126).fill(0) };
  const parsed = readAlphabetFrame(oldEvent);
  assert.equal(parsed.frame, undefined);
  assert.match(parsed.error, /APK/);
  assert.equal(new AlphabetHandTracker().encode(oldEvent.detections, 100), null);
});
test('malformed bridge payloads are rejected without throwing or manufacturing a hand', () => {
  const tracker = new AlphabetHandTracker();
  for (const value of [undefined, null, {}, 'bad', [null], [{ landmarks: [] }], [{ ...detection('Left', 0.3), landmarks: [{ x: NaN, y: 1, z: 1 }] }]]) {
    assert.equal(tracker.encode(value, 100), null);
    assert.equal(readAlphabetFrame(value).frame, undefined);
  }
});
test('current native event validates and real empty detections still produce zeros', () => {
  const event = { timestampMs: 100, handCount: 1, frame: Array(126).fill(0), imageWidth: 480, imageHeight: 640, detections: [detection('Left', 0.3)] };
  assert.equal(readAlphabetFrame(event).frame, event);
  assert.equal(readAlphabetFrame({ ...event, handCount: 2 }).frame, undefined);
  assert.equal(readAlphabetFrame({ ...event, imageWidth: undefined }).frame, undefined);
  assert.equal(readAlphabetFrame({ ...event, timestampMs: Infinity }).frame, undefined);
  assert.deepEqual(new AlphabetHandTracker().encode([], 100), Array(126).fill(0));
});

test('a rotating hand stays in its MP slot despite a handedness flip', () => {
  const tracker = new AlphabetHandTracker();
  assert.equal(tracker.encode([detection('Left', 0.3)], 0)[0], 0.3);
  const next = tracker.encode([detection('Right', 0.31)], 33);
  assert.equal(next[0], 0.31);
  assert.deepEqual(next.slice(63), Array(63).fill(0));
  // After the Collector anchor timeout, a new hand may acquire another slot.
  assert.equal(tracker.encode([detection('Right', 0.31)], 500)[63], 0.31);
});
test('two hands with the same MediaPipe label never overwrite each other', () => {
  const tracker = new AlphabetHandTracker();
  const frame = tracker.encode([detection('Left', 0.2, 0.95), detection('Left', 0.7, 0.8)], 0);
  assert.equal(frame[0], 0.2);
  assert.equal(frame[63], 0.7);
  assert.equal(frame[5], -0.001); // precision and Z survive slot assignment
});
test('mobile resolver matches Collector on 1000 changing detection sequences', () => {
  const tracker = new AlphabetHandTracker();
  let anchors = {};
  for (let i = 0; i < 1000; i++) {
    const now = i * 33;
    const detections = i % 11 === 0 ? [] : [detection(i % 3 ? 'Left' : 'Right', 0.3 + Math.sin(i / 9) * 0.1)];
    if (i % 4 === 0) detections.push(detection('Left', 0.75, 0.8));
    if (i % 57 === 0) { tracker.reset(); anchors = {}; }
    const assignment = collector.assignHandSlots(detections.map(d => ({ ...d, label: d.label === 'Left' ? 'Right' : 'Left' })), anchors, now);
    const expected = Array(126).fill(0);
    for (const slot of ['left', 'right']) {
      if (!assignment[slot]) continue;
      anchors[slot] = { ...collector.wristOf(assignment[slot]), t: now };
      expected.splice(slot === 'left' ? 63 : 0, 63, ...assignment[slot].flatMap(p => [p.x, p.y, p.z]));
    }
    assert.deepEqual(tracker.encode(detections, now), expected);
  }
});
