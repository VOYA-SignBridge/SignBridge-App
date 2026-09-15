"""Generate HandGCN Colab cells for an existing /content/models layout."""
from __future__ import annotations

import ast
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DEST = ROOT / "scripts/alphabet/colab"
source = (DEST / "convert_handgcn_colab.py").read_text(encoding="utf-8")
marker = "\nimport argparse\nimport hashlib\nimport importlib.metadata\n"
if source.count(marker) != 1:
    raise RuntimeError("Cannot locate standalone converter core")
core = marker.lstrip("\n") + source.split(marker, 1)[1]

layout_script = '''# Generated for the existing Google Colab /content layout.
from __future__ import annotations
import hashlib
import os
import sys
from pathlib import Path
import numpy as np
import torch

CONTENT = Path(os.environ.get("HANDGCN_CONTENT_ROOT", "/content")).resolve()
sys.path.insert(0, str(CONTENT))
from models.hd_gcn import HandGCNModel


def normalize_single_hand(hand: np.ndarray) -> np.ndarray:
    value = np.asarray(hand, dtype=np.float32).copy()
    if not np.any(value):
        return value
    wrist = value[0, :2].copy()
    value[:, :2] -= wrist
    valid = np.linalg.norm(value[:, :2], axis=1) > 1e-6
    if valid.any():
        points = value[valid, :2]
        scale = max(float(np.ptp(points[:, 0])), float(np.ptp(points[:, 1])))
        if scale > 1e-6:
            value[:, :2] /= np.float32(scale)
    return value


def normalize_hands_vector_126(vector: np.ndarray) -> np.ndarray:
    value = np.asarray(vector, dtype=np.float32)
    if value.shape != (126,):
        raise ValueError(f"Expected one frame [126], got {value.shape}")
    hands = value.reshape(2, 21, 3)
    return np.concatenate([normalize_single_hand(hands[0]).reshape(-1),
                           normalize_single_hand(hands[1]).reshape(-1)]).astype(np.float32)


EXPECTED_FILE_SHA256 = {
    "handgcn_alphabet_20260913_175720.pt": "b891cb0d157de813ce0376eceb0935dc6cc3557f31c6fd513bfdfc3449726318",
    "handgcn_alphabet_20260913_175720.json": "112c0e82c9df041af49390c399e231955ef4215877a742cb4b21e9723d31c99e",
    "deploy_manifest.json": "614076a89b1cde08b3238a8a6cdb9b3dde9169b2978f125c3340d9cc37160214",
}
MODEL_SOURCE_SHA256 = {
    "models/base.py": "1cd3150297c54d41caa84d12545fd67dd7b4312f7a38ca64110a3d8143df1484",
    "models/hd_gcn.py": "50bb4faba9f4723206dca8f8e9db167a9bb7909b75dcaa33ac7aae2c08d2317a",
}
EMBEDDED_SOURCE_COMMIT = "e3afc3ec18763e382528b3e1bc2caa78a3829cec"
'''
layout_script += "\n" + core
ast.parse(layout_script)
script_path = DEST / "convert_handgcn_existing_colab.py"
script_path.write_text(layout_script, encoding="utf-8")


def markdown(value: str):
    return {"cell_type": "markdown", "metadata": {}, "source": value.splitlines(keepends=True)}


def cell(value: str):
    return {"cell_type": "code", "execution_count": None, "metadata": {}, "outputs": [], "source": value.splitlines(keepends=True)}


setup = '''# Cell 1 — dùng đúng cây thư mục hiện có trong /content.
import os, sys, subprocess
from pathlib import Path
assert sys.platform == "linux", "Notebook này chỉ dành cho Colab/Linux."
CONTENT = Path("/content")
MODELS = CONTENT / "models"
CHECKPOINT = CONTENT / "handgcn_alphabet_20260913_175720.pt"
METADATA = CONTENT / "handgcn_alphabet_20260913_175720.json"
MANIFEST = CONTENT / "deploy_manifest.json"
required = [MODELS / "__init__.py", MODELS / "base.py", MODELS / "hd_gcn.py", CHECKPOINT, METADATA, MANIFEST]
missing = [str(path) for path in required if not path.is_file()]
assert not missing, "Thiếu file theo cây thư mục trong ảnh:\\n" + "\\n".join(missing)

# Tái sử dụng env của lần convert BiGRU nếu nó đã đủ đúng phiên bản.
VENV = CONTENT / "alphabet_converter_env"
if not (VENV / "bin/python").exists():
    subprocess.run([sys.executable, "-m", "venv", str(VENV)], check=False)
PYTHON = str(VENV / "bin/python")
probe = """import importlib.metadata as m
want={'torch':'2.11.0','torchao':'0.17.0','numpy':'2.1.3','litert-torch':'0.9.4','litert-converter':'0.4.0','ai-edge-litert':'2.2.0'}
assert all(m.version(k).split('+')[0] == v for k,v in want.items()), {k:m.version(k) for k in want}
import torch, litert_torch
"""
ready = (VENV / "bin/python").exists() and subprocess.run([PYTHON, "-c", probe]).returncode == 0
if not ready:
    if not (VENV / "bin/python").exists():
        subprocess.run([sys.executable, "-m", "pip", "install", "virtualenv==20.35.3"], check=True)
        subprocess.run([sys.executable, "-m", "virtualenv", str(VENV)], check=True)
    subprocess.run([PYTHON, "-m", "pip", "install", "--upgrade", "pip"], check=True)
    subprocess.run([PYTHON, "-m", "pip", "install", "torch==2.11.0", "torchao==0.17.0", "--index-url", "https://download.pytorch.org/whl/cpu"], check=True)
    subprocess.run([PYTHON, "-m", "pip", "install", "litert-torch==0.9.4", "litert-converter==0.4.0", "ai-edge-litert==2.2.0", "numpy==2.1.3", "torch==2.11.0", "torchao==0.17.0"], check=True)
subprocess.run([PYTHON, "-c", probe], check=True)
os.chdir(CONTENT)
print("Đã thấy đủ models/, checkpoint, JSON và converter environment.")
'''

validate = '''# Cell 2 — xác minh đúng artifact và đúng source đang nằm trong /content/models.
import hashlib, json
expected_files = {
    CHECKPOINT: "b891cb0d157de813ce0376eceb0935dc6cc3557f31c6fd513bfdfc3449726318",
    METADATA: "112c0e82c9df041af49390c399e231955ef4215877a742cb4b21e9723d31c99e",
    MANIFEST: "614076a89b1cde08b3238a8a6cdb9b3dde9169b2978f125c3340d9cc37160214",
}
for path, expected in expected_files.items():
    actual = hashlib.sha256(path.read_bytes()).hexdigest()
    assert actual == expected, f"Sai SHA-256: {path.name}: {actual}"
expected_sources = {
    MODELS / "base.py": "1cd3150297c54d41caa84d12545fd67dd7b4312f7a38ca64110a3d8143df1484",
    MODELS / "hd_gcn.py": "50bb4faba9f4723206dca8f8e9db167a9bb7909b75dcaa33ac7aae2c08d2317a",
}
for path, expected in expected_sources.items():
    # read_text normalizes CRLF/LF so upload từ Windows và file Colab có cùng semantic hash.
    actual = hashlib.sha256(path.read_text(encoding="utf-8").encode()).hexdigest()
    assert actual == expected, f"Source {path.name} khác source đã audit: {actual}"
print("Artifact hashes và source models/ đều đúng.")
'''

run = '''# Cell 4 — convert, kiểm chứng và tải ZIP kết quả.
import datetime, json, shutil, subprocess
from google.colab import files
RUN = CONTENT / ("handgcn_export_" + datetime.datetime.now().strftime("%Y%m%d_%H%M%S_%f"))
LOG = Path(str(RUN) + ".log")
TEST_DATA = CONTENT / "test_data.npz"  # optional: x [N,60,126] normalized, y [N]
cmd = [PYTHON, "/content/convert_handgcn_existing_colab.py", "convert",
       "--checkpoint", str(CHECKPOINT), "--metadata", str(METADATA),
       "--deploy-manifest", str(MANIFEST), "--output-dir", str(RUN)]
if TEST_DATA.is_file(): cmd += ["--test-data", str(TEST_DATA)]
print("Bắt đầu HandGCN → TFLite FP32 logits. Không đóng tab trong lúc chạy.")
with LOG.open("w", encoding="utf-8") as log:
    process = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                               text=True, encoding="utf-8", errors="replace", bufsize=1)
    for line in process.stdout:
        print(line, end=""); log.write(line)
    exit_code = process.wait()
RUN.mkdir(exist_ok=True)
shutil.copyfile(LOG, RUN / "conversion.log")
with (RUN / "requirements-frozen.txt").open("w", encoding="utf-8") as stream:
    subprocess.run([PYTHON, "-m", "pip", "freeze"], stdout=stream, check=True)
report_path = RUN / "report.json"
report = json.loads(report_path.read_text(encoding="utf-8")) if report_path.exists() else {}
passed = exit_code == 0 and report.get("pythonParityPassed") is True and report.get("newConversionExecuted") is True
status = "PASS" if passed else "FAILED"
print(status, json.dumps(report.get("serializedTfliteParity"), indent=2))
archive = shutil.make_archive(str(RUN) + "_" + status, "zip", root_dir=RUN)
print("Tải và gửi lại file:", Path(archive).name)
files.download(archive)
'''

notebook = {
    "nbformat": 4,
    "nbformat_minor": 5,
    "metadata": {"colab": {"name": "Convert_HandGCN_Existing_Colab_Layout.ipynb"}, "kernelspec": {"display_name": "Python 3", "language": "python", "name": "python3"}},
    "cells": [
        markdown("# HandGCN → TFLite theo cây `/content` hiện có\n\nNotebook không upload/move file. Nó dùng `/content/models/hd_gcn.py`, ba artifact ở `/content` và tái sử dụng `/content/alphabet_converter_env`. Chạy **Runtime → Run all**.\n"),
        cell(setup), cell(validate),
        markdown("## Cell 3 — ghi converter vào `/content`\n"),
        cell("%%writefile /content/convert_handgcn_existing_colab.py\n" + layout_script),
        cell(run),
    ],
}
for index, item in enumerate(notebook["cells"]):
    item["id"] = f"handgcn-layout-{index:02d}"
    if item["cell_type"] == "code":
        value = "".join(item["source"])
        if value.startswith("%%writefile"):
            value = value.split("\n", 1)[1]
        ast.parse(value)

notebook_path = DEST / "Convert_HandGCN_Existing_Colab_Layout.ipynb"
notebook_path.write_text(json.dumps(notebook, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
text_path = DEST / "LiteRT HandGCN Existing Colab Layout.txt"
text_path.write_text("\n\n====================================================================\n".join(
    (setup, validate, "%%writefile /content/convert_handgcn_existing_colab.py\n" + layout_script, run)
), encoding="utf-8")
print(f"Created {script_path.relative_to(ROOT)}")
print(f"Created {notebook_path.relative_to(ROOT)}")
print(f"Created {text_path.relative_to(ROOT)}")
