"""Run immediate-delivery checks against a disposable MySQL database; no real mail."""
import os
from pathlib import Path
import subprocess
import tempfile
import uuid

root = Path(__file__).resolve().parents[1]
database = 'selam_mail_test_' + uuid.uuid4().hex[:12]
mysql = ['C:/xampp/mysql/bin/mysql.exe', '--no-defaults', '--host=127.0.0.1', '--user=root']

def sql(query):
    subprocess.run(mysql + ['--execute=' + query], check=True, capture_output=True)

sql(f'CREATE DATABASE `{database}` CHARACTER SET utf8mb4')
try:
    with tempfile.TemporaryDirectory(prefix='selam-mail-test-') as folder:
        env = dict(os.environ, APP_ENV='testing', APP_KEY='mail-test-' + 'x'*54,
                   DB_DSN=f'mysql:host=127.0.0.1;dbname={database};charset=utf8mb4',
                   DB_USER='root', DB_PASSWORD='', MAIL_TRANSPORT='log',
                   MAIL_SEND_IMMEDIATELY='true', APP_DATA_DIR=folder+'/data',
                   APP_PRIVATE_DIR=folder+'/private', SELAM_ENV_FILE=folder+'/absent.env')
        subprocess.run(['php', 'tests/mail_immediate.php'], cwd=root, env=env, check=True)
finally:
    sql(f'DROP DATABASE `{database}`')
