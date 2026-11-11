"""Verify migration of an older source schema without modifying the source."""
import base64
import hashlib
import os
from pathlib import Path
import sqlite3
import subprocess
import tempfile

ROOT=Path(__file__).resolve().parents[1]
with tempfile.TemporaryDirectory(prefix='selam-import-') as folder:
    tmp=Path(folder); source=tmp/'legacy.sqlite'; target=tmp/'target.sqlite'
    db=sqlite3.connect(source)
    db.executescript('''
    CREATE TABLE users(id INTEGER PRIMARY KEY,full_name TEXT,email TEXT,phone TEXT,role TEXT,profile_photo_url TEXT,created_at TEXT);
    INSERT INTO users VALUES(1,'Legacy Learner','LEARNER@example.test','123','STUDENT','/media/old.png','2026-01-01 12:00:00');
    CREATE TABLE cms_pages(id INTEGER PRIMARY KEY,slug TEXT,title TEXT,body TEXT,is_published INTEGER,updated_at TEXT);
    INSERT INTO cms_pages VALUES(1,'about','Legacy About','Source content',1,'2026-01-01 12:00:00');
    CREATE TABLE system_configs(id INTEGER PRIMARY KEY,`group` TEXT,`key` TEXT,value TEXT,updated_at TEXT);
    INSERT INTO system_configs VALUES(1,'smtp','password','NEVER-COPY-ME','2026-01-01 12:00:00');
    INSERT INTO system_configs VALUES(2,'contact','phone','0114 123','2026-01-01 12:00:00');
    ''');db.commit();db.close()
    original=hashlib.sha256(source.read_bytes()).hexdigest()
    env=dict(os.environ,APP_ENV='testing',APP_KEY='import-test-'+ 'x'*52,DB_DSN='sqlite:'+str(target),APP_DATA_DIR=str(tmp/'data'),APP_PRIVATE_DIR=str(tmp/'private'),IMPORT_DSN='sqlite:'+str(source))
    dry=subprocess.run(['php','bin/import.php'],cwd=ROOT,env=env,capture_output=True,text=True,check=True)
    assert 'Dry run only' in dry.stdout and not target.exists()
    subprocess.run(['php','bin/import.php','--apply'],cwd=ROOT,env=env,capture_output=True,text=True,check=True)
    with sqlite3.connect(target) as check:
        assert check.execute('SELECT username,email,role FROM users').fetchone()==('imported_1','learner@example.test','student')
        assert check.execute("SELECT COUNT(*) FROM system_configs WHERE `group`='smtp'").fetchone()[0]==0
        assert check.execute('SELECT title FROM cms_pages').fetchone()[0]=='Legacy About'
    check.close()
    assert hashlib.sha256(source.read_bytes()).hexdigest()==original
    again=subprocess.run(['php','bin/import.php','--apply'],cwd=ROOT,env=env,capture_output=True,text=True)
    assert again.returncode==1 and 'Target must be empty' in again.stderr
    media=tmp/'media';media.mkdir()
    png=base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a6n8AAAAASUVORK5CYII=')
    (media/'old.png').write_bytes(png)
    subprocess.run(['php','bin/import-media.php',str(media)],cwd=ROOT,env=env,capture_output=True,text=True,check=True)
    with sqlite3.connect(target) as check:
        url=check.execute('SELECT profile_photo_url FROM users').fetchone()[0]
    check.close()
    assert url!='/media/old.png' and (tmp/'data/uploads'/Path(url).name).read_bytes()==png
    assert (media/'old.png').read_bytes()==png
    print('PASS legacy import: dry run, enum normalization, missing usernames, public data, secret exclusion, empty-target guard, read-only source, copied photos.')
