const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname, '../..');

function loadModule(filename, dependencies, globals = {}) {
  const output = ts.transpileModule(fs.readFileSync(path.join(root, filename), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true, jsx: ts.JsxEmit.React, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const mod = { exports: {} };
  vm.runInNewContext(output, {
    module: mod, exports: mod.exports, AbortController, setTimeout, clearTimeout, console,
    require: name => {
      if (!(name in dependencies)) throw new Error(`Unexpected dependency: ${name}`);
      return dependencies[name];
    },
    ...globals,
  }, { filename });
  return mod.exports;
}

function service(provider, fetch) {
  return loadModule('src/llm/llmService.js', {
    './promptBuilder.js': { buildSystemPrompt: () => 'system', buildUserMessage: () => 'user' },
    './modelConfig.js': { ACTIVE_MODEL: { provider, id: 'test-model' } },
  }, { fetch, process: { env: {
    EXPO_PUBLIC_LLM_PROVIDER: provider, EXPO_PUBLIC_GROQ_API_KEY: 'test-only',
    EXPO_PUBLIC_OLLAMA_BASE_URL: 'https://test.invalid',
  } } }).buildSentence;
}

for (const provider of ['groq', 'ollama']) {
  test(`${provider}: disabling aborts an active fetch without a correction request`, async () => {
    let calls = 0;
    let fetchSignal;
    const build = service(provider, (_url, options) => {
      calls++;
      fetchSignal = options.signal;
      return new Promise((_resolve, reject) => {
        options.signal.addEventListener('abort', () => reject(Object.assign(new Error('cancelled'), { name: 'AbortError' })), { once: true });
      });
    });
    const controller = new AbortController();
    const pending = build(['đi', 'học'], { signal: controller.signal });
    controller.abort();
    await assert.rejects(pending, { name: 'AbortError' });
    assert.equal(fetchSignal.aborted, true);
    assert.equal(calls, 1);
  });
}

test('already cancelled sentence does not call a provider', async () => {
  const build = service('groq', () => { throw new Error('Must not fetch'); });
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(build(['đi'], { signal: controller.signal }), { name: 'AbortError' });
});

test('cancellation during response parsing prevents a second provider request', async () => {
  const controller = new AbortController();
  let calls = 0;
  const build = service('groq', async () => {
    calls++;
    return { ok: true, json: async () => {
      controller.abort();
      return { choices: [{ message: { content: 'đi học' } }] };
    } };
  });
  await assert.rejects(build(['đi', 'học'], { signal: controller.signal }), { name: 'AbortError' });
  assert.equal(calls, 1);
});

test('existing callers without a signal still build sentences', async () => {
  const build = service('groq', async () => ({ ok: true, json: async () => ({ choices: [{ message: { content: 'Tôi đi học.' } }] }) }));
  assert.equal(await build(['đi', 'học']), 'Tôi đi học.');
});

// Exercise the actual screen handlers with in-memory hooks and native components.
// This checks request/token behavior, not native layout or React effect lifecycles.
function screenHarness(sentenceBuildingAvailable = true) {
  const hooks = [];
  let index = 0;
  const requests = [];
  const React = {
    createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
    useState: initial => {
      const slot = index++;
      if (!(slot in hooks)) hooks[slot] = initial;
      return [hooks[slot], value => { hooks[slot] = typeof value === 'function' ? value(hooks[slot]) : value; }];
    },
    useRef: initial => {
      const slot = index++;
      if (!(slot in hooks)) hooks[slot] = { current: initial };
      return hooks[slot];
    },
    useCallback: value => value,
    useEffect: () => {},
  };
  const native = Object.fromEntries(['View', 'Text', 'TouchableOpacity', 'TextInput', 'TouchableWithoutFeedback', 'KeyboardAvoidingView', 'Modal', 'Switch'].map(name => [name, name]));
  const { default: Screen } = loadModule('app/(tabs)/translation.tsx', {
    react: React,
    'react-native': { ...native, StyleSheet: { create: x => x }, Platform: { OS: 'android' }, Keyboard: { dismiss: () => {} }, Alert: { alert: () => {} } },
    'react-native-safe-area-context': { SafeAreaView: 'SafeAreaView' },
    '@/contexts/ThemeContext': { useTheme: () => ({ colors: { primary: '#123456' } }) },
    'react-i18next': { useTranslation: () => ({ t: key => key }) },
    'expo-video': { useVideoPlayer: () => ({ play: () => {} }), VideoView: 'VideoView' },
    '@expo/vector-icons': { Ionicons: 'Ionicons' },
    '@/components/SignLanguageCamera': 'SignLanguageCamera',
    '@/components/translation/WordMode': 'WordMode',
    '@/components/translation/AlphabetMode': 'AlphabetMode',
    '@/llm/llmService': { buildSentence: (tokens, options) => new Promise((resolve, reject) => { requests.push({ tokens: [...tokens], signal: options.signal, resolve, reject }); }) },
    '@/config': { SENTENCE_BUILDING_AVAILABLE: sentenceBuildingAvailable },
    '../data/useDictionaryStore': { useDictionaryStore: selector => selector({ findWord: () => null }) },
    '../utils/CloudinaryHelper': { getSignVideoUrl: () => null },
    '@/contexts/PronounContext': { formatPronounPreference: () => 'tôi – bạn', PRONOUN_PRESETS: [], usePronouns: () => ({ preference: { speakerPronoun: 'tôi', listenerPronoun: 'bạn', addSubject: true } }) },
  });
  const render = () => { index = 0; return Screen(); };
  const find = (tree, predicate) => {
    if (!tree || typeof tree !== 'object') return null;
    if (!Array.isArray(tree) && predicate(tree)) return tree;
    for (const child of Array.isArray(tree) ? tree : tree.props?.children ?? []) {
      const result = find(child, predicate);
      if (result) return result;
    }
    return null;
  };
  const main = render();
  find(main, node => node.type === 'TouchableOpacity' && node.props.children.some(child => child?.props?.name === 'camera')).props.onPress();
  return { render, find, requests };
}

test('switch off blocks even a retained camera callback; re-enabling builds the full token sequence', async () => {
  const screen = screenHarness();
  const camera = screen.render();
  const callback = screen.find(camera, node => node.type === 'WordMode').props.onResult;
  const toggle = screen.find(camera, node => node.type === 'Switch');
  assert.equal(toggle.props.value, true);
  toggle.props.onValueChange(false);
  callback('đi');
  callback('học');
  assert.equal(screen.requests.length, 0);
  screen.find(screen.render(), node => node.type === 'Switch').props.onValueChange(true);
  assert.equal(screen.requests.length, 1);
  assert.deepEqual(screen.requests[0].tokens, ['đi', 'học']);
  screen.requests[0].resolve('Tôi đi học.');
  await new Promise(setImmediate);
  const sentence = screen.find(screen.render(), node => node.type === 'TextInput' && node.props.accessibilityLabel === 'translation.completedSentence');
  assert.equal(sentence.props.value, 'Tôi đi học.');
});

test('switch off aborts a pending build and ignores a late response while preserving manual edits', async () => {
  const screen = screenHarness();
  let camera = screen.render();
  screen.find(camera, node => node.type === 'WordMode').props.onResult('đi');
  camera = screen.render();
  screen.find(camera, node => node.type === 'Switch').props.onValueChange(false);
  assert.equal(screen.requests[0].signal.aborted, true);
  const completed = tree => screen.find(tree, node => node.type === 'TextInput' && node.props.accessibilityLabel === 'translation.completedSentence');
  completed(screen.render()).props.onChangeText('Câu sửa thủ công');
  screen.requests[0].resolve('Kết quả cũ');
  await new Promise(setImmediate);
  assert.equal(completed(screen.render()).props.value, 'Câu sửa thủ công');
  assert.equal(screen.find(screen.render(), node => node.type === 'Switch').props.value, false);
});

test('confirming edited signs while off updates tokens without invoking the sentence builder', () => {
  const screen = screenHarness();
  screen.find(screen.render(), node => node.type === 'Switch').props.onValueChange(false);
  screen.find(screen.render(), node => node.type === 'TouchableOpacity' && node.props.accessibilityLabel === 'translation.recognizedSigns').props.onPress();
  const editor = screen.render();
  screen.find(editor, node => node.type === 'TextInput' && node.props.accessibilityLabel === 'translation.recognizedSignsEditorTitle').props.onChangeText('tôi, đi học');
  screen.find(editor, node => node.type === 'TouchableOpacity' && node.props.children.some(child => child?.type === 'Text' && child.props.children.includes('translation.confirmRecognizedSigns'))).props.onPress();
  assert.equal(screen.requests.length, 0);
  screen.find(screen.render(), node => node.type === 'Switch').props.onValueChange(true);
  assert.deepEqual(screen.requests[0].tokens, ['tôi', 'đi học']);
});

test('demo hides sentence controls and keeps recognized-sign editing without LLM calls', () => {
  const { SENTENCE_BUILDING_AVAILABLE } = loadModule('src/config.ts', {}, { process: { env: {} } });
  assert.equal(SENTENCE_BUILDING_AVAILABLE, false);
  const screen = screenHarness(SENTENCE_BUILDING_AVAILABLE);
  const camera = screen.render();
  assert.equal(screen.find(camera, node => node.type === 'Switch'), null);
  assert.equal(screen.find(camera, node => node.type === 'TextInput' && node.props.accessibilityLabel === 'translation.completedSentence'), null);
  assert.equal(screen.find(camera, node => node.type === 'TouchableOpacity' && node.props.accessibilityLabel?.startsWith('translation.quickPronouns')), null);
  screen.find(camera, node => node.type === 'WordMode').props.onResult('đi');
  assert.equal(screen.requests.length, 0);
  screen.find(screen.render(), node => node.type === 'TouchableOpacity' && node.props.accessibilityLabel === 'translation.recognizedSigns').props.onPress();
  const editor = screen.render();
  screen.find(editor, node => node.type === 'TextInput' && node.props.accessibilityLabel === 'translation.recognizedSignsEditorTitle').props.onChangeText('đi, học');
  screen.find(editor, node => node.type === 'TouchableOpacity' && node.props.children.some(child => child?.type === 'Text' && child.props.children.includes('translation.confirmRecognizedSigns'))).props.onPress();
  assert.equal(screen.requests.length, 0);
  const recognized = screen.find(screen.render(), node => node.type === 'TouchableOpacity' && node.props.accessibilityLabel === 'translation.recognizedSigns');
  assert.equal(recognized.props.children[0].props.children[0], 'đi · học');
});
