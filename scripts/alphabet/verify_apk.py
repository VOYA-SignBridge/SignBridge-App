"""Verify shipped APK assets against the current workspace/registry, including word assets."""
import argparse
import hashlib
import json
from pathlib import Path
import zipfile

ROOT = Path(__file__).resolve().parents[2]
ASSETS = ROOT / "android/app/src/main/assets"

def sha(data):
    return hashlib.sha256(data).hexdigest()

def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--apk", required=True)
    p.add_argument("--report", required=True)
    p.add_argument("--abis", required=True, help="Comma-separated expected ABI set")
    args = p.parse_args()
    apk = (ROOT / args.apk).resolve()
    output = (ROOT / args.report).resolve()
    assert apk.is_relative_to(ROOT) and output.is_relative_to(ROOT)
    with zipfile.ZipFile(apk) as z:
        registry_bytes = z.read("assets/tflite_models.json")
        assert registry_bytes == (ASSETS / "tflite_models.json").read_bytes(), "APK contains stale registry"
        registry = json.loads(registry_bytes)
        model_id = registry["modes"]["alphabet"]
        config = registry["models"][model_id]
        manifest = {}
        for entry in registry["models"].values():
            for key in ("modelFile", "labelsFile"):
                name = entry[key]
                packed = z.read("assets/" + name)
                assert packed == (ASSETS / name).read_bytes(), f"APK contains stale asset {name}"
                manifest[name] = sha(packed)
        assert manifest[config["modelFile"]] == config["modelSha256"]
        assert manifest[config["labelsFile"]] == config["labelsSha256"]
        abis = sorted({name.split('/')[1] for name in z.namelist() if name.startswith('lib/') and name.endswith('.so')})
        assert set(abis) == set(args.abis.split(',')), abis
        report = {"apk": str(apk.relative_to(ROOT)), "apkSha256": sha(apk.read_bytes()),
                  "apkBytes": apk.stat().st_size, "abis": abis, "modelId": model_id,
                  "modelSha256": config["modelSha256"], "labelsSha256": config["labelsSha256"],
                  "wordModelId": registry["modes"]["word"], "allAssetsMatchWorkspace": True, "assets": manifest,
                  "bundledJavaScript": "assets/index.android.bundle" in z.namelist()}
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
    print(json.dumps({k:v for k,v in report.items() if k != "assets"}, indent=2))

if __name__ == "__main__":
    main()
