"""Validate a returned HandGCN Colab ZIP and stage alphabet-only Android assets."""
from __future__ import annotations

import argparse
import hashlib
import io
import json
from pathlib import Path
import shutil
import zipfile

import numpy as np


ROOT = Path(__file__).resolve().parents[2]
ASSETS = ROOT / "android/app/src/main/assets"
TEST_ASSETS = ROOT / "android/app/src/androidTest/assets/alphabet"
STEM = "handgcn_alphabet_20260913_175720"
CHECKPOINT_SHA256 = "b891cb0d157de813ce0376eceb0935dc6cc3557f31c6fd513bfdfc3449726318"


def digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def write_json(path: Path, value: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--zip", required=True)
    parser.add_argument("--output-dir", required=True)
    parser.add_argument("--activate", action="store_true")
    args = parser.parse_args()

    archive_path = Path(args.zip).resolve()
    output_dir = (ROOT / args.output_dir).resolve()
    if output_dir.exists():
        raise FileExistsError(f"Use a new output directory: {output_dir}")

    archive = archive_path.read_bytes()
    with zipfile.ZipFile(io.BytesIO(archive)) as zipped:
        entries = zipped.infolist()
        names = [entry.filename for entry in entries]
        if len(names) != len(set(names)):
            raise ValueError("Duplicate ZIP entries")
        if any(Path(name).name != name or name.startswith(("/", "\\")) for name in names):
            raise ValueError("ZIP must contain flat artifact names only")
        if sum(entry.file_size for entry in entries) > 100_000_000:
            raise ValueError("Expanded ZIP is too large")
        payload = {entry.filename: zipped.read(entry) for entry in entries}

    required = {
        "checkpoint.json", "registry-entry.json", "raw.f32", "input.f32",
        "requirements-frozen.txt", "labels.json", "golden.json", "report.json",
        "conversion.log", "fixtures.npz",
        f"{STEM}_verified_logits_fp32.tflite", f"{STEM}_verified_labels.json",
    }
    if set(payload) != required:
        raise ValueError(f"Unexpected ZIP layout: missing={sorted(required - set(payload))}, extra={sorted(set(payload) - required)}")

    report = json.loads(payload["report.json"])
    entry = json.loads(payload["registry-entry.json"])
    golden = json.loads(payload["golden.json"])
    labels = json.loads(payload["labels.json"])
    model_name = f"{STEM}_verified_logits_fp32.tflite"
    labels_name = f"{STEM}_verified_labels.json"
    model_blob = payload[model_name]

    if report.get("checkpointSha256") != CHECKPOINT_SHA256 or entry.get("sourceCheckpointSha256") != CHECKPOINT_SHA256:
        raise ValueError("Checkpoint identity mismatch")
    if not all((report.get("strictLoad"), report.get("sidecarVerified"), report.get("deployManifestVerified"),
                report.get("newConversionExecuted"), report.get("pythonParityPassed"))):
        raise ValueError("Colab conversion did not pass every identity/parity gate")
    for stage in ("torchExportParity", "afterConvertParity", "serializedTfliteParity", "convertVsReloadParity"):
        result = report.get(stage) or {}
        if not result.get("allclose") or result.get("argmaxAgreement") != 1 or result.get("changedArgmax"):
            raise ValueError(f"Parity failed at {stage}")

    model_sha = digest(model_blob)
    labels_sha = digest(payload[labels_name])
    if len(model_blob) != 566_460:
        raise ValueError("Unexpected HandGCN TFLite size")
    if model_sha != report.get("tfliteSha256") or model_sha != entry.get("modelSha256") or model_sha != golden.get("modelSha256"):
        raise ValueError("TFLite SHA-256 mismatch")
    if payload[labels_name] != payload["labels.json"] or labels_sha != entry.get("labelsSha256"):
        raise ValueError("Labels mismatch")
    if labels != golden.get("labels") or set(labels) != {str(i) for i in range(30)} or len(set(labels.values())) != 30:
        raise ValueError("Invalid class mapping")
    if digest(payload["raw.f32"]) != golden.get("rawSha256") or digest(payload["input.f32"]) != golden.get("inputSha256"):
        raise ValueError("Fixture SHA-256 mismatch")

    raw = np.frombuffer(payload["raw.f32"], dtype="<f4").reshape(-1, 60, 126)
    normalized = np.frombuffer(payload["input.f32"], dtype="<f4").reshape(-1, 60, 126)
    sample_names = golden.get("sampleNames", [])
    if raw.shape != (64, 60, 126) or normalized.shape != raw.shape or golden.get("shape") != list(raw.shape) or len(sample_names) != 64:
        raise ValueError("Fixture shape mismatch")
    with np.load(io.BytesIO(payload["fixtures.npz"]), allow_pickle=False) as fixture:
        np.testing.assert_array_equal(fixture["raw"], raw)
        np.testing.assert_array_equal(fixture["x"], normalized)
        np.testing.assert_array_equal(fixture["sample_ids"], np.asarray(sample_names))
        np.testing.assert_allclose(fixture["pytorch_logits"], golden["pytorchLogits"], atol=0, rtol=0)
        if "tflite_logits" in fixture.files:
            np.testing.assert_allclose(fixture["tflite_logits"], golden["tfliteLogits"], atol=0, rtol=0)

    expected_metadata = {
        "signatureKey": "serving_default", "frameInputName": "args_0", "outputName": "output_0",
        "inputTensorName": "serving_default_args_0", "outputTensorName": "serving_default_output_0_output",
        "sequenceLength": 60, "featureDimension": 126, "classCount": 30,
        "applySoftmax": True, "mirrorInput": False, "swapHandedness": True,
        "normalizationVersion": "alphabet_hands126_v1", "sampleFps": 30, "outputType": "logits",
    }
    for key, expected in expected_metadata.items():
        if entry.get(key) != expected:
            raise ValueError(f"Registry contract mismatch for {key}: {entry.get(key)!r}")

    output_dir.mkdir(parents=True)
    for name, data in payload.items():
        (output_dir / name).write_bytes(data)

    model_id = f"{STEM}_colab_{model_sha[:8]}_fp32"
    # Colab fixtures use the checkpoint's anatomical [Left, Right] layout. The
    # app camera deliberately serializes [MediaPipe Left, MediaPipe Right], then
    # AlphabetPreprocessing swaps once. Swap fixture blocks here to exercise the
    # same raw-camera contract in the Android end-to-end test.
    android_raw = raw.reshape(-1, 60, 2, 63)[:, :, ::-1, :].copy().reshape(-1, 60, 126)
    android_raw_bytes = android_raw.astype("<f4", copy=False).tobytes()
    android_golden = dict(golden)
    android_golden.update(rawSha256=digest(android_raw_bytes), rawSampleCount=len(android_raw),
                          rawLayout="MediaPipe slots; AlphabetPreprocessing swaps once")
    audit = {
        "zipSha256": digest(archive), "modelId": model_id, "modelSha256": model_sha,
        "labelsSha256": labels_sha, "checkpointSha256": CHECKPOINT_SHA256,
        "fixtureCount": len(sample_names), "serializedTfliteParity": report["serializedTfliteParity"],
        "androidRawSha256": android_golden["rawSha256"], "activated": False,
    }

    if args.activate:
        registry_path = ASSETS / "tflite_models.json"
        registry_before = registry_path.read_bytes()
        registry = json.loads(registry_before)
        word_before = registry["modes"].get("word")
        target_model = f"{model_id}.tflite"
        target_labels = f"{STEM}_colab_{model_sha[:8]}_labels.json"
        if model_id in registry["models"] or (ASSETS / target_model).exists() or (ASSETS / target_labels).exists():
            raise FileExistsError("HandGCN deployment target already exists")
        staged_entry = dict(entry)
        staged_entry.update(modelFile=target_model, labelsFile=target_labels)
        (ASSETS / target_model).write_bytes(model_blob)
        (ASSETS / target_labels).write_bytes(payload["labels.json"])
        registry["models"][model_id] = staged_entry
        registry["modes"]["alphabet"] = model_id
        if registry["modes"].get("word") != word_before:
            raise AssertionError("Word mode changed during alphabet deployment")
        (output_dir / "registry-before-import.json").write_bytes(registry_before)
        write_json(registry_path, registry)
        TEST_ASSETS.mkdir(parents=True, exist_ok=True)
        (TEST_ASSETS / "raw.f32").write_bytes(android_raw_bytes)
        (TEST_ASSETS / "input.f32").write_bytes(payload["input.f32"])
        write_json(TEST_ASSETS / "golden.json", android_golden)
        audit.update(activated=True, modelFile=target_model, labelsFile=target_labels,
                     alphabetMode=model_id, wordMode=word_before)

    write_json(output_dir / "local-audit.json", audit)
    print(json.dumps(audit, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
