const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

// Load the real data logic without starting React Native or Metro.
require.extensions['.ts'] = (mod, filename) => {
  const output = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true },
  }).outputText;
  mod._compile(output, filename);
};
const root = path.resolve(__dirname, '../..');
const { ALPHABET_LIBRARY, VIETNAMESE_ALPHABET, filterLibraryItems } = require(path.join(root, 'app/data/libraryData.ts'));
const { getAlphabetVideoUrl, getSignVideoUrl } = require(path.join(root, 'app/utils/CloudinaryHelper.ts'));
const manifest = require(path.join(root, 'app/data/alphabetVideoPublicIds.json'));

test('learning library has exactly the 29 Vietnamese letters, with unique IDs and manifest keys', () => {
  const expected = 'A Ă Â B C D Đ E Ê G H I K L M N O Ô Ơ P Q R S T U Ư V X Y'.split(' ');
  assert.deepEqual([...VIETNAMESE_ALPHABET], expected);
  assert.deepEqual(ALPHABET_LIBRARY.map(item => item.word), expected);
  assert.equal(new Set(ALPHABET_LIBRARY.map(item => item.id)).size, 29);
  assert.deepEqual(Object.keys(manifest).sort(), [...expected].sort());
});

test('missing video IDs produce no network URL', () => {
  assert.equal(getAlphabetVideoUrl(null), null);
  assert.equal(getAlphabetVideoUrl(undefined), null);
  assert.equal(getAlphabetVideoUrl('  '), null);
  for (const item of ALPHABET_LIBRARY) {
    if (manifest[item.word] === null) assert.equal(item.videoUrl, null);
  }
});

test('letter search keeps accent variants distinct and accepts trimmed/decomposed Unicode', () => {
  for (const query of ['A', 'Ă', 'Â', 'D', 'Đ', 'O', 'Ô', 'Ơ', 'U', 'Ư']) {
    assert.deepEqual(filterLibraryItems('alphabet', ` ${query.toLowerCase()} `, 'Tất cả', 'AZ').map(x => x.word), [query]);
  }
  assert.deepEqual(filterLibraryItems('alphabet', 'a\u0306', 'Tất cả', 'AZ').map(x => x.word), ['Ă']);
  assert.equal(filterLibraryItems('alphabet', 'Z', 'Tất cả', 'AZ').length, 0);
});

test('retained vocabulary region does not hide alphabet letters; reverse sort does not mutate source', () => {
  assert.equal(filterLibraryItems('alphabet', '', 'Bắc', 'AZ').length, 29);
  assert.deepEqual(filterLibraryItems('alphabet', '', 'Nam', 'ZA').map(x => x.word), [...VIETNAMESE_ALPHABET].reverse());
  assert.deepEqual(ALPHABET_LIBRARY.map(x => x.word), [...VIETNAMESE_ALPHABET]);
});

test('vocabulary search accepts surrounding spaces and Vietnamese queries without accents', () => {
  const exact = filterLibraryItems('vocabulary', 'địa chỉ', 'Tất cả', 'AZ').map(x => x.id);
  assert.equal(exact.length, 3);
  assert.deepEqual(filterLibraryItems('vocabulary', ' địa chỉ ', 'Tất cả', 'AZ').map(x => x.id), exact);
  assert.deepEqual(filterLibraryItems('vocabulary', 'dia chi', 'Tất cả', 'AZ').map(x => x.id), exact);
});

test('existing vocabulary and regional filters retain all entries', () => {
  assert.equal(filterLibraryItems('vocabulary', '', 'Tất cả', 'AZ').length, 4362);
  for (const [region, count] of [['Bắc', 534], ['Trung', 522], ['Nam', 547], ['Chung', 2759]]) {
    assert.equal(filterLibraryItems('vocabulary', '', region, 'AZ').length, count);
  }
});

test('Cloudinary IDs preserve folders and distinguish accented asset names', () => {
  const url = new URL(getAlphabetVideoUrl('signbridge/alphabet/Ă'));
  assert.equal(url.protocol, 'https:');
  assert.equal(url.hostname, 'res.cloudinary.com');
  assert.ok(url.pathname.endsWith('/signbridge/alphabet/%C4%82.mp4'));
  assert.notEqual(getAlphabetVideoUrl('signbridge/alphabet/A'), getAlphabetVideoUrl('signbridge/alphabet/Ă'));
});

test('separate alphabet cloud leaves existing sign-video URLs unchanged', () => {
  const name = 'EXPO_PUBLIC_ALPHABET_CLOUDINARY_CLOUD_NAME';
  const original = process.env[name];
  try {
    process.env[name] = 'alphabet-test-cloud';
    assert.ok(getAlphabetVideoUrl('letters/a').startsWith('https://res.cloudinary.com/alphabet-test-cloud/'));
    assert.equal(getSignVideoUrl('words/a'), 'https://res.cloudinary.com/dwdsrtyim/video/upload/q_auto,f_auto/v1/words/a.mp4');
  } finally {
    if (original === undefined) delete process.env[name];
    else process.env[name] = original;
  }
});
