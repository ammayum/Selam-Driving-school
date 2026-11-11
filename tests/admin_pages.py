"""Admin pages and public CMS regression checks on a disposable MySQL database."""
import os
from pathlib import Path
import socket
import subprocess
import tempfile
import time
import uuid
from integration import Client, ROOT

database='selam_pages_test_'+uuid.uuid4().hex[:12]
mysql=['C:/xampp/mysql/bin/mysql.exe','--no-defaults','--host=127.0.0.1','--user=root']
def sql(query):
    subprocess.run(mysql+['--execute='+query],check=True,capture_output=True)

sql(f'CREATE DATABASE `{database}` CHARACTER SET utf8mb4')
try:
    with tempfile.TemporaryDirectory(prefix='selam-pages-') as folder:
        with socket.socket() as sock:
            sock.bind(('127.0.0.1',0)); port=sock.getsockname()[1]
        base=f'http://127.0.0.1:{port}'
        env=dict(os.environ, APP_ENV='testing', APP_URL=base, APP_KEY='pages-test-'+'x'*54,
                 DB_DSN=f'mysql:host=127.0.0.1;dbname={database};charset=utf8mb4', DB_USER='root', DB_PASSWORD='',
                 APP_DATA_DIR=folder+'/data', APP_PRIVATE_DIR=folder+'/private', SELAM_ENV_FILE=folder+'/absent.env', MAIL_TRANSPORT='log')
        subprocess.run(['php','tests/fixture.php'],cwd=ROOT,env=env,check=True,capture_output=True)
        with open(Path(folder)/'server.log','w') as log:
            server=subprocess.Popen(['php','-S',f'127.0.0.1:{port}','-t','public','public/router.php'],cwd=ROOT,env=env,stdout=log,stderr=log)
            try:
                guest,admin,student=[Client(base) for _ in range(3)]
                for _ in range(60):
                    try: guest.call('/api/health'); break
                    except OSError: time.sleep(.1)
                admin.login('admin'); student.login('student')
                templates='/api/admin/notification-templates'
                guest.call(templates,expected=401)
                student.call(templates,expected=403)
                template=dict(category='booking_created',subject='Thanks - {{subject}}',body='Hello from {{site_name}}\n{{details}}\nSee {{site_url}}')
                admin.call(templates,'PUT',template,csrf=False,expected=403)
                admin.call(templates,'PUT',dict(template,body='Missing details'),expected=422)
                admin.call(templates,'PUT',dict(template,subject='Bad\nHeader'),expected=422)
                admin.call(templates,'PUT',dict(template,body='{{details}} {{unknown}}'),expected=422)
                admin.call(templates,'PUT',template)
                assert next(row for row in admin.call(templates) if row['category']=='booking_created')['subject']==template['subject']
                assert 'Hello from' not in str(guest.call('/api/cms/pages/published'))
                guest.call('/api/cms/pages/catalog',expected=401)
                student.call('/api/cms/pages/catalog',expected=403)
                key='copy_site_about'
                row=dict(title='Never publish this draft',body='',is_published=False)
                admin.call('/api/cms/pages/'+key,'PUT',row)
                assert 'Never publish' not in str(guest.call('/api/cms/pages/published'))
                assert 'Never publish' not in str(admin.call('/api/cms/pages/published'))
                student.call('/api/cms/pages/'+key,'PUT',row,expected=403)
                admin.call('/api/cms/pages/'+key,'PUT',row,csrf=False,expected=403)
                row.update(title='Our School',is_published=True)
                admin.call('/api/cms/pages/'+key,'PUT',row)
                assert 'Our School' in guest.call('/')
                guest.call('/'+key,expected=404)
                assert key not in guest.call('/sitemap.xml')
                for path in ['/admin','/admin/overview','/admin/users','/admin/cms/book','/admin/config']:
                    assert 'noindex' in guest.call(path)
                assert admin.call('/api/admin/config/cms_repeatables')['values']['steps']!='[]'
                admin.call('/api/admin/config/cms_repeatables','PUT',dict(values=dict(services='[]')))
                assert guest.call('/api/cms/pages/home/repeatables')['services']==[]
                print('PASS API: CMS permissions, CSRF, draft isolation, public text, private routes and empty repeatables.')
                subprocess.run(['node','admin-pages-browser-test.mjs',base],cwd=ROOT/'frontend',check=True)
            finally:
                server.terminate(); server.wait(timeout=10)
finally:
    sql(f'DROP DATABASE `{database}`')
