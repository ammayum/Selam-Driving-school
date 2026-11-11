"""Event API regression tests using a disposable MySQL database and captured mail."""
import datetime as dt
import json
import os
import socket
import subprocess
import tempfile
import time
import uuid
from pathlib import Path
from urllib.parse import urlencode
from integration import Client, ROOT

database = 'selam_events_test_' + uuid.uuid4().hex[:12]
mysql = ['C:/xampp/mysql/bin/mysql.exe', '--no-defaults', '--host=127.0.0.1', '--user=root']
def sql(statement):
    return subprocess.run(mysql + ['--execute=' + statement], check=True, capture_output=True, text=True).stdout

sql(f'CREATE DATABASE `{database}` CHARACTER SET utf8mb4')
try:
    with tempfile.TemporaryDirectory(prefix='selam-events-') as folder:
        runtime = Path(folder)
        with socket.socket() as sock:
            sock.bind(('127.0.0.1', 0)); port = sock.getsockname()[1]
        base = f'http://127.0.0.1:{port}'
        env = dict(os.environ, APP_ENV='testing', APP_URL=base, APP_KEY='events-test-'+'x'*54,
                   DB_DSN=f'mysql:host=127.0.0.1;port=3306;dbname={database};charset=utf8mb4', DB_USER='root', DB_PASSWORD='',
                   APP_DATA_DIR=str(runtime/'data'), APP_PRIVATE_DIR=str(runtime/'private'), MAIL_TRANSPORT='log')
        # Exercise upgrade of an existing count-only MySQL package table.
        sql(f"USE `{database}`; CREATE TABLE lesson_packages(id INTEGER PRIMARY KEY AUTO_INCREMENT,title VARCHAR(120) NOT NULL,lesson_count INTEGER NOT NULL,price DECIMAL(10,2) NOT NULL,description TEXT,is_active INTEGER NOT NULL DEFAULT 1,updated_at DATETIME NOT NULL); INSERT INTO lesson_packages(title,lesson_count,price,updated_at) VALUES('Legacy Manual',5,150,UTC_TIMESTAMP()),('Legacy Automatic',8,300,UTC_TIMESTAMP())")
        subprocess.run(['php','tests/fixture.php'], cwd=ROOT, env=env, check=True, capture_output=True)
        server = subprocess.Popen(['php','-S',f'127.0.0.1:{port}','-t','public','public/router.php'], cwd=ROOT, env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        try:
            guest = Client(base)
            for _ in range(60):
                try: guest.call('/api/health'); break
                except OSError: time.sleep(.1)
            owner, other, student, admin = [Client(base) for _ in range(4)]
            for client, name in [(owner,'instructor'), (other,'other'), (student,'student'), (admin,'admin')]: client.login(name)
            start = dt.datetime.now(dt.timezone.utc).replace(microsecond=0) + dt.timedelta(minutes=10)
            end = start + dt.timedelta(hours=1)
            payload = dict(title='Driving test briefing', event_type='driving_test', start_time=start.isoformat(), end_time=end.isoformat(), notify_email=True, reminder_minutes=30, location='Test centre')
            path = '/api/instructor/events'
            guest.call(path,'POST',payload,expected=401)
            student.call(path,'POST',payload,expected=403)
            owner.call(path,'POST',dict(payload,instructor_id=4),expected=403)
            owner.call(path,'POST',payload,csrf=False,expected=403)
            owner.call(path,'POST',dict(payload,end_time=start.isoformat()),expected=422)
            owner.call(path,'POST',dict(payload,title='Bad\r\nTitle'),expected=422)
            event = owner.call(path,'POST',payload)
            other.call(path+f'/{event["id"]}','PATCH',dict(title='Forbidden'),expected=403)
            other.call(path+f'/{event["id"]}','DELETE',expected=403)
            owner.call(path+f'/{event["id"]}','PATCH',dict(title='Updated briefing'))
            sql(f"USE `{database}`; INSERT INTO bookings(instructor_id,student_id,lesson_type,start_time,end_time,pickup_location,created_at) VALUES(2,3,'manual','{start.strftime('%Y-%m-%d %H:%M:%S')}','{end.strftime('%Y-%m-%d %H:%M:%S')}','Station',UTC_TIMESTAMP())")
            query = urlencode(dict(start=(start-dt.timedelta(days=1)).isoformat(), end=(end+dt.timedelta(days=1)).isoformat()))
            items = owner.call('/api/instructor/timeline?'+query)['items']
            assert {i['source'] for i in items} == {'booking','event'}
            assert next(i for i in items if i['source'] == 'booking')['payment_status'] == 'not_requested'
            assert other.call('/api/instructor/timeline?'+query)['items'] == []
            other.call('/api/instructor/timeline?'+query+'&instructor_id=2',expected=403)
            assert len(admin.call('/api/instructor/timeline?'+query+'&instructor_id=2')['items']) == 2
            def worker():
                result = subprocess.run(['php','bin/mail-worker.php'], cwd=ROOT, env=env, check=True, capture_output=True, text=True)
                return json.loads(result.stdout)
            assert worker()['event_reminders'] == 1
            assert worker()['event_reminders'] == 0
            alerts = owner.call('/api/instructor/event-notifications')
            assert alerts['unread_count'] == 3
            alert_id = alerts['items'][0]['id']
            other.call(f'/api/instructor/event-notifications/{alert_id}/read','PATCH',expected=403)
            owner.call(f'/api/instructor/event-notifications/{alert_id}/read','PATCH')
            assert owner.call('/api/instructor/event-notifications')['unread_count'] == 2
            owner.call(path+f'/{event["id"]}','DELETE')
            owner.call(path+f'/{event["id"]}','DELETE')
            owner.call(path+f'/{event["id"]}','PATCH',dict(title='No'),expected=409)
            assert worker()['event_reminders'] == 0
            assert len(owner.call('/api/instructor/event-notifications')['items']) == 4
            assert len((runtime/'data/mail-test.jsonl').read_text().splitlines()) == 4
            assert 'noindex' in guest.call('/instructor/timeline')
            legacy = admin.call('/api/packages')
            assert [(p['hours'],p['package_type']) for p in legacy] == [(5,'manual'),(8,'automatic')]
            manual = admin.call('/api/packages','POST',dict(title='Manual Hours',hours=2.5,package_type='manual',price=90))
            automatic = admin.call('/api/packages','POST',dict(title='Automatic Hours',hours=1.5,package_type='automatic',price=65))
            assert manual['hours'] == 2.5 and automatic['package_type'] == 'automatic'
            for invalid in [0,-1,10001,1.123,True,'bad']:
                admin.call('/api/packages','POST',dict(title='Invalid',hours=invalid,package_type='manual',price=30),expected=422)
            admin.call('/api/packages','POST',dict(title='Invalid',hours=2,package_type='both',price=30),expected=422)
            student.call('/api/packages','POST',dict(title='Forbidden',hours=2,package_type='manual',price=30),expected=403)
            booking = dict(package_id=automatic['id'],lesson_type='manual',start_time='2028-01-10T10:00:00Z',end_time='2028-01-10T11:00:00Z',pickup_location='Sheffield',guest_name='Student Test',guest_email='student@example.test',guest_phone='07000000000',payment_method='advance_2_hours')
            guest.call('/api/bookings','POST',booking,expected=422)
            booking['lesson_type']='automatic'
            created = guest.call('/api/bookings','POST',booking)
            stored = admin.call('/api/bookings')
            assert next(b for b in stored if b['id']==created['id'])['lesson_type']=='automatic'
            admin.call('/api/bookings/'+str(created['id']),'PATCH',dict(package_id=manual['id']),expected=422)
            admin.call('/api/packages/'+str(automatic['id']),'PUT',dict(title='Automatic Hours',hours=3.5,package_type='automatic',price=130))
            subprocess.run(['php','bin/setup.php'],cwd=ROOT,env=env,check=True,capture_output=True)
            assert next(p for p in admin.call('/api/packages') if p['id']==automatic['id'])['hours']==3.5
            print('PASS MySQL packages: legacy migration, fractional hours, manual/automatic types, validation, booking mismatch rejection and idempotent setup.')
            card_path = '/api/instructor/business-card'
            guest.call(card_path,expected=401)
            student.call(card_path,expected=403)
            other.call(card_path+'?instructor_id=2',expected=403)
            card = owner.call(card_path)['details']
            assert card['name'] == 'Instructor Test'
            card.update(name='Card Instructor', booking_url='https://example.test/book')
            owner.call(card_path,'PUT',card,csrf=False,expected=403)
            owner.call(card_path,'PUT',dict(card,booking_url='javascript:alert(1)'),expected=422)
            owner.call(card_path,'PUT',dict(card,name='Bad\nName'),expected=422)
            owner.call(card_path,'PUT',card)
            assert owner.call(card_path)['details'] == card
            assert admin.call(card_path+'?instructor_id=2')['details'] == card
            assert other.call(card_path)['details']['name'] == 'Other Instructor'
            admin.call(card_path+'?instructor_id=4','PUT',dict(card,name='Admin selected instructor'))
            assert other.call(card_path)['details']['name'] == 'Admin selected instructor'
            assert 'noindex' in guest.call('/instructor/business-card')
            print('PASS MySQL business cards: instructor defaults, persistence, admin selection, role/ownership isolation, CSRF, URL validation and private SEO.')
            if os.environ.get('EVENT_BROWSER_TEST') == '1':
                subprocess.run(['node','events-browser-test.mjs',base], cwd=ROOT/'frontend', check=True)
            if os.environ.get('CARD_BROWSER_TEST') == '1':
                subprocess.run(['node','cards-browser-test.mjs',base], cwd=ROOT/'frontend', check=True)
            if os.environ.get('PACKAGE_BROWSER_TEST') == '1':
                subprocess.run(['node','packages-browser-test.mjs',base], cwd=ROOT/'frontend', check=True)
            if os.environ.get('ADMIN_CMS_BROWSER_TEST') == '1':
                subprocess.run(['node','admin-cms-browser-test.mjs',base], cwd=ROOT/'frontend', check=True)
            from booking_security import run as booking_security
            current_package = next(p for p in admin.call('/api/packages') if p['id']==automatic['id'])
            booking_security(env, guest, admin, owner, other, student, current_package)
            from user_management import run as user_management
            user_management(guest, admin, owner, student)
            from temporary_password import run as temporary_password
            temporary_password(env, admin, base)
            from uat_indexing import run as uat_indexing
            uat_indexing(env)
            from admin_cms import run as admin_cms
            admin_cms(env, guest, admin, owner, student)
            print('PASS MySQL events: roles, ownership, CSRF, validation, combined timeline, edits, cancellation, read state, reminder deduplication, four captured emails, private SEO.')
        finally:
            server.terminate(); server.wait(timeout=10)
finally:
    assert database.startswith('selam_events_test_')
    sql(f'DROP DATABASE `{database}`')
