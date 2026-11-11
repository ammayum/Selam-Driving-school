"""Prepare a reproducible, secrets-free PHP production release ZIP.

Usage (after composer install and frontend npm run build):
    python3 bin/package-production.py

Archive contains only allowlisted runtime source, Composer vendor packages and
compiled Vite assets. Does not bundle credentials, sessions, database, uploads,
test fixtures or user content. Keep private application state on the hosting
server, outside the public document root.
"""
from __future__ import annotations

import hashlib
import json
from pathlib import Path
import subprocess
import zipfile

ROOT = Path(__file__).resolve().parent.parent
DIST = ROOT / "dist"


def files_to_package() -> list[Path]:
    required = [
        "config/bootstrap.php",
        "public/index.php",
        "public/router.php",
        "public/.htaccess",
        "public/build/.vite/manifest.json",
        "composer.json",
        "composer.lock",
        ".htaccess",
        "bin/setup.php",
        "bin/create-admin.php",
        "bin/mail-worker.php",
    ]
    for name in required:
        if not (ROOT / name).is_file():
            raise SystemExit(f"Missing release file {name}; build dependencies first")

    files: set[Path] = {ROOT / name for name in required}
    for directory in ("app", "vendor", "public"):
        folder = ROOT / directory
        if not folder.is_dir():
            raise SystemExit(f"Missing runtime directory: {directory}")
        files.update(path for path in folder.rglob("*") if path.is_file())

    # Source migrations and diagnostics are useful without exposing UAT fixtures.
    for name in ("bin/import.php", "bin/import-media.php"):
        if (ROOT / name).is_file():
            files.add(ROOT / name)

    secret_names = {".env", "secrets.json", "secrets.lock"}
    forbidden_suffixes = {".sqlite", ".db", ".log", ".pyc"}
    output: list[Path] = []
    for path in sorted(files):
        if path.is_symlink() or not path.resolve().is_relative_to(ROOT):
            raise SystemExit("Symlink or out-of-repository release path: " + str(path))
        relative = path.relative_to(ROOT)
        parts = relative.parts
        if path.name in secret_names or path.suffix in forbidden_suffixes:
            raise SystemExit("Forbidden release content: " + str(relative))
        if any(part in {"storage", "__pycache__", "node_modules", ".git"} for part in parts):
            raise SystemExit("Runtime or development content found: " + str(relative))
        if path.name.startswith(("sess_", "rate-")):
            raise SystemExit("Runtime session data found: " + str(relative))
        output.append(path)
    return output


def main() -> None:
    files = files_to_package()
    commit = subprocess.check_output(
        ["git", "rev-parse", "--short=12", "HEAD"], cwd=ROOT, text=True
    ).strip()
    DIST.mkdir(exist_ok=True)
    archive = DIST / f"selam-production-{commit}.zip"
    manifest: dict[str, str] = {}
    with zipfile.ZipFile(archive, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=8) as zipped:
        for source in files:
            rel = source.relative_to(ROOT).as_posix()
            manifest[rel] = hashlib.sha256(source.read_bytes()).hexdigest()
            zipped.write(source, "selam-production/" + rel)
        manifest_blob = (json.dumps(manifest, indent=2, sort_keys=True) + "\n").encode()
        zipped.writestr("selam-production/RELEASE_MANIFEST.sha256.json", manifest_blob)

    # Confirm all members have the expected top-level directory and no escapes.
    with zipfile.ZipFile(archive) as zipped:
        bad = [
            member.filename for member in zipped.infolist()
            if not member.filename.startswith("selam-production/")
            or ".." in Path(member.filename).parts
            or member.filename.lower().endswith((".env", "secrets.json", "secrets.lock"))
        ]
        if bad:
            archive.unlink(missing_ok=True)
            raise SystemExit("Unsafe release member(s): " + ", ".join(bad))
        if len(zipped.namelist()) != len(files) + 1:
            raise SystemExit("Release archive member count mismatch")

    digest = hashlib.sha256(archive.read_bytes()).hexdigest()
    checksum = archive.with_suffix(".zip.sha256")
    checksum.write_text(f"{digest}  {archive.name}\n", encoding="ascii")
    print(json.dumps({
        "archive": str(archive.relative_to(ROOT)),
        "sha256_file": str(checksum.relative_to(ROOT)),
        "files": len(files),
        "sha256": digest,
        "commit": commit,
    }, indent=2))


if __name__ == "__main__":
    main()
