"""Audit a returned Colab ZIP as data, recheck local parity, then stage alphabet only.

No conversion dependencies are installed. Existing model binaries/entries are preserved.
"""
from __future__ import annotations

import argparse
import hashlib
import io
import json
from pathlib import Path
import shutil
import sys
import zipfile

sys.path.insert(0, str(Path(__file__).resolve().parent))
import deploy
import numpy as np
import torch


def digest(data: bytes):
    return hashlib.sha256(data).hexdigest()


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--zip", required=True, help="User-provided result ZIP; read only")
    p.add_argument("--output-dir", required=True, help="New workspace directory for audited results")
    p.add_argument("--activate", action="store_true", help="Stage alphabet assets/registry/test fixtures after local parity passes")
    args = p.parse_args()
    out = deploy.local(args.output_dir)
    if out.exists():
        raise FileExistsError(f"Use a new audit output directory: {out}")
    blob = Path(args.zip).read_bytes()
    allowed = {"checkpoint.json", "registry-entry.json", "raw.f32", "input.f32", "requirements-frozen.txt",
               "labels.json", "golden.json", "report.json", "conversion.log", "fixtures.npz",
               f"{deploy.STEM}_verified_fp32.tflite", f"{deploy.STEM}_verified_labels.json"}
    with zipfile.ZipFile(io.BytesIO(blob)) as z:
        entries = z.infolist()
        if len({i.filename for i in entries}) != len(entries):
            raise ValueError("Duplicate ZIP entries")
        if {i.filename for i in entries} != allowed or sum(i.file_size for i in entries) > 100_000_000:
            raise ValueError("Unexpected ZIP layout or excessive expanded size")
        payload = {i.filename: z.read(i) for i in entries}
    report = json.loads(payload["report.json"])
    golden = json.loads(payload["golden.json"])
    entry = json.loads(payload["registry-entry.json"])
    contract = json.loads((deploy.ROOT / "scripts/alphabet/deployment_contract.json").read_text(encoding="utf-8"))
    if report["contract"] != contract or report["checkpointSha256"] != contract["checkpointSha256"]:
        raise ValueError("Colab contract/checkpoint mismatch")
    if not report["strictLoad"] or not report["newConversionExecuted"] or not report["pythonParityPassed"]:
        raise ValueError("Colab did not successfully convert/verify the model")
    for stage in ("torchExportParity", "afterConvertParity", "serializedTfliteParity", "convertVsReloadParity"):
        result = report[stage]
        if not result["allclose"] or result["argmaxAgreement"] != 1 or result["changedArgmax"]:
            raise ValueError(f"Colab parity failed at {stage}")
    for name, expected in report["modelSourceSha256"].items():
        normalized_text = deploy.local(name).read_text(encoding="utf-8")
        if digest(normalized_text.encode()) != expected:
            raise ValueError(f"Model source mismatch: {name}")
    torch.set_num_threads(4)
    torch.manual_seed(42)
    checkpoint, model, labels = deploy.load_checkpoint(deploy.ROOT / f"{deploy.STEM}.pt", contract)
    if json.loads(payload["checkpoint.json"]) != json.loads(json.dumps({k: v for k, v in checkpoint.items() if k != "model_state_dict"})):
        raise ValueError("Returned checkpoint metadata differs from local checkpoint")
    if json.loads(payload["labels.json"]) != labels or golden["labels"] != labels:
        raise ValueError("Returned class mapping differs from checkpoint")
    if payload["labels.json"] != payload[f"{deploy.STEM}_verified_labels.json"]:
        raise ValueError("Label files disagree")
    model_blob = payload[f"{deploy.STEM}_verified_fp32.tflite"]
    model_sha = digest(model_blob)
    if not model_sha == report["tfliteSha256"] == golden["modelSha256"] == entry["modelSha256"]:
        raise ValueError("TFLite hash mismatch")
    if digest(payload["labels.json"]) != entry["labelsSha256"]:
        raise ValueError("Labels hash mismatch")
    for filename, key in (("raw.f32", "rawSha256"), ("input.f32", "inputSha256")):
        if digest(payload[filename]) != golden[key]:
            raise ValueError(f"Golden input hash mismatch: {filename}")
    names = golden["sampleNames"]
    x = np.frombuffer(payload["input.f32"], dtype="<f4").reshape(-1, 60, 126).copy()
    raw = np.frombuffer(payload["raw.f32"], dtype="<f4").reshape(-1, 60, 126).copy()
    expected_names, expected_raw, expected_x = deploy.fixtures(contract)
    assert golden["shape"] == list(x.shape) and len(names) == len(x)
    assert names[:len(expected_names)] == expected_names and golden["rawSampleCount"] == len(expected_raw)
    np.testing.assert_allclose(raw, expected_raw, atol=2e-6, rtol=2e-6)
    np.testing.assert_allclose(x[:len(expected_x)], expected_x, atol=2e-6, rtol=2e-6)
    with np.load(io.BytesIO(payload["fixtures.npz"]), allow_pickle=False) as fixture:
        np.testing.assert_array_equal(fixture["x"], x)
        np.testing.assert_array_equal(fixture["raw"], raw)
        np.testing.assert_array_equal(fixture["sample_ids"], np.array(names))
        np.testing.assert_allclose(fixture["pytorch_logits"], golden["pytorchLogits"], atol=0, rtol=0)
        np.testing.assert_allclose(fixture["tflite_logits"], golden["tfliteLogits"], atol=0, rtol=0)
    out.mkdir(parents=True)
    # Explicit flat names only; never execute code or follow archive-supplied paths.
    for name, data in payload.items():
        (out / name).write_bytes(data)
    runtime, metadata, predict = deploy.interpreter(out / f"{deploy.STEM}_verified_fp32.tflite")
    assert metadata == report["tfliteMetadata"]
    tensors = runtime.get_tensor_details()
    assert all(t["dtype"] == np.float32 for t in tensors if np.dtype(t["dtype"]).kind == "f")
    assert all(len(t["quantization_parameters"]["scales"]) == 0 for t in tensors)
    with torch.inference_mode():
        pt_logits = np.concatenate([model(torch.from_numpy(clip[None])).numpy() for clip in x])
    lite_logits = np.concatenate([predict(clip[None]) for clip in x])
    checks = {
        "localTfliteVsLocalPytorch": deploy.compare(pt_logits, lite_logits, names),
        "localTfliteVsColabPytorch": deploy.compare(golden["pytorchLogits"], lite_logits, names),
        "localTfliteVsColabTflite": deploy.compare(golden["tfliteLogits"], lite_logits, names),
    }
    audit = {"zipSha256": digest(blob), "modelSha256": model_sha, "checkpointSha256": report["checkpointSha256"],
             "versions": deploy.versions(), "checks": checks, "floatTensorsAreFp32": True,
             "quantizedTensorCount": 0, "labelsVerified": 30, "tensorCount": len(tensors), "activated": False}
    deploy.write_json(out / "local-audit.json", audit)
    if not all(c["allclose"] and c["argmaxAgreement"] == 1 for c in checks.values()):
        raise ValueError("Local parity failed; alphabet assets remain unchanged")
    if args.activate:
        registry_path = deploy.ASSETS / "tflite_models.json"
        before_bytes = registry_path.read_bytes()
        registry = json.loads(before_bytes)
        model_id = f"{deploy.STEM}_colab_{model_sha[:8]}_fp32"
        new_entry = dict(entry)
        new_entry.update(modelFile=f"{model_id}.tflite", labelsFile=f"{deploy.STEM}_colab_{model_sha[:8]}_labels.json")
        # Use local known contract and actual interpreter metadata for deployment.
        for key in ("swapHandedness", "mirrorInput", "normalizationVersion", "sampleFps"):
            assert new_entry[key] == contract[key]
        assert new_entry["outputType"] == "logits" and new_entry["applySoftmax"] is True
        assert (new_entry["sequenceLength"], new_entry["featureDimension"], new_entry["classCount"]) == (60, 126, 30)
        assert new_entry["signatureKey"] == metadata["signatureKey"]
        assert new_entry["frameInputName"] == metadata["frameInputName"] and new_entry["outputName"] == metadata["outputName"]
        assert new_entry["inputTensorName"] == metadata["input"]["name"] and new_entry["outputTensorName"] == metadata["output"]["name"]
        for key in ("modelFile", "labelsFile"):
            if (deploy.ASSETS / new_entry[key]).exists():
                raise FileExistsError("New model/labels already exist; refusing to overwrite")
        if model_id in registry["models"]:
            raise ValueError("Registry entry already exists")
        (out / "registry-before-import.json").write_bytes(before_bytes)
        old_fixtures = out / "android-fixtures-before-import"
        old_fixtures.mkdir()
        test_assets = deploy.ROOT / "android/app/src/androidTest/assets/alphabet"
        for name in ("raw.f32", "input.f32", "golden.json"):
            shutil.copyfile(test_assets / name, old_fixtures / name)
        (deploy.ASSETS / new_entry["modelFile"]).write_bytes(model_blob)
        (deploy.ASSETS / new_entry["labelsFile"]).write_bytes(payload["labels.json"])
        registry["models"][model_id] = new_entry
        registry["modes"]["alphabet"] = model_id
        deploy.write_json(registry_path, registry)
        for name in ("raw.f32", "input.f32", "golden.json"):
            (test_assets / name).write_bytes(payload[name])
        audit.update(activated=True, modelId=model_id, modelFile=new_entry["modelFile"], labelsFile=new_entry["labelsFile"])
        deploy.write_json(out / "local-audit.json", audit)
    print(json.dumps(audit, indent=2))


if __name__ == "__main__":
    main()
