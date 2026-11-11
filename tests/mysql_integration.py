"""Exercise migration against a temporary MariaDB instance, never the installed database."""
import json
import os
from pathlib import Path
import socket
import subprocess
import tempfile
import time
from integration import Client, ROOT

MYSQL = Path(os.environ.get('MYSQL_TEST_BIN', 'C:/xampp/mysql/bin'))
def port():
    with socket.socket() as s:
        s.bind(('127.0.0.1',0)); return s.getsockname()[1]

with tempfile.TemporaryDirectory(prefix='selam-mysql-') as folder:
    runtime=Path(folder); sqlport=port(); webport=port(); data=runtime/'mysql'
    init=subprocess.run([str(MYSQL/'mysql_install_db.exe'),f'--datadir={data}',f'--port={sqlport}','--silent'],capture_output=True,text=True)
    if init.returncode: raise RuntimeError(init.stdout+init.stderr)
    log=open(runtime/'mysql.log','w')
    sqlserver=subprocess.Popen([str(MYSQL/'mysqld.exe'),'--no-defaults',f'--basedir={MYSQL.parent}',f'--datadir={data}',f'--port={sqlport}','--bind-address=127.0.0.1','--console'],stdout=log,stderr=log)
    webserver=None
    try:
        for _ in range(100):
            try:
                with socket.create_connection(('127.0.0.1',sqlport),timeout=.2): break
            except OSError: time.sleep(.1)
        command=[str(MYSQL/'mysql.exe'),'--no-defaults','--host=127.0.0.1',f'--port={sqlport}','--user=root']
        subprocess.run(command+['--execute=CREATE DATABASE selam_test CHARACTER SET utf8mb4'],check=True,capture_output=True)
        base=f'http://127.0.0.1:{webport}'
        env=dict(os.environ,APP_ENV='testing',APP_URL=base,APP_KEY='mysql-test-'+ 'x'*54, DB_DSN='sqlite:'+str(runtime/'source.sqlite'),APP_DATA_DIR=str(runtime/'data'),APP_PRIVATE_DIR=str(runtime/'private'),MAIL_TRANSPORT='log')
        subprocess.run(['php','tests/fixture.php'],cwd=ROOT,env=env,check=True,capture_output=True)
        webserver=subprocess.Popen(['php','-S',f'127.0.0.1:{webport}','-t','public','public/router.php'],cwd=ROOT,env=env,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
        client=Client(base)
        for _ in range(50):
            try: client.call('/api/health');break
            except OSError: time.sleep(.1)
        client.login('admin')
        client.call('/api/packages','POST',{'title':'Migration package','lesson_count':2,'price':75.5,'is_active':True})
        client.call('/api/admin/database/connection','PUT',{'host':'127.0.0.1','port':sqlport,'username':'root','password':'','database':'selam_test'})
        assert client.call('/api/admin/database/test','POST')['ok']
        result=client.call('/api/admin/database/migrate','POST')
        assert result['ok'] and result['rows']>=5
        assert client.call('/api/admin/database/apply','POST')['ok']
        assert client.call('/api/packages')[0]['price']==75.5
        client.call('/api/packages','POST',{'title':'MySQL native package','lesson_count':3,'price':105,'is_active':True})
        assert len(client.call('/api/packages'))==2
        out=subprocess.run(command+['--database=selam_test','--batch','--skip-column-names','--execute=SELECT COUNT(*) FROM lesson_packages'],capture_output=True,text=True,check=True)
        assert out.stdout.strip()=='2'
        print('PASS isolated MariaDB: connection save/test, full SQLite migration, apply, session continuity, package read/write on MySQL.')
    finally:
        if webserver: webserver.terminate();webserver.wait(timeout=10)
        subprocess.run([str(MYSQL/'mysqladmin.exe'),'--no-defaults','--host=127.0.0.1',f'--port={sqlport}','--user=root','shutdown'],capture_output=True,timeout=10)
        try: sqlserver.wait(timeout=10)
        except subprocess.TimeoutExpired: sqlserver.terminate();sqlserver.wait(timeout=10)
        log.close()
        if (runtime/'data/error.log').exists(): print((runtime/'data/error.log').read_text())
