"""Build a clean, secret-free UAT runtime directory and ZIP. Never deletes source data."""
import hashlib
import json
import shutil
import zipfile
from datetime import datetime, timezone
from pathlib import Path

root=Path(__file__).resolve().parents[1]
release=root/'releases'/('selam-uat-'+datetime.now(timezone.utc).strftime('%Y%m%d-%H%M%S-%f'))
release.mkdir(parents=True,exist_ok=False)

def copy(source, destination=None):
    source=root/source
    if source.is_symlink() or not source.resolve().is_relative_to(root):
        raise RuntimeError('Source must be a regular workspace file')
    target=release/(destination or source.relative_to(root))
    target.parent.mkdir(parents=True,exist_ok=True)
    shutil.copy2(source,target)

for directory in ['app','vendor','public/build']:
    for source in sorted((root/directory).rglob('*')):
        if source.is_file(): copy(source.relative_to(root))
for name in ['config/bootstrap.php','public/index.php','public/router.php','public/.htaccess',
             '.htaccess','composer.json','composer.lock','.env.uat.example',
             'bin/setup.php','bin/create-admin.php','bin/mail-worker.php','bin/init-uat.php','bin/check-uat.php',
             'docs/DEPLOYMENT.md','docs/UAT_PLAN.md','docs/UAT_RESULTS.md','docs/LINUX_UAT.md','docs/nginx-uat-5173.conf']:
    copy(name)
copy('.env.uat.example','.env.example')
copy('docs/UAT_README.md','README.md')
(release/'storage').mkdir()
(release/'storage'/'.gitkeep').touch()

files=sorted(p for p in release.rglob('*') if p.is_file())
for path in files:
    name=path.relative_to(release).as_posix()
    if path.name in ['.env','secrets.json','secrets.lock'] or path.suffix in ['.sqlite','.log','.pyc'] or path.name.startswith(('sess_','rate-')):
        raise RuntimeError('Private/runtime artifact in release: '+name)
manifest={p.relative_to(release).as_posix():hashlib.sha256(p.read_bytes()).hexdigest() for p in files}
(release/'MANIFEST.sha256.json').write_text(json.dumps(manifest,indent=2)+'\n',encoding='utf-8')
archive=release.with_suffix('.zip')
with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED) as zipped:
    for path in sorted(release.rglob('*')):
        if path.is_file(): zipped.write(path,release.name+'/'+path.relative_to(release).as_posix())
checksum=hashlib.sha256(archive.read_bytes()).hexdigest()
archive.with_suffix('.zip.sha256').write_text(checksum+'  '+archive.name+'\n',encoding='ascii')
print(json.dumps({'directory':str(release),'archive':str(archive),'files':len(manifest),'archive_sha256':checksum},indent=2))
