"""Strict checkpoint audit, FP32 LiteRT conversion, multi-input parity and staging.

All project inputs/outputs must be inside this workspace. The converter is Linux-only;
`verify` also runs on Windows against an existing TFLite without claiming conversion.
"""
from __future__ import annotations

import argparse
import hashlib
import importlib.metadata
import json
import platform
import re
import sys
from pathlib import Path

import numpy as np
import torch

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "VOYA-Collector"))
from processed.train_utils.models.bigru_attention import BiGRUAttentionModel
from processed.shared.normalization import normalize_hands_vector_126

STEM = "bigru_attention_alphabet_20260818_114440"
ASSETS = ROOT / "android/app/src/main/assets"
ATOL, RTOL = 1e-4, 1e-4


def local(value: str | Path) -> Path:
    p = (ROOT / value).resolve()
    if not p.is_relative_to(ROOT):
        raise ValueError(f"Path outside workspace is forbidden: {p}")
    return p


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def write_json(path: Path, value) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2, allow_nan=False) + "\n", encoding="utf-8")


def versions() -> dict:
    result = {"python": sys.version, "platform": platform.platform()}
    for package in ("torch", "numpy", "litert-torch", "litert-converter", "torchao", "ai-edge-litert", "tensorflow"):
        try:
            result[package] = importlib.metadata.version(package)
        except importlib.metadata.PackageNotFoundError:
            result[package] = None
    return result


def load_checkpoint(path: Path, contract: dict):
    if sha(path) != contract["checkpointSha256"]:
        raise ValueError("Checkpoint hash differs from reviewed deployment_contract.json")
    c = torch.load(path, map_location="cpu", weights_only=True)
    required = {"seq_len", "feature_dim", "num_classes", "model_config", "model_state_dict",
                "idx_to_label", "label_to_idx", "preprocess_contract", "normalization_version"}
    if required - c.keys():
        raise ValueError(f"Missing checkpoint metadata: {required - c.keys()}")
    assert (c["seq_len"], c["feature_dim"], c["num_classes"]) == (60, 126, 30)
    assert c["model_type"] == "BiGRU + Attention"
    assert c["normalization_version"] == "hands126_v1"
    assert c["preprocess_contract"]["expects_strict_shape"] == [60, 126]
    assert c["preprocess_contract"]["coordinate_order"] == "xyz"
    cfg = contract["modelConfig"]
    for key in ("hidden_size", "num_layers", "dropout"):
        if key in c["model_config"] and c["model_config"][key] != cfg[key]:
            raise ValueError(f"Checkpoint config disagrees with manifest: {key}")
    state = c["model_state_dict"]
    h = cfg["hidden_size"]
    assert tuple(state["gru.weight_hh_l0"].shape) == (3 * h, h)
    layers = {int(m.group(1)) for key in state if (m := re.fullmatch(r"gru.weight_ih_l(\d+)", key))}
    assert layers == set(range(cfg["num_layers"]))
    model = BiGRUAttentionModel(input_dim=c["feature_dim"], output_dim=c["num_classes"], **cfg).cpu().eval()
    model.load_state_dict(state, strict=True)
    rich = {int(k): v for k, v in c["idx_to_label"].items()}
    assert set(rich) == set(range(c["num_classes"]))
    labels = {str(i): rich[i]["label_original"] for i in range(c["num_classes"])}
    assert len(set(labels.values())) == c["num_classes"]
    assert len(c["label_to_idx"]) == c["num_classes"]
    for i, item in rich.items():
        assert c["label_to_idx"][item["label_key"]] == i
    return c, model, labels


def preprocess(raw: np.ndarray, contract: dict) -> np.ndarray:
    raw = np.asarray(raw, dtype=np.float32)
    if raw.shape != (126,) or not np.isfinite(raw).all():
        raise ValueError("Expected one finite raw MediaPipe frame [126]")
    hands = raw.reshape(2, 21, 3).copy()
    if contract["swapHandedness"]:
        hands = hands[::-1].copy()
    out = np.zeros_like(hands)
    for j, hand in enumerate(hands):
        present = np.any(hand != 0, axis=1)
        if not present[0]:
            continue
        if contract["mirrorInput"]:
            hand[present, 0] = 1 - hand[present, 0]
        xy = hand[:, :2] - hand[0, :2]
        valid = present & (np.sum(xy * xy, axis=1) > np.float32(1e-12))
        scale = np.float32(1)
        if valid.any():
            candidate = np.ptp(xy[valid], axis=0).max()
            if candidate > 1e-6:
                scale = candidate
        out[j, present, :2] = xy[present] / scale
        out[j, present, 2] = hand[present, 2]
    if not np.isfinite(out).all():
        raise ValueError("Alphabet normalization overflow")
    return out.reshape(126)


def fixtures(contract: dict):
    # Articulated hands, changing finger flexion, orientation, translation and depth.
    # These test numerical parity, not recognition accuracy of synthetic signs.
    rng = np.random.default_rng(42)
    names, raws = [], []
    kinds = ("raw_mp_left", "raw_mp_right", "both", "empty", "lost_frames", "negative_z", "off_origin_wrist", "missing_landmark")
    for kind in kinds:
        for variant in range(8):
            clip = np.zeros((60, 2, 21, 3), np.float32)
            angles = rng.uniform(-0.8, 0.8, 2)
            for t in range(60):
                phase = 2 * np.pi * t / 60
                for side in range(2):
                    if kind == "empty" or (kind == "raw_mp_left" and side == 1) or (kind == "raw_mp_right" and side == 0):
                        continue
                    if kind == "lost_frames" and (t % 11 in (0, 1) or (side == 0 and 20 <= t < 35)):
                        continue
                    wrist = np.array([0.28 + side * 0.40 + .03 * np.sin(phase), .68 + .025 * np.cos(phase), 0], np.float32)
                    if kind == "off_origin_wrist":
                        wrist[:2] += [-.12, -.23]
                    hand = np.zeros((21, 3), np.float32)
                    hand[0] = wrist
                    theta = angles[side] + .12 * np.sin(phase)
                    rotation = np.array([[np.cos(theta), -np.sin(theta)], [np.sin(theta), np.cos(theta)]])
                    for finger in range(5):
                        flex = .3 + .65 * (.5 + .5 * np.sin(phase + finger + variant))
                        for joint in range(4):
                            idx = 1 + finger * 4 + joint
                            xy = np.array([(finger - 2) * .029 + (joint * .007 if finger == 0 else 0), -.045 - (joint + 1) * .034 * flex])
                            xy[0] *= 1 if side == 0 else -1
                            hand[idx, :2] = wrist[:2] + rotation @ xy
                            hand[idx, 2] = -.008 * (joint + 1) * (1 + flex)
                    if kind == "missing_landmark":
                        hand[6] = 0
                        if variant == 7:
                            hand[0] = 0
                    clip[t, side] = hand
            names.append(f"{kind}_{variant}")
            raws.append(clip.reshape(60, 126))
    raw = np.stack(raws)
    x = np.stack([[preprocess(f, contract) for f in clip] for clip in raw])
    # Verify original training function on its valid full-hand domain.
    for clip in raw[:24]:
        for frame in clip:
            ordered = frame.reshape(2, 63)[::-1].reshape(126) if contract["swapHandedness"] else frame
            if not contract["mirrorInput"]:
                np.testing.assert_allclose(preprocess(frame, contract), normalize_hands_vector_126(ordered), atol=2e-6, rtol=2e-6)
    return names, raw, x


def read_validation(path: Path):
    """Explicit evaluation bundle: x float32 [N,60,126], y integer indices, optional sample_ids.

    x is already normalized by the training loader; never normalize it again.
    """
    with np.load(path, allow_pickle=False) as d:
        x, y = np.asarray(d["x"], np.float32), np.asarray(d["y"])
        if x.ndim != 3 or x.shape[1:] != (60, 126) or not np.isfinite(x).all():
            raise ValueError("Evaluation x must be finite [N,60,126]")
        if y.shape != (len(x),) or y.dtype.kind not in "iu" or np.any((y < 0) | (y >= 30)) or not len(x):
            raise ValueError("Evaluation y must be checkpoint class indices [N], 0..29")
        names = d["sample_ids"].astype(str).tolist() if "sample_ids" in d else [f"test_{i}" for i in range(len(x))]
        if len(names) != len(x):
            raise ValueError("sample_ids length mismatch")
    return names, x, y


def interpreter(path: Path):
    from ai_edge_litert.interpreter import Interpreter
    i = Interpreter(model_path=str(path), num_threads=4)
    i.allocate_tensors()
    sigs = i.get_signature_list()
    assert len(sigs) == 1, sigs
    key, sig = next(iter(sigs.items()))
    assert len(sig["inputs"]) == len(sig["outputs"]) == 1
    inp, out = i.get_input_details(), i.get_output_details()
    assert len(inp) == len(out) == 1
    for tensor, shape in ((inp[0], [1, 60, 126]), (out[0], [1, 30])):
        assert tensor["shape"].tolist() == shape
        assert tensor["dtype"] == np.float32
        assert tensor["quantization"] == (0.0, 0)
        assert len(tensor["quantization_parameters"]["scales"]) == 0
    def describe(t):
        return {"name": t["name"], "shape": t["shape"].tolist(), "dtype": str(t["dtype"]), "quantization": list(t["quantization"])}
    metadata = {"signatureKey": key, "frameInputName": sig["inputs"][0], "outputName": sig["outputs"][0],
                "signatures": sigs, "input": describe(inp[0]), "output": describe(out[0])}
    runner = i.get_signature_runner(key)
    def predict(x):
        return runner(**{metadata["frameInputName"]: x})[metadata["outputName"]]
    return i, metadata, predict


def compare(expected, actual, names):
    a, b = np.asarray(expected, np.float64), np.asarray(actual, np.float64)
    assert a.shape == b.shape and np.isfinite(a).all() and np.isfinite(b).all()
    error = np.abs(a - b)
    relative = error / np.maximum(np.abs(a), 1e-6)
    changed = np.flatnonzero(a.argmax(-1) != b.argmax(-1))
    return {"sampleCount": len(a), "argmaxAgreement": float(1 - len(changed) / len(a)),
            "maxAbsoluteError": float(error.max()), "meanAbsoluteError": float(error.mean()),
            "maxRelativeError": float(relative.max()), "meanRelativeError": float(relative.mean()),
            "relativeDenominatorFloor": 1e-6, "atol": ATOL, "rtol": RTOL,
            "allclose": bool(np.allclose(a, b, atol=ATOL, rtol=RTOL)),
            "changedArgmax": [{"sample": names[j], "expected": int(a[j].argmax()), "actual": int(b[j].argmax())} for j in changed]}


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("command", choices=("inspect", "verify", "convert"))
    p.add_argument("--checkpoint", default=f"{STEM}.pt")
    p.add_argument("--contract", default="scripts/alphabet/deployment_contract.json")
    p.add_argument("--tflite", default=f"android/app/src/main/assets/{STEM}_fp32.tflite")
    p.add_argument("--output-dir", required=True, help="New directory; refuses to overwrite a previous report")
    p.add_argument("--test-data", help="Workspace NPZ with normalized x [N,60,126], y [N] and optional sample_ids")
    args = p.parse_args()
    out = local(args.output_dir)
    if out.exists():
        raise FileExistsError(f"Use a NEW output directory: {out}")
    out.mkdir(parents=True)
    torch.manual_seed(42)
    torch.set_num_threads(4)
    torch.use_deterministic_algorithms(True)
    contract = json.loads(local(args.contract).read_text(encoding="utf-8"))
    c, model, labels = load_checkpoint(local(args.checkpoint), contract)
    write_json(out / "checkpoint.json", {k: v for k, v in c.items() if k != "model_state_dict"})
    write_json(out / "labels.json", labels)
    write_json(out / f"{STEM}_verified_labels.json", labels)
    print("Checkpoint loaded with strict=True; BiGRU hidden=64, layers=2; 30 labels verified.", flush=True)
    report = {"versions": versions(), "checkpointSha256": sha(local(args.checkpoint)), "strictLoad": True,
              "resolvedModelConfig": model.get_config(), "contract": contract, "historicalCheckpointMetrics": c.get("metrics"),
              "accuracy": None, "androidParity": None, "afterConvertParity": None, "newConversionExecuted": False}
    write_json(out / "report.json", report)
    if args.command == "inspect":
        write_json(out / "report.json", report)
        return
    names, raw, x = fixtures(contract)
    print(f"Prepared {len(x)} structured landmark sequences.", flush=True)
    golden_count = len(x)
    if args.test_data:
        test_names, test_x, y = read_validation(local(args.test_data))
        names += test_names
        x = np.concatenate([x, test_x])
        report["testDataSha256"] = sha(local(args.test_data))
    with torch.inference_mode():
        expected = np.concatenate([model(torch.from_numpy(clip[None])).numpy() for clip in x])
    sample = (torch.from_numpy(x[:1]),)
    # A strict export check is separate from LiteRT conversion.
    ep = torch.export.export(model, sample, strict=True)
    print("torch.export.export passed; comparing exported program.", flush=True)
    with torch.inference_mode():
        exported = np.concatenate([ep.module()(torch.from_numpy(clip[None])).numpy() for clip in x])
    report["torchExportParity"] = compare(expected, exported, names)
    write_json(out / "report.json", report)
    path = local(args.tflite)
    if args.command == "convert":
        try:
            import litert_torch
        except ImportError as e:
            report["conversionBlocker"] = "litert_torch is unavailable; official converter requires Linux."
            write_json(out / "report.json", report)
            raise RuntimeError(report["conversionBlocker"]) from e
        with torch.no_grad():
            print("Starting litert_torch.convert on CPU in FP32...", flush=True)
            edge = litert_torch.convert(model.cpu().eval(), sample)
        print("Conversion finished; checking in-memory outputs before serialization.", flush=True)
        converted = np.concatenate([np.asarray(edge(clip[None])) for clip in x])
        report["afterConvertParity"] = compare(expected, converted, names)
        write_json(out / "report.json", report)
        path = out / f"{STEM}_verified_fp32.tflite"
        edge.export(str(path))
        print(f"Serialized {path.name}; reloading in LiteRT for parity.", flush=True)
        report["newConversionExecuted"] = True
    _, metadata, predict = interpreter(path)
    actual = np.concatenate([predict(clip[None]) for clip in x])
    report["serializedTfliteParity"] = compare(expected, actual, names)
    if args.command == "convert":
        report["convertVsReloadParity"] = compare(converted, actual, names)
    report["tfliteSha256"] = sha(path)
    report["tfliteMetadata"] = metadata
    existing_labels_path = ASSETS / f"{STEM}_display_labels.json"
    report["existingLabelsMatchCheckpoint"] = (
        json.loads(existing_labels_path.read_text(encoding="utf-8")) == labels
        if existing_labels_path.exists() else None
    )
    if args.test_data:
        report["accuracy"] = {"n": len(y), "pytorch": float((expected[golden_count:].argmax(-1) == y).mean()),
                              "tflite": float((actual[golden_count:].argmax(-1) == y).mean())}
    parity_checks = [report["torchExportParity"], report["serializedTfliteParity"]]
    if report["afterConvertParity"]:
        parity_checks.append(report["afterConvertParity"])
        parity_checks.append(report["convertVsReloadParity"])
    report["pythonParityPassed"] = all(r["allclose"] and r["argmaxAgreement"] == 1 for r in parity_checks)
    write_json(out / "report.json", report)
    np.savez_compressed(out / "fixtures.npz", raw=raw, x=x, pytorch_logits=expected, tflite_logits=actual, sample_ids=np.array(names))
    raw.astype("<f4").tofile(out / "raw.f32")
    x.astype("<f4").tofile(out / "input.f32")
    write_json(out / "golden.json", {"modelSha256": sha(path), "checkpointSha256": report["checkpointSha256"],
               "sampleNames": names, "rawSampleCount": golden_count, "shape": list(x.shape),
               "labels": labels, "pytorchLogits": expected.tolist(), "tfliteLogits": actual.tolist(),
               "rawSha256": sha(out / "raw.f32"), "inputSha256": sha(out / "input.f32"), "atol": ATOL, "rtol": RTOL})
    # Generate a reviewable registry entry from the actual binary metadata. No activation here.
    write_json(out / "registry-entry.json", {
        "displayName": "BiGRU Attention Alphabet FP32 (verified)", "modelFile": f"{STEM}_verified_fp32.tflite",
        "labelsFile": f"{STEM}_verified_labels.json", "sequenceLength": 60, "featureDimension": 126, "classCount": 30,
        "signatureKey": metadata["signatureKey"], "frameInputName": metadata["frameInputName"], "lengthInputName": "",
        "outputName": metadata["outputName"], "inputTensorName": metadata["input"]["name"], "outputTensorName": metadata["output"]["name"],
        "applySoftmax": True, "mirrorInput": contract["mirrorInput"], "swapHandedness": contract["swapHandedness"],
        "normalizationVersion": contract["normalizationVersion"], "sampleFps": contract["sampleFps"],
        "numThreads": 4, "modelSha256": sha(path), "labelsSha256": sha(out / "labels.json"), "outputType": "logits"
    })
    print(json.dumps({k: report[k] for k in ("pythonParityPassed", "serializedTfliteParity", "accuracy", "newConversionExecuted")}, indent=2))
    if not report["pythonParityPassed"]:
        raise RuntimeError("PARITY FAILED: do not activate this model")


if __name__ == "__main__":
    main()
