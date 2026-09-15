"""Generate a standalone HandGCN converter, Colab notebook and pasteable text."""
from __future__ import annotations

import ast
import hashlib
import json
import subprocess
import textwrap
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DEST = ROOT / "scripts/alphabet/colab"
DEST.mkdir(exist_ok=True)

CHECKPOINT = "handgcn_alphabet_20260913_175720.pt"
SIDECAR = "handgcn_alphabet_20260913_175720.json"
MANIFEST = "deploy_manifest.json"
EXPECTED = {
    CHECKPOINT: "b891cb0d157de813ce0376eceb0935dc6cc3557f31c6fd513bfdfc3449726318",
    SIDECAR: "112c0e82c9df041af49390c399e231955ef4215877a742cb4b21e9723d31c99e",
    MANIFEST: "614076a89b1cde08b3238a8a6cdb9b3dde9169b2978f125c3340d9cc37160214",
}


def read(relative: str) -> str:
    return (ROOT / relative).read_text(encoding="utf-8")


source_names = (
    "VOYA-Collector/processed/train_utils/models/base.py",
    "VOYA-Collector/processed/train_utils/models/hd_gcn.py",
    "VOYA-Collector/processed/shared/normalization.py",
)
sources = {name: read(name) for name in source_names}
source_hashes = {name: hashlib.sha256(value.encode()).hexdigest() for name, value in sources.items()}
try:
    source_commit = subprocess.check_output(
        ["git", "-C", str(ROOT / "VOYA-Collector"), "rev-parse", "HEAD"], text=True
    ).strip()
except Exception:
    source_commit = "unknown"

core = r'''
import argparse
import hashlib
import importlib.metadata
import json
import platform
import sys
from pathlib import Path

STEM = "handgcn_alphabet_20260913_175720"
ATOL = 1e-4
RTOL = 1e-4


def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def write_json(path, value):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2, allow_nan=False) + "\n", encoding="utf-8")


def versions():
    result = {"python": sys.version, "platform": platform.platform()}
    for package in ("torch", "numpy", "litert-torch", "litert-converter", "torchao", "ai-edge-litert"):
        try:
            result[package] = importlib.metadata.version(package)
        except importlib.metadata.PackageNotFoundError:
            result[package] = None
    return result


def indexed(mapping, index):
    return mapping[index] if index in mapping else mapping[str(index)]


def load_checkpoint(path, metadata_path=None, manifest_path=None):
    path = Path(path).resolve()
    if sha(path) != EXPECTED_FILE_SHA256[STEM + ".pt"]:
        raise ValueError("Checkpoint SHA-256 differs from the reviewed HandGCN checkpoint")
    checkpoint = torch.load(path, map_location="cpu", weights_only=True)
    required = {
        "model_state_dict", "model_type", "model_config", "feature_dim", "seq_len", "num_classes",
        "idx_to_label", "label_to_idx", "normalization_version", "preprocess_contract",
    }
    if required - checkpoint.keys():
        raise ValueError(f"Checkpoint is missing metadata: {sorted(required - checkpoint.keys())}")
    if str(checkpoint["model_type"]).lower().replace("-", "").replace("_", "") not in {"handgcn", "hdgcn"}:
        raise ValueError(f"Expected HandGCN, got {checkpoint['model_type']!r}")
    if (checkpoint["seq_len"], checkpoint["feature_dim"], checkpoint["num_classes"]) != (60, 126, 30):
        raise ValueError("HandGCN checkpoint must be [60,126] with 30 classes")
    if checkpoint["normalization_version"] != "hands126_v1":
        raise ValueError("Unsupported normalization contract")
    contract = checkpoint["preprocess_contract"]
    if contract.get("expects_strict_shape") != [60, 126] or contract.get("coordinate_order") != "xyz":
        raise ValueError("Checkpoint preprocessing shape/order mismatch")

    config = dict(checkpoint["model_config"])
    if config.pop("model", "HandGCN") != "HandGCN":
        raise ValueError("model_config is not HandGCN")
    input_dim = int(config.pop("input_dim"))
    output_dim = int(config.pop("output_dim"))
    allowed = {"num_nodes", "gcn_channels", "num_gcn_layers", "temporal_channels", "dropout", "max_distance"}
    if set(config) != allowed:
        raise ValueError(f"Unexpected HandGCN config keys: {sorted(set(config) ^ allowed)}")
    model = HandGCNModel(input_dim=input_dim, output_dim=output_dim, **config).cpu().eval()
    model.load_state_dict(checkpoint["model_state_dict"], strict=True)
    if model.get_config() != checkpoint["model_config"]:
        raise ValueError("Resolved architecture differs from checkpoint model_config")

    rich = {i: indexed(checkpoint["idx_to_label"], i) for i in range(30)}
    labels = {str(i): str(rich[i]["label_original"]) for i in range(30)}
    if len(set(labels.values())) != 30 or len(checkpoint["label_to_idx"]) != 30:
        raise ValueError("Invalid label map")
    for i, entry in rich.items():
        if int(checkpoint["label_to_idx"][entry["label_key"]]) != i:
            raise ValueError(f"label_to_idx mismatch at class {i}")

    sidecar = None
    if metadata_path:
        metadata_path = Path(metadata_path).resolve()
        if sha(metadata_path) != EXPECTED_FILE_SHA256[STEM + ".json"]:
            raise ValueError("Training sidecar SHA-256 mismatch")
        sidecar = json.loads(metadata_path.read_text(encoding="utf-8"))
        if sidecar.get("config", {}).get("train_csv") != checkpoint.get("training_config", {}).get("train_csv"):
            raise ValueError("Training sidecar belongs to another run")
    manifest = None
    if manifest_path:
        manifest_path = Path(manifest_path).resolve()
        if sha(manifest_path) != EXPECTED_FILE_SHA256["deploy_manifest.json"]:
            raise ValueError("Deploy manifest SHA-256 mismatch")
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        if manifest.get("checkpoint", {}).get("sha256") != sha(path):
            raise ValueError("Deploy manifest points to another checkpoint")
        if manifest.get("model_config") != checkpoint["model_config"]:
            raise ValueError("Deploy manifest architecture mismatch")
        if [x["label_original"] for x in manifest["output"]["labels"]] != [labels[str(i)] for i in range(30)]:
            raise ValueError("Deploy manifest label order mismatch")
        if manifest.get("output", {}).get("activation") != "softmax":
            raise ValueError("Deploy manifest must request serving softmax")
    return checkpoint, model, labels, sidecar, manifest


def make_fixtures():
    raw = np.zeros((64, 60, 126), dtype=np.float32)
    names = []
    for sample in range(64):
        hands = raw[sample].reshape(60, 2, 21, 3)
        mode = sample % 4
        names.append(("left", "right", "both", "empty")[mode] + f"_{sample}")
        for hand in range(2):
            if mode == 3 or (mode == 0 and hand == 1) or (mode == 1 and hand == 0):
                continue
            phase = np.linspace(0, 2 * np.pi, 60, dtype=np.float32)[:, None]
            joint = np.arange(21, dtype=np.float32)[None, :]
            wrist_x = np.float32(0.25 + 0.45 * hand + 0.002 * sample)
            wrist_y = np.float32(0.55 - 0.001 * sample)
            hands[:, hand, :, 0] = wrist_x + (joint / 20 - .5) * (.18 + .03 * np.sin(phase + sample * .07))
            hands[:, hand, :, 1] = wrist_y + (joint % 5 / 4 - .5) * (.25 + .02 * np.cos(phase * 1.2))
            hands[:, hand, :, 2] = -.12 * joint / 20 + .015 * np.sin(phase + joint)
            hands[:, hand, 0, 0] = wrist_x
            hands[:, hand, 0, 1] = wrist_y
            hands[:, hand, 0, 2] = 0
        if sample % 7 == 0:
            hands[20:24] = 0
        if sample % 9 == 0:
            hands[35, :, 8:11] = 0
    normalized = np.stack([
        np.stack([normalize_hands_vector_126(frame) for frame in clip]) for clip in raw
    ]).astype(np.float32)
    if not np.isfinite(normalized).all():
        raise ValueError("Non-finite structured fixture")
    return names, raw, normalized


def read_test_data(path):
    if not path:
        return [], None, None
    data = np.load(path, allow_pickle=False)
    x = np.asarray(data["x"], dtype=np.float32)
    y = np.asarray(data["y"], dtype=np.int64)
    if x.ndim != 3 or x.shape[1:] != (60, 126) or y.shape != (len(x),) or not np.isfinite(x).all():
        raise ValueError("test_data.npz needs finite x [N,60,126] and y [N]")
    if np.any((y < 0) | (y >= 30)):
        raise ValueError("Test labels must be 0..29")
    ids = [str(v) for v in data["sample_ids"]] if "sample_ids" in data else [f"test_{i}" for i in range(len(x))]
    return ids, x, y


def predict_torch(model, x):
    values = []
    with torch.inference_mode():
        for clip in x:
            values.append(model(torch.from_numpy(clip[None])).cpu().numpy())
    return np.concatenate(values)


def compare(expected, actual, names):
    a = np.asarray(expected, np.float64)
    b = np.asarray(actual, np.float64)
    if a.shape != b.shape or not np.isfinite(a).all() or not np.isfinite(b).all():
        raise ValueError(f"Invalid parity tensors: {a.shape} vs {b.shape}")
    error = np.abs(a - b)
    relative = error / np.maximum(np.abs(a), 1e-6)
    changed = np.flatnonzero(a.argmax(-1) != b.argmax(-1))
    return {
        "sampleCount": len(a), "argmaxAgreement": float(1 - len(changed) / len(a)),
        "maxAbsoluteError": float(error.max()), "meanAbsoluteError": float(error.mean()),
        "maxRelativeError": float(relative.max()), "meanRelativeError": float(relative.mean()),
        "atol": ATOL, "rtol": RTOL, "allclose": bool(np.allclose(a, b, atol=ATOL, rtol=RTOL)),
        "changedArgmax": [{"sample": names[i], "pytorch": int(a[i].argmax()), "other": int(b[i].argmax())} for i in changed],
    }


def inspect_tflite(path):
    from ai_edge_litert.interpreter import Interpreter
    runtime = Interpreter(model_path=str(path), num_threads=4)
    runtime.allocate_tensors()
    inputs = runtime.get_input_details()
    outputs = runtime.get_output_details()
    if len(inputs) != 1 or len(outputs) != 1:
        raise ValueError("Expected exactly one TFLite input/output")
    tin, tout = inputs[0], outputs[0]
    for tensor, shape in ((tin, [1, 60, 126]), (tout, [1, 30])):
        if tensor["shape"].tolist() != shape or tensor["dtype"] != np.float32:
            raise ValueError("TFLite shape/dtype mismatch")
        if tensor["quantization"] != (0.0, 0) or len(tensor["quantization_parameters"]["scales"]):
            raise ValueError("Quantized tensor found; FP32 conversion required")
    signatures = runtime.get_signature_list()
    if len(signatures) > 1:
        raise ValueError("Expected zero or one signature")
    if signatures:
        signature_key, spec = next(iter(signatures.items()))
        if len(spec["inputs"]) != 1 or len(spec["outputs"]) != 1:
            raise ValueError("Signature must contain one input/output")
        input_key, output_key = spec["inputs"][0], spec["outputs"][0]
        runner = runtime.get_signature_runner(signature_key)
        predict = lambda x: runner(**{input_key: x})[output_key]
    else:
        signature_key, input_key, output_key = "", tin["name"], tout["name"]
        def predict(x):
            runtime.set_tensor(tin["index"], x)
            runtime.invoke()
            return runtime.get_tensor(tout["index"])
    metadata = {
        "signatures": signatures, "signatureKey": signature_key,
        "frameInputName": input_key, "outputName": output_key,
        "input": {"name": tin["name"], "shape": tin["shape"].tolist(), "dtype": str(tin["dtype"]), "quantization": list(tin["quantization"])},
        "output": {"name": tout["name"], "shape": tout["shape"].tolist(), "dtype": str(tout["dtype"]), "quantization": list(tout["quantization"])},
    }
    return runtime, metadata, predict


def edge_predict(edge, x):
    value = edge(x)
    if isinstance(value, (tuple, list)):
        if len(value) != 1:
            raise ValueError("Converted model returned multiple outputs")
        value = value[0]
    return np.asarray(value, dtype=np.float32)


def main():
    parser = argparse.ArgumentParser(description="Strict HandGCN checkpoint audit and FP32 LiteRT conversion")
    parser.add_argument("command", choices=("audit", "convert"))
    parser.add_argument("--checkpoint", default=STEM + ".pt")
    parser.add_argument("--metadata")
    parser.add_argument("--deploy-manifest")
    parser.add_argument("--test-data")
    parser.add_argument("--output-dir", required=True)
    args = parser.parse_args()
    out = Path(args.output_dir).resolve()
    if out.exists():
        raise FileExistsError(f"Refusing to reuse output directory: {out}")
    out.mkdir(parents=True)

    checkpoint, model, labels, sidecar, manifest = load_checkpoint(args.checkpoint, args.metadata, args.deploy_manifest)
    names, raw, x = make_fixtures()
    test_names, test_x, y = read_test_data(args.test_data)
    if test_x is not None:
        names += test_names
        x = np.concatenate([x, test_x])
    expected = predict_torch(model, x)
    sample = torch.from_numpy(x[:1])
    exported_program = torch.export.export(model, (sample,), strict=True)
    exported = []
    with torch.inference_mode():
        for clip in x:
            exported.append(exported_program.module()(torch.from_numpy(clip[None])).numpy())
    exported = np.concatenate(exported)
    report = {
        "versions": versions(), "checkpointSha256": sha(args.checkpoint),
        "checkpointModelType": checkpoint["model_type"], "checkpointGitCommit": checkpoint.get("git_commit"),
        "embeddedSourceCommit": EMBEDDED_SOURCE_COMMIT, "modelSourceSha256": MODEL_SOURCE_SHA256,
        "resolvedModelConfig": model.get_config(), "strictLoad": True,
        "normalizationVersion": checkpoint["normalization_version"], "preprocessContract": checkpoint["preprocess_contract"],
        "runPurpose": checkpoint.get("run_purpose"), "checkpointMetrics": checkpoint.get("metrics"),
        "sidecarVerified": sidecar is not None, "deployManifestVerified": manifest is not None,
        "fixtureCount": 64, "testDataCount": 0 if test_x is None else len(test_x),
        "torchExportParity": compare(expected, exported, names),
        "outputContract": "FP32 logits; Android/consumer applies stable softmax exactly once",
        "newConversionExecuted": False, "afterConvertParity": None, "serializedTfliteParity": None,
    }
    write_json(out / "report.json", report)
    write_json(out / "labels.json", labels)
    checkpoint_metadata = {k: v for k, v in checkpoint.items() if k != "model_state_dict"}
    write_json(out / "checkpoint.json", checkpoint_metadata)
    np.savez_compressed(out / "fixtures.npz", raw=raw, x=x[:64], pytorch_logits=expected[:64], sample_ids=np.asarray(names[:64]))
    raw.astype("<f4").tofile(out / "raw.f32")
    x[:64].astype("<f4").tofile(out / "input.f32")
    if args.command == "audit":
        report["auditPassed"] = report["torchExportParity"]["allclose"] and report["torchExportParity"]["argmaxAgreement"] == 1
        write_json(out / "report.json", report)
        print(json.dumps({"auditPassed": report["auditPassed"], "torchExportParity": report["torchExportParity"]}, indent=2))
        return

    try:
        import litert_torch
    except ImportError as exc:
        report["conversionBlocker"] = "litert_torch is unavailable; run conversion on Linux/Colab"
        write_json(out / "report.json", report)
        raise RuntimeError(report["conversionBlocker"]) from exc
    print("Converting HandGCN directly to FP32 logits...", flush=True)
    # LiteRT-Torch 0.9.4 requires sample_args to be a tuple of tensors.
    edge = litert_torch.convert(model.cpu().eval(), (sample,))
    converted = np.concatenate([edge_predict(edge, clip[None]) for clip in x])
    report["afterConvertParity"] = compare(expected, converted, names)
    binary = out / (STEM + "_verified_logits_fp32.tflite")
    edge.export(str(binary))
    report["newConversionExecuted"] = True
    _, metadata, predict = inspect_tflite(binary)
    actual = np.concatenate([predict(clip[None]) for clip in x])
    report["serializedTfliteParity"] = compare(expected, actual, names)
    report["convertVsReloadParity"] = compare(converted, actual, names)
    report["tfliteSha256"] = sha(binary)
    report["tfliteMetadata"] = metadata
    # A direct conversion must retain logits. A hidden Softmax would fail numerical parity above.
    checks = [report["torchExportParity"], report["afterConvertParity"], report["serializedTfliteParity"], report["convertVsReloadParity"]]
    report["pythonParityPassed"] = all(x["allclose"] and x["argmaxAgreement"] == 1 for x in checks)
    if test_x is not None:
        offset = 64
        report["accuracy"] = {
            "n": len(y), "pytorch": float((expected[offset:].argmax(-1) == y).mean()),
            "tflite": float((actual[offset:].argmax(-1) == y).mean()),
        }
    else:
        report["accuracy"] = None
    labels_name = STEM + "_verified_labels.json"
    write_json(out / labels_name, labels)
    write_json(out / "registry-entry.json", {
        "displayName": "HandGCN Alphabet FP32 logits (verified)", "modelFile": binary.name,
        "labelsFile": labels_name, "sequenceLength": 60, "featureDimension": 126, "classCount": 30,
        "signatureKey": metadata["signatureKey"], "frameInputName": metadata["frameInputName"],
        "lengthInputName": "", "outputName": metadata["outputName"],
        "inputTensorName": metadata["input"]["name"], "outputTensorName": metadata["output"]["name"],
        "applySoftmax": True, "mirrorInput": False, "swapHandedness": True,
        "normalizationVersion": "alphabet_hands126_v1", "sampleFps": 30, "numThreads": 4,
        "modelSha256": sha(binary), "labelsSha256": sha(out / labels_name), "outputType": "logits",
        "sourceCheckpointSha256": report["checkpointSha256"],
    })
    write_json(out / "golden.json", {
        "modelSha256": sha(binary), "checkpointSha256": report["checkpointSha256"], "sampleNames": names[:64],
        "shape": [64, 60, 126], "labels": labels, "pytorchLogits": expected[:64].tolist(),
        "tfliteLogits": actual[:64].tolist(), "rawSha256": sha(out / "raw.f32"),
        "inputSha256": sha(out / "input.f32"), "atol": ATOL, "rtol": RTOL,
    })
    write_json(out / "report.json", report)
    print(json.dumps({"pythonParityPassed": report["pythonParityPassed"], "serializedTfliteParity": report["serializedTfliteParity"], "accuracy": report["accuracy"]}, indent=2))
    if not report["pythonParityPassed"]:
        raise RuntimeError("PARITY FAILED: do not deploy this TFLite")


if __name__ == "__main__":
    main()
'''

parts = [
    "# Generated by scripts/alphabet/build_handgcn_colab.py.\n",
    "# Direct HandGCN -> FP32 logits; no retraining, quantization or output Softmax.\n",
    "from __future__ import annotations\n",
]
for name, source in sources.items():
    cleaned = source.replace("from __future__ import annotations\n", "")
    cleaned = cleaned.replace("from .base import SignLanguageModel, initialize_kaiming\n", "")
    parts.extend((f"\n# Original source: {name}\n", cleaned, "\n"))
parts.extend((
    "\nEXPECTED_FILE_SHA256 = " + repr(EXPECTED) + "\n",
    "MODEL_SOURCE_SHA256 = " + repr(source_hashes) + "\n",
    "EMBEDDED_SOURCE_COMMIT = " + repr(source_commit) + "\n",
    textwrap.dedent(core),
))
standalone = "".join(parts)
ast.parse(standalone)
script_path = DEST / "convert_handgcn_colab.py"
script_path.write_text(standalone, encoding="utf-8")


def markdown(value: str):
    return {"cell_type": "markdown", "metadata": {}, "source": value.splitlines(keepends=True)}


def cell(value: str):
    return {"cell_type": "code", "execution_count": None, "metadata": {}, "outputs": [], "source": value.splitlines(keepends=True)}


install = '''# Chỉ cài trong Colab/Linux; CPU đủ dùng.
import os, sys, subprocess
from pathlib import Path
assert sys.platform == "linux"
os.chdir("/content")
VENV = Path("/content/handgcn_converter_env")
if not (VENV / "bin/python").exists():
    subprocess.run([sys.executable, "-m", "venv", str(VENV)], check=False)
PYTHON = str(VENV / "bin/python")
if not (VENV / "bin/python").exists() or subprocess.run([PYTHON, "-m", "pip", "--version"], stdout=subprocess.DEVNULL).returncode:
    subprocess.run([sys.executable, "-m", "pip", "install", "virtualenv==20.35.3"], check=True)
    subprocess.run([sys.executable, "-m", "virtualenv", str(VENV)], check=True)
subprocess.run([PYTHON, "-m", "pip", "install", "--upgrade", "pip"], check=True)
subprocess.run([PYTHON, "-m", "pip", "install", "torch==2.11.0", "torchao==0.17.0", "--index-url", "https://download.pytorch.org/whl/cpu"], check=True)
subprocess.run([PYTHON, "-m", "pip", "install", "litert-torch==0.9.4", "litert-converter==0.4.0", "ai-edge-litert==2.2.0", "numpy==2.1.3", "torch==2.11.0", "torchao==0.17.0"], check=True)
print("Môi trường HandGCN conversion đã sẵn sàng.")
'''
upload = f'''from google.colab import files
from pathlib import Path
import hashlib, os
os.chdir("/content")
required = {{
    "{CHECKPOINT}": "{EXPECTED[CHECKPOINT]}",
    "{SIDECAR}": "{EXPECTED[SIDECAR]}",
    "{MANIFEST}": "{EXPECTED[MANIFEST]}",
}}
if any(not Path(name).exists() for name in required):
    print("Chọn cùng lúc checkpoint, sidecar JSON và deploy_manifest.json.")
    files.upload()
for name, expected in required.items():
    path = Path(name)
    assert path.exists(), f"Thiếu {{name}}"
    assert hashlib.sha256(path.read_bytes()).hexdigest() == expected, f"SHA-256 sai: {{name}}"
print("Ba artifact đúng hash.")
TEST_DATA = Path("/content/test_data.npz")
'''
run = f'''import datetime, json, shutil, subprocess
from pathlib import Path
from google.colab import files
RUN = Path("/content") / ("handgcn_export_" + datetime.datetime.now().strftime("%Y%m%d_%H%M%S_%f"))
LOG = Path(str(RUN) + ".log")
cmd = [PYTHON, "/content/convert_handgcn_colab.py", "convert",
       "--checkpoint", "/content/{CHECKPOINT}", "--metadata", "/content/{SIDECAR}",
       "--deploy-manifest", "/content/{MANIFEST}", "--output-dir", str(RUN)]
if TEST_DATA.exists(): cmd += ["--test-data", str(TEST_DATA)]
with LOG.open("w", encoding="utf-8") as log:
    process = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, encoding="utf-8", errors="replace", bufsize=1)
    for line in process.stdout:
        print(line, end=""); log.write(line)
    exit_code = process.wait()
RUN.mkdir(exist_ok=True)
shutil.copyfile(LOG, RUN / "conversion.log")
with (RUN / "requirements-frozen.txt").open("w") as f:
    subprocess.run([PYTHON, "-m", "pip", "freeze"], stdout=f, check=True)
report_path = RUN / "report.json"
report = json.loads(report_path.read_text(encoding="utf-8")) if report_path.exists() else {{}}
passed = exit_code == 0 and report.get("pythonParityPassed") is True and report.get("newConversionExecuted") is True
status = "PASS" if passed else "FAILED"
print(status, json.dumps(report.get("serializedTfliteParity"), indent=2))
archive = shutil.make_archive(str(RUN) + "_" + status, "zip", root_dir=RUN)
print("Gửi lại ZIP:", Path(archive).name)
files.download(archive)
'''
notebook = {
    "nbformat": 4,
    "nbformat_minor": 5,
    "metadata": {"colab": {"name": "Convert_HandGCN_FP32_Logits.ipynb"}, "kernelspec": {"display_name": "Python 3", "language": "python", "name": "python3"}},
    "cells": [
        markdown("# HandGCN → TFLite FP32 logits\n\nChạy **Runtime → Run all**, upload ba artifact khi được hỏi. Notebook strict-load checkpoint, export, convert và kiểm tra 64 chuỗi. Output là logits; consumer Softmax đúng một lần. Không retrain/quantize.\n"),
        cell(install), cell(upload),
        markdown("## Converter độc lập đã nhúng đúng source `hd_gcn.py`\n"),
        cell("%%writefile /content/convert_handgcn_colab.py\n" + standalone),
        cell(run),
    ],
}
for index, notebook_cell in enumerate(notebook["cells"]):
    notebook_cell["id"] = f"handgcn-{index:02d}"
    if notebook_cell["cell_type"] == "code":
        source = "".join(notebook_cell["source"])
        if source.startswith("%%writefile"):
            source = source.split("\n", 1)[1]
        ast.parse(source)
notebook_path = DEST / "Convert_HandGCN_FP32_Logits.ipynb"
notebook_path.write_text(json.dumps(notebook, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

pasteable = "\n\n====================================================================\n".join(
    (install, upload, "%%writefile /content/convert_handgcn_colab.py\n" + standalone, run)
)
text_path = DEST / "LiteRT HandGCN Conversion.txt"
text_path.write_text(pasteable, encoding="utf-8")
print(f"Created {script_path.relative_to(ROOT)}")
print(f"Created {notebook_path.relative_to(ROOT)}")
print(f"Created {text_path.relative_to(ROOT)}")
