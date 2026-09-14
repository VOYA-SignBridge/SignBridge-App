"""Generate independent Python/PyTorch golden data for Android tests.

Run with a Python environment containing torch and numpy:
  python scripts/generate-alphabet-fixtures.py --checkpoint /path/to/handgcn.pt
The checkpoint must match the SHA in the bundled .pte metadata.
"""
import argparse
import hashlib
import importlib.util
import json
import sys
from pathlib import Path

import numpy as np
import torch

ROOT = Path(__file__).resolve().parents[1]
REFERENCE = ROOT / "react-native-pte-reference"
sys.path.insert(0, str(REFERENCE))
from processed.shared.normalization import normalize_hands_vector_126

parser = argparse.ArgumentParser()
parser.add_argument("--checkpoint", type=Path, required=True)
args = parser.parse_args()
metadata = json.loads((ROOT / "android/app/src/main/assets/handgcn_alphabet_20260914_094314.pte.metadata.json").read_text(encoding="utf-8"))
assert hashlib.sha256(args.checkpoint.read_bytes()).hexdigest() == metadata["source_checkpoint_sha256"]
spec = importlib.util.spec_from_file_location("export_handgcn", REFERENCE / "export_handgcn_to_pte.py")
exporter = importlib.util.module_from_spec(spec)
spec.loader.exec_module(exporter)
model = exporter._build_eager_model(exporter._load_checkpoint(args.checkpoint)).eval()
torch.set_num_threads(2)

rng = np.random.default_rng(20260914)
full = rng.uniform(0.1, 0.9, 126).astype(np.float32)
full[2::3] = rng.uniform(-0.1, 0.1, 42)
left = full.copy()
left[63:] = 0
right = full.copy()
right[:63] = 0
partial = left.copy()
partial[9:12] = 0  # Server translates this zero triple in an otherwise present hand.
degenerate = np.tile(np.array([0.4, 0.6, -0.03], dtype=np.float32), 42)
frames = [np.zeros(126, np.float32), full, left, right, partial, degenerate]
fixture = {"source": "processed/shared/normalization.py", "cases": [
    {"raw": value.tolist(), "normalized": normalize_hands_vector_126(value).tolist()}
    for value in frames
]}
target = ROOT / "android/app/src/test/resources/alphabet-normalization.json"
target.parent.mkdir(parents=True, exist_ok=True)
target.write_text(json.dumps(fixture, ensure_ascii=False), encoding="utf-8")

sequences = [np.zeros((60, 126), np.float32), np.stack([frames[i % len(frames)] for i in range(60)])]
cases = []
for raw in sequences:
    normalized = np.stack([normalize_hands_vector_126(frame) for frame in raw])
    with torch.inference_mode():
        logits = model(torch.from_numpy(normalized).unsqueeze(0)).numpy()[0]
    cases.append({"raw": raw.reshape(-1).tolist(), "logits": logits.tolist()})
target = ROOT / "android/app/src/androidTest/assets/alphabet-golden.json"
target.parent.mkdir(parents=True, exist_ok=True)
target.write_text(json.dumps({"source_checkpoint_sha256": metadata["source_checkpoint_sha256"], "cases": cases}), encoding="utf-8")
print("Generated normalization fixtures and", len(cases), "PyTorch golden sequences")
