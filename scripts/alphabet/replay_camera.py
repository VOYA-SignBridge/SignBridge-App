"""Replay user-labelled camera captures without converting or retraining the model.

Usage: .alphabet-tools/python/python.exe scripts/alphabet/replay_camera.py
       --input reports/alphabet/camera_samples/session.json --output reports/alphabet/camera_samples/replay.json
All paths stay in this workspace. Input JSON is treated only as data.
"""
import argparse
import json
import sys
from pathlib import Path

import numpy as np
import torch
from ai_edge_litert.interpreter import Interpreter

sys.path.insert(0, str(Path(__file__).resolve().parent))
from deploy import ASSETS, STEM, compare, load_checkpoint, local, preprocess, sha, write_json

CHECKPOINT_TFLITE_SHA = '524c028ac9861d5c1d82bcedd2e1f92dc45f342ef97e775409fcaf393075d13c'


def open_tflite(binary, config):
    runtime = Interpreter(model_path=str(binary), num_threads=4)
    runtime.allocate_tensors()
    if config['signatureKey']:
        runner = runtime.get_signature_runner(config['signatureKey'])
        return runtime, lambda x: runner(**{config['frameInputName']: x})[config['outputName']]
    input_detail = runtime.get_input_details()[0]
    output_detail = runtime.get_output_details()[0]
    return runtime, lambda x: (
        runtime.set_tensor(input_detail['index'], x), runtime.invoke(),
        runtime.get_tensor(output_detail['index'])
    )[-1]


def probabilities(values, output_type):
    if output_type == 'probabilities':
        return values
    values = values - values.max()
    result = np.exp(values)
    return result / result.sum()


def replay(input_path, output_path):
    payload = json.loads(input_path.read_text(encoding='utf-8-sig'))
    assert payload['schemaVersion'] == 1 and 0 < len(payload['clips']) <= 30
    contract = json.loads(local('scripts/alphabet/deployment_contract.json').read_text(encoding='utf-8'))
    registry = json.loads((ASSETS / 'tflite_models.json').read_text(encoding='utf-8'))
    config = registry['models'][registry['modes']['alphabet']]
    label_json = json.loads((ASSETS / config['labelsFile']).read_text(encoding='utf-8'))
    labels = [label_json[str(i)] for i in range(30)]
    binary = ASSETS / config['modelFile']
    assert sha(binary) == config['modelSha256']
    runtime, run = open_tflite(binary, config)
    model = None
    if config['modelSha256'] == CHECKPOINT_TFLITE_SHA:
        _, model, checkpoint_labels = load_checkpoint(local(STEM + '.pt'), contract)
        assert labels == [checkpoint_labels[str(i)] for i in range(30)]
    results = []
    torch.set_num_threads(4)
    for clip in payload['clips']:
        assert clip['schemaVersion'] == 1 and clip['pipelineVersion'] == 'alphabet-camera-v2'
        expected = clip['expectedLabel']
        assert expected in labels
        assert clip['prediction']['modelSha256'] == config['modelSha256'], 'Capture uses a different binary'
        raw = np.asarray(clip['frames'], dtype=np.float32)
        assert raw.shape == (60, 126) and np.isfinite(raw).all()
        normalized = np.stack([preprocess(frame, contract) for frame in raw])[None]
        with torch.inference_mode():
            pt = model(torch.from_numpy(normalized)).numpy() if model is not None else None
        lite = run(normalized)
        android = np.asarray(clip['prediction']['logits'], dtype=np.float32)[None]
        assert android.shape == (1, 30) and np.isfinite(android).all()
        assert int(clip['prediction']['classIndex']) == int(android.argmax())
        assert clip['prediction']['label'] == labels[int(android.argmax())]
        probs = probabilities(lite[0], config['outputType'])
        events = clip['events']
        times = np.asarray([e['timestampMs'] for e in events], dtype=np.float64)
        intervals = np.diff(times)
        assert np.all(intervals > 0)
        variants = {}
        # Exploratory evidence only. Never select a serving transform by confidence.
        for swap, mirror in [(False, False), (False, True), (True, True)]:
            variant_contract = {**contract, 'swapHandedness': swap, 'mirrorInput': mirror}
            variant = np.stack([preprocess(f, variant_contract) for f in raw])[None]
            values = run(variant)[0]
            variants[f'swap={swap},mirror={mirror}'] = {'predicted': labels[int(values.argmax())], 'correct': labels[int(values.argmax())] == expected}
        item = {
            'capturedAt': clip['capturedAt'], 'expected': expected,
            'tflite': labels[int(lite.argmax())], 'android': labels[int(android.argmax())],
            'tfliteCorrect': labels[int(lite.argmax())] == expected,
            'androidCorrect': labels[int(android.argmax())] == expected,
            'tfliteVsAndroid': compare(lite, android, [expected]),
            'top5': [{'label': labels[int(i)], 'probability': float(probs[i])} for i in np.argsort(-probs)[:5]],
            'emptyFramesInModelWindow': int(np.all(raw == 0, axis=1).sum()),
            'detectorFps': float(1000 / intervals.mean()) if len(intervals) else None,
            'maxCallbackGapMs': float(intervals.max()) if len(intervals) else None,
            'imageSizes': sorted({f"{e['imageWidth']}x{e['imageHeight']}" for e in events}),
            'orientationExperiments': variants,
        }
        if pt is not None:
            item.update({'pytorch': labels[int(pt.argmax())],
                         'pytorchCorrect': labels[int(pt.argmax())] == expected,
                         'pytorchVsTflite': compare(pt, lite, [expected]),
                         'pytorchVsAndroid': compare(pt, android, [expected])})
        results.append(item)
    write_json(output_path, {
        'captureCount': len(results), 'modelSha256': config['modelSha256'],
        'outputType': config['outputType'],
        'pytorchAvailable': model is not None,
        'tfliteAccuracyOnSubmittedClips': sum(r['tfliteCorrect'] for r in results) / len(results),
        'androidAccuracyOnSubmittedClips': sum(r['androidCorrect'] for r in results) / len(results),
        'limitation': 'Selected user-labelled error clips, not an independent validation set. Transform experiments do not authorize changing serving orientation.',
        'clips': results,
    })
    print(output_path)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--input', required=True)
    parser.add_argument('--output', required=True)
    args = parser.parse_args()
    destination = local(args.output)
    if destination.exists():
        raise FileExistsError(f'Refusing to overwrite {destination}')
    replay(local(args.input), destination)
