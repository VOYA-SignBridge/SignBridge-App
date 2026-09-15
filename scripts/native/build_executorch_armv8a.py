"""Build the ExecuTorch 1.4.0 Android JNI runtime for baseline ARMv8-A.

See README-executorch.md for prerequisites. Source and intermediates stay in
.alphabet-tools; only the repackaged AAR and its provenance belong in android/.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import zipfile

ROOT = Path(__file__).resolve().parents[2]
WORK = ROOT / ".alphabet-tools/executorch-armv8a"
SOURCE = WORK / "executorch"
COMMIT = "3dd7ccd1d863fad22639dd2d918ae34a41ce45f0"
BUILD = WORK / "build-arm64-v8a"
REPORTS = ROOT / "reports/executorch-armv8a"
OUTPUT = ROOT / "android/app/libs/executorch-android-1.4.0-armv8a.aar"


def run(command: list[str], *, log: str | None = None, env=None) -> None:
    print(subprocess.list2cmdline(command), flush=True)
    if log:
        REPORTS.mkdir(parents=True, exist_ok=True)
        with (REPORTS / log).open("w", encoding="utf-8") as stream:
            result = subprocess.run(command, cwd=SOURCE, env=env, stdout=stream, stderr=subprocess.STDOUT)
        if result.returncode:
            print((REPORTS / log).read_text(encoding="utf-8", errors="replace")[-12000:])
            raise SystemExit(result.returncode)
    else:
        subprocess.run(command, cwd=SOURCE, env=env, check=True)


def sha(path: Path) -> str:
    with path.open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


def prepare_source(flatc: Path) -> None:
    revision = subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=SOURCE, text=True).strip()
    if revision != COMMIT:
        raise RuntimeError(f"Expected {COMMIT}, found {revision}")
    # Use the matching host flatc from the ExecuTorch wheel. Cross-compiling
    # Android on Windows otherwise tries to bootstrap a Unix host compiler.
    third_party = SOURCE / "third-party/CMakeLists.txt"
    text = third_party.read_text(encoding="utf-8")
    if "SIGNBRIDGE_HOST_FLATC" not in text:
        start = text.index("# We use ExternalProject to build flatc")
        end = text.index("# TODO: re-enable once flatbuffers", start)
        original = text[start:end]
        text = text[:start] + (
            'if(SIGNBRIDGE_HOST_FLATC)\n'
            '  add_executable(flatc IMPORTED GLOBAL)\n'
            '  set_target_properties(flatc PROPERTIES IMPORTED_LOCATION "${SIGNBRIDGE_HOST_FLATC}")\n'
            'else()\n' + original + 'endif()\n\n'
        ) + text[end:]
        third_party.write_text(text, encoding="utf-8", newline="\n")
    # The upstream JNI build uses an external unzip executable. CMake's archive
    # command performs the same extraction on Windows, Linux and macOS.
    android_cmake = SOURCE / "extension/android/CMakeLists.txt"
    text = android_cmake.read_text(encoding="utf-8")
    text = text.replace(
        'COMMAND unzip -o ${FBJNI_DOWNLOAD_PATH} -d\n          ${CMAKE_CURRENT_BINARY_DIR}/third-party/fbjni',
        'COMMAND ${CMAKE_COMMAND} -E tar xf ${FBJNI_DOWNLOAD_PATH}\n'
        '  WORKING_DIRECTORY ${CMAKE_CURRENT_BINARY_DIR}/third-party/fbjni',
    )
    android_cmake.write_text(text, encoding="utf-8", newline="\n")
    version = subprocess.check_output([str(flatc), "--version"], text=True).strip()
    if version != "flatc version 24.3.25":
        raise RuntimeError(f"Unexpected host flatc: {version}")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--ndk", type=Path, default=Path(os.environ.get("LOCALAPPDATA", "")) / "Android/Sdk/ndk/27.1.12297006")
    parser.add_argument("--flatc", type=Path, default=ROOT / ".alphabet-tools/executorch-runtime/executorch/data/bin/flatc.exe")
    parser.add_argument("--base-aar", type=Path)
    parser.add_argument("--jobs", type=int, default=8)
    parser.add_argument("--package-only", action="store_true")
    args = parser.parse_args()
    cmake = WORK / "host-tools/cmake/data/bin/cmake.exe"
    ninja = WORK / "host-tools/bin/ninja.exe"
    base_aar = args.base_aar
    if base_aar is None:
        matches = list((Path.home() / ".gradle/caches/modules-2/files-2.1/org.pytorch/executorch-android/1.4.0").glob("*/*.aar"))
        if len(matches) != 1:
            raise RuntimeError("Supply --base-aar pointing to the original ExecuTorch 1.4.0 Maven AAR")
        base_aar = matches[0]
    prepare_source(args.flatc.resolve())
    env = os.environ.copy()
    env["PYTHONPATH"] = str(ROOT / ".alphabet-tools/executorch-runtime") + os.pathsep + env.get("PYTHONPATH", "")
    # ARMv8-A has no LSE atomics. Inline exclusive-load/store sequences also
    # avoid any accidental LSE dependency in compiler-generated JNI cleanup.
    flags = "-march=armv8-a -mno-outline-atomics"
    options = {
        "CMAKE_TOOLCHAIN_FILE": (args.ndk / "build/cmake/android.toolchain.cmake").as_posix(),
        "CMAKE_MAKE_PROGRAM": ninja.as_posix(),
        "CMAKE_BUILD_TYPE": "Release",
        "CMAKE_EXPORT_COMPILE_COMMANDS": "ON",
        "CMAKE_C_FLAGS": flags,
        "CMAKE_CXX_FLAGS": flags,
        "ANDROID_ABI": "arm64-v8a",
        "ANDROID_PLATFORM": "android-26",
        "ANDROID_STL": "c++_shared",
        "PYTHON_EXECUTABLE": Path(sys.executable).as_posix(),
        "SIGNBRIDGE_HOST_FLATC": args.flatc.resolve().as_posix(),
        "EXECUTORCH_BUILD_ANDROID_JNI": "ON",
        "EXECUTORCH_PAL_DEFAULT": "android",
        "EXECUTORCH_BUILD_XNNPACK": "ON",
        "EXECUTORCH_XNNPACK_ENABLE_KLEIDI": "OFF",
        "EXECUTORCH_BUILD_EXTENSION_DATA_LOADER": "ON",
        "EXECUTORCH_BUILD_EXTENSION_FLAT_TENSOR": "ON",
        "EXECUTORCH_BUILD_EXTENSION_MODULE": "ON",
        "EXECUTORCH_BUILD_EXTENSION_NAMED_DATA_MAP": "ON",
        "EXECUTORCH_BUILD_EXTENSION_RUNNER_UTIL": "ON",
        "EXECUTORCH_BUILD_EXTENSION_TENSOR": "ON",
        "EXECUTORCH_BUILD_KERNELS_OPTIMIZED": "OFF",
        "EXECUTORCH_BUILD_DEVTOOLS": "OFF",
        "EXECUTORCH_BUILD_EXECUTOR_RUNNER": "OFF",
        "EXECUTORCH_BUILD_TESTS": "OFF",
        "BUILD_TESTING": "OFF",
        "XNNPACK_ENABLE_ARM_SME": "OFF",
        "XNNPACK_ENABLE_ARM_SME2": "OFF",
        "XNNPACK_ENABLE_ARM_I8MM": "OFF",
        "XNNPACK_ENABLE_ARM_BF16": "OFF",
        "XNNPACK_ENABLE_ARM_DOTPROD": "OFF",
        "XNNPACK_ENABLE_ARM_FP16_VECTOR": "OFF",
        "XNNPACK_ENABLE_ARM_FP16_SCALAR": "OFF",
        "XNNPACK_ENABLE_KLEIDIAI": "OFF",
        "FBJNI_VERSION": "0.7.0",
    }
    configure = [str(cmake), "--fresh", "-S", str(SOURCE), "-B", str(BUILD), "-G", "Ninja"]
    configure += [f"-D{key}={value}" for key, value in options.items()]
    if not args.package_only:
        run(configure, log="configure.log", env=env)
        run([str(cmake), "--build", str(BUILD), "--target", "executorch_jni", "--parallel", str(args.jobs)], log="build.log", env=env)
    library = BUILD / "extension/android/libexecutorch_jni.so"
    stripped = WORK / "libexecutorch.so"
    llvm = args.ndk / "toolchains/llvm/prebuilt/windows-x86_64/bin"
    run([str(llvm / "llvm-strip.exe"), "--strip-unneeded", str(library), "-o", str(stripped)])
    disassembly = subprocess.check_output(
        [str(llvm / "llvm-objdump.exe"), "-d", "--no-show-raw-insn", str(stripped)],
        text=True,
    )
    lse = re.compile(r"(?:cas|swp|ldadd|ldclr|ldeor|ldset|ldsmax|ldsmin|ldumax|ldumin|stadd|stclr|steor|stset|stsmax|stsmin|stumax|stumin)[a-z]*$")
    unsupported = []
    for line in disassembly.splitlines():
        instruction = re.match(r"\s*[0-9a-f]+:\s+([a-z0-9.]+)\s", line)
        if instruction and lse.fullmatch(instruction[1]):
            unsupported.append(line.strip())
    REPORTS.mkdir(parents=True, exist_ok=True)
    audit = {"librarySha256": sha(stripped), "lseInstructionCount": len(unsupported), "lseInstructions": unsupported}
    (REPORTS / "instruction-audit.json").write_text(json.dumps(audit, indent=2) + "\n", encoding="utf-8")
    if unsupported:
        raise RuntimeError(f"Found {len(unsupported)} LSE instructions; refusing to package this library")
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(base_aar) as original, zipfile.ZipFile(OUTPUT, "w", compression=zipfile.ZIP_DEFLATED) as rebuilt:
        for entry in original.infolist():
            data = stripped.read_bytes() if entry.filename == "jni/arm64-v8a/libexecutorch.so" else original.read(entry)
            rebuilt.writestr(entry, data)
        licenses = [
            "LICENSE",
            "backends/xnnpack/third-party/XNNPACK/LICENSE",
            "backends/xnnpack/third-party/FP16/LICENSE",
            "backends/xnnpack/third-party/FXdiv/LICENSE",
            "backends/xnnpack/third-party/cpuinfo/LICENSE",
            "backends/xnnpack/third-party/pthreadpool/LICENSE",
            "third-party/flatbuffers/LICENSE",
            "third-party/pocketfft/LICENSE.md",
        ]
        notices = "\n\n".join(f"=== {name} ===\n{(SOURCE / name).read_text(encoding='utf-8')}" for name in licenses)
        rebuilt.writestr("assets/executorch-armv8a-LICENSES.txt", notices)
    provenance = {
        "version": "1.4.0-armv8a",
        "source": "https://github.com/pytorch/executorch",
        "commit": COMMIT,
        "baseAarSha256": sha(base_aar),
        "aarSha256": sha(OUTPUT),
        "arm64LibrarySha256": sha(stripped),
        "lseInstructionCount": 0,
        "cmakeOptions": options,
        "ndk": (args.ndk / "source.properties").read_text().strip(),
        "rebuiltAbi": "arm64-v8a",
        "preserved": ["Java classes", "x86_64 native library", "Android resources", "model assets outside AAR"],
        "nativeFeatures": ["Module/Tensor JNI", "XNNPACK", "portable CPU operators"],
        "excludedNativeFeatures": ["LLM/ASR", "training", "profiling", "KleidiAI"],
    }
    OUTPUT.with_suffix(".json").write_text(json.dumps(provenance, indent=2) + "\n", encoding="utf-8")
    print(f"Built {OUTPUT}\nSHA-256: {provenance['aarSha256']}", flush=True)


if __name__ == "__main__":
    main()
