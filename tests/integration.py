"""HTTP integration tests. Creates isolated data and never sends real email."""
import base64
import http.cookiejar
import json
import os
from pathlib import Path
import re
import socket
import sqlite3
import subprocess
import tempfile
import time
import urllib.request
import urllib.error

ROOT = Path(__file__).resolve().parents[1]
passed = []

def check(condition, message):
    assert condition, message
    passed.append(message)

class Client:
    def __init__(self, base):
        self.base = base
        self.jar = http.cookiejar.CookieJar()
        self.opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(self.jar))
    def call(self, path, method='GET', data=None, expected=200, csrf=True, headers=None, raw=None):
        h = dict(headers or {})
        if method != 'GET' and csrf:
            h['X-CSRF-Token'] = self.call('/api/auth/csrf')['csrf_token']
        if raw is None and data is not None:
            raw = json.dumps(data).encode()
            h['Content-Type'] = 'application/json'
        req = urllib.request.Request(self.base+path, data=raw, headers=h, method=method)
        try:
            response = self.opener.open(req)
        except urllib.error.HTTPError as error:
            response = error
        body = response.read().decode(errors='replace')
        assert response.status == expected, (path, method, expected, response.status, body)
        self.headers = response.headers
        return json.loads(body) if 'application/json' in response.headers.get('Content-Type','') else body
    def login(self, name):
        return self.call('/api/auth/login','POST',{'username':name,'password':'Test-password-2026!'})

def run():
    with tempfile.TemporaryDirectory(prefix='selam-php-') as folder:
        runtime = Path(folder)
        with socket.socket() as s:
            s.bind(('127.0.0.1',0)); port=s.getsockname()[1]
        base=f'http://127.0.0.1:{port}'
        env = dict(os.environ, APP_ENV='testing', APP_URL=base, APP_KEY='test-key-'+'x'*56,
            DB_DSN='sqlite:'+str(runtime/'test.sqlite'), APP_DATA_DIR=str(runtime/'data'),
            APP_PRIVATE_DIR=str(runtime/'config'), MAIL_TRANSPORT='log')
        subprocess.run(['php','tests/fixture.php'],cwd=ROOT,env=env,check=True,capture_output=True)
        log=open(runtime/'server.log','w')
        server=subprocess.Popen(['php','-S',f'127.0.0.1:{port}','-t','public','public/router.php'],cwd=ROOT,env=env,stdout=log,stderr=log)
        try:
            for _ in range(60):
                try:
                    urllib.request.urlopen(base+'/api/health',timeout=1); break
                except (OSError,urllib.error.URLError): time.sleep(.1)
            guest,admin,student,instructor,other=[Client(base) for _ in range(5)]
            check(guest.call('/api/health')['status']=='ok','PHP health endpoint')
            guest.call('/api/bookings',expected=401)
            guest.call('/api/auth/login','POST',{},expected=403,csrf=False)
            guest.call('/api/auth/login','POST',{'username':'admin','password':'bad'},expected=403,headers={'Origin':'https://attacker.example'})
            check(True,'CSRF, cross-origin and anonymous access rejected')
            admin.login('admin'); student.login('student'); instructor.login('instructor'); other.login('other')
            check(any(c.name=='selam_php' and c.has_nonstandard_attr('HttpOnly') for c in admin.jar),'HttpOnly session cookie')
            check(student.call('/api/auth/session')['role']=='student','Legacy Python password hash login')
            student.call('/api/admin/users',expected=403)
            student.call('/api/packages','POST',{},expected=403)
            check(True,'Student cannot administer users or packages')
            pack=admin.call('/api/packages','POST',{'title':'Manual Package','lesson_count':10,'price':350,'description':'Ten lessons','is_active':True})
            admin.call('/api/packages/'+str(pack['id']),'PUT',{'title':'Manual Package','lesson_count':10,'price':360,'description':'Ten lessons','is_active':True})
            check(guest.call('/api/packages')[0]['price']==360,'Package creation and update')
            b={'package_id':pack['id'],'lesson_type':'Manual','start_time':'2027-05-10T09:00:00Z','end_time':'2027-05-10T10:00:00Z','pickup_location':'Sheffield','guest_name':'Student Test','guest_email':'student@example.test','guest_phone':'07000000000','payment_method':'advance_2_hours'}
            booking=guest.call('/api/bookings','POST',b)
            bid=booking['id']
            check(guest.call('/api/bookings','POST',b)['id']==bid,'Duplicate booking request is idempotent')
            check(guest.call('/api/bookings','POST',b)['student_email'] is None,'Guest receipt does not reveal student account data')
            check(len(student.call('/api/bookings/my'))==1,'Student sees own booking')
            other.call('/api/students/3/progress',expected=403)
            admin.call('/api/bookings/'+str(bid),'PATCH',{'instructor_id':2})
            other.call('/api/bookings/'+str(bid),'PATCH',{'status':'approved'},expected=403)
            instructor.call('/api/bookings/'+str(bid),'PATCH',{'instructor_id':4},expected=403)
            check(True,'Instructor ownership and reassignment enforced')
            instructor.call('/api/bookings/'+str(bid)+'/accept-by-email','POST',{'instructor_email':'instructor@example.test'})
            conflict=dict(b,guest_email='new@example.test',instructor_id=2)
            guest.call('/api/bookings','POST',conflict,expected=403)
            admin.call('/api/bookings','POST',conflict,expected=409)
            slots=guest.call('/api/bookings/availability?instructor_id=2&day=2027-05-10')['slots']
            check('09:00' not in slots and slots[-1]=='17:00','Conflicting booking rejected and availability updated')
            instructor.call('/api/bookings/'+str(bid)+'/request-payment','POST',expected=422)
            check(student.call('/api/students/3/progress')['pending_lessons']==1,'Approved lessons remain pending in student progress')
            instructor.call('/api/bookings/'+str(bid),'PATCH',{'status':'completed','attendance_status':'attended','progress_score':80,'progress_notes':'Good progress'})
            instructor.call('/api/bookings/'+str(bid)+'/request-payment','POST')
            instructor.call('/api/bookings/'+str(bid)+'/payment','PATCH',{'payment_status':'paid'})
            check(student.call('/api/students/3/progress')['completed_lessons']==1,'Attendance and progress tracking')
            check(instructor.call('/api/bookings/stats')['average_progress_score']==80,'Booking statistics')
            check(admin.call('/api/dashboard')['total_bookings']==1,'Dashboard metrics')
            check(other.call('/api/bookings')==[],'Instructor booking list is scoped')
            new=guest.call('/api/bookings','POST',dict(b,start_time='2027-05-11T09:00:00Z',end_time='2027-05-11T10:00:00Z'))
            # Read only the isolated test database to inspect queued mail and tokens.
            with sqlite3.connect(runtime/'test.sqlite') as db:
                check(db.execute('select count(*) from mail_outbox').fetchone()[0]>5,'Booking and payment emails persisted in outbox')
            db.close()
            failure_env=dict(env,MAIL_TRANSPORT='smtp')
            failed=subprocess.run(['php','bin/mail-worker.php'],cwd=ROOT,env=failure_env,check=True,capture_output=True,text=True)
            check(json.loads(failed.stdout)['failed']>0,'Missing SMTP configuration records retryable delivery failures')
            db=sqlite3.connect(runtime/'test.sqlite')
            db.execute("UPDATE mail_outbox SET available_at='2000-01-01 00:00:00'");db.commit();db.close()
            subprocess.run(['php','bin/mail-worker.php'],cwd=ROOT,env=env,check=True,capture_output=True)
            messages=[json.loads(x) for x in (runtime/'data/mail-test.jsonl').read_text().splitlines()]
            check(any(x['to']=='student@example.test' and x['ics'] for x in messages),'Student email and calendar attachment captured')
            alert=[x for x in messages if x['subject']=='New booking #'+str(new['id'])][0]
            token=re.search(r'token=([a-f0-9]+)',alert['body']).group(1)
            guest.call(f'/api/bookings/{new["id"]}/assign-by-token?token={token}',expected=404)
            guest.call(f'/api/bookings/{new["id"]}/assign-by-token','POST',{'token':token})
            guest.call(f'/api/bookings/{new["id"]}/assign-by-token','POST',{'token':token},expected=422)
            check(True,'Assignment uses POST and rejects token reuse')
            inv=admin.call('/api/invites','POST',{'email':'invited@example.test','role':'student','instructor_id':2,'expires_in_days':7})
            guest.call('/api/auth/signup','POST',{'username':'invited','email':'invited@example.test','full_name':'Invited Student','phone':'123','password':'Another-password-2026!','invite_code':inv['code']})
            guest.call('/api/auth/signup','POST',{'username':'invited2','email':'invited@example.test','full_name':'Invited Student','phone':'123','password':'Another-password-2026!','invite_code':inv['code']},expected=422)
            instructor.call('/api/invites','POST',{'email':'escalate@example.test','role':'instructor'},expected=403)
            check(True,'Invitation signup, replay prevention and role protection')
            cms={'title':'About Test','body':'<script>alert(1)</script>Safe text','meta_title':'About SEO','meta_description':'Description','is_published':True}
            admin.call('/api/cms/pages/about','PUT',cms)
            html=guest.call('/about')
            check('<title>About SEO | Selam Driving School</title>' in html and '&lt;script&gt;' in html,'Server-rendered metadata and escaped CMS content')
            check('Content-Security-Policy' in guest.headers and guest.headers['X-Content-Type-Options']=='nosniff','Security response headers')
            admin.call('/api/cms/pages/private-draft','PUT',dict(cms,is_published=False))
            guest.call('/api/cms/pages/private-draft',expected=404)
            check(all(x['slug']!='private-draft' for x in guest.call('/api/cms/pages')),'Draft content is private')
            admin.call('/api/cms/pages/about/seo','PATCH',{'meta_title':'Revised SEO'})
            check('Revised SEO' in guest.call('/about'),'SEO edits appear in HTML')
            rev=guest.call('/api/cms/pages/reviews/testimonials/submit','POST',{'author':'A Learner','rating':5,'testimonial':'Clear instruction and helpful feedback.'})
            url='/api/cms/pages/reviews/testimonials/submissions/'+str(rev['submission_id'])
            admin.call(url,'PATCH',{'status':'approved'}); admin.call(url,'PATCH',{'status':'approved'})
            check(len(guest.call('/api/cms/pages/reviews/testimonials')['items'])==1,'Review moderation is idempotent')
            admin.call(url,'PATCH',{'status':'rejected'})
            check(guest.call('/api/cms/pages/reviews/testimonials')['items']==[],'Rejected review removed from public content')
            admin.call('/api/admin/config/smtp','PUT',{'values':{'host':'smtp.example.test','password':'sensitive-test-password','port':'465','use_ssl':'true'}})
            cfg=admin.call('/api/admin/config/smtp')['values']
            check(cfg['password']=='********' and cfg['port']=='465','SMTP secrets masked and settings preserved')
            check('sensitive-test-password' not in (runtime/'config/secrets.json').read_text(),'Private settings encrypted at rest')
            admin.call('/api/admin/config/contact','PUT',{'values':{'phone_link':'javascript:alert(1)'}},expected=422)
            check(True,'Unsafe contact URL rejected')
            admin.call('/api/admin/config/cms_repeatables','PUT',{'values':{'services':json.dumps([{'title':'Bad link','cta_url':'javascript:alert(1)'}])}},expected=422)
            check(True,'Unsafe repeatable-card link rejected')
            admin.call('/api/admin/config/contact','PUT',{'values':{'phone':'0114 123 4567','email':'hello@example.test'}})
            check(guest.call('/api/public/settings/contact')['phone']=='0114 123 4567','Public settings update')
            guest.call('/api/admin/config/smtp',expected=401)
            for url in ['/.env','/config/secrets.json','/storage/app.sqlite','/vendor/autoload.php','/no-such-page']:
                guest.call(url,expected=404)
            check(True,'Private files and unknown pages unavailable')
            sitemap=guest.call('/sitemap.xml'); check('/about</loc>' in sitemap and 'private-draft' not in sitemap and '/portal' not in sitemap,'Sitemap excludes private pages and drafts')
            check('noindex' in guest.call('/portal'),'Portal excluded from indexing')
            check('FAQPage' in guest.call('/') and 'Booking Questions' in guest.call('/'),'Visible FAQ matches structured data')
            boundary='SelamTestBoundary'
            png=base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a6n8AAAAASUVORK5CYII=')
            def multipart(name, mime, content):
                return (f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="{name}"\r\nContent-Type: {mime}\r\n\r\n'.encode()+content+f'\r\n--{boundary}--\r\n'.encode())
            upload_headers={'Content-Type':f'multipart/form-data; boundary={boundary}'}
            image=admin.call('/api/media/upload-photo','POST',headers=upload_headers,raw=multipart('test.png','image/png',png))
            guest.call('/api'+image['url'])
            check(guest.headers['Content-Type']=='image/png','Uploaded photo served as a non-executable image')
            admin.call('/api/media/upload-photo','POST',headers=upload_headers,raw=multipart('test.svg','image/svg+xml',b'<svg onload="alert(1)"></svg>'),expected=422)
            student.call('/api/media/upload-photo','POST',headers=upload_headers,raw=multipart('test.png','image/png',png),expected=403)
            check(True,'SVG uploads and student uploads rejected')
            guest.call('/api/auth/login','POST',{'username':"admin' OR 1=1 --",'password':'not-a-password'},expected=401)
            check(True,'SQL injection login attempt rejected')
            instructor.call('/api/notifications','POST',{'recipient':'student@example.test','channel':'whatsapp','category':'reminder','message':'Lesson reminder'})
            instructor.call('/api/notifications','POST',{'recipient':'unrelated@example.test','channel':'email','category':'reminder','message':'Reminder'},expected=403)
            check(True,'SMS/WhatsApp queue retained and instructor recipients scoped')
            admin.call('/api/admin/users/preferences/1','PATCH',{'receive_booking_emails':False})
            check(admin.call('/api/admin/users/preferences')[0]['receive_booking_emails'] is False,'Administrator email preferences')
            assert admin.call('/api/auth/refresh','POST')['role']=='admin'
            check(True,'Session rotation and refresh')
            guest.call('/api/auth/forgot-password/request','POST',{'username':'student'})
            subprocess.run(['php','bin/mail-worker.php'],cwd=ROOT,env=env,check=True,capture_output=True)
            messages=[json.loads(x) for x in (runtime/'data/mail-test.jsonl').read_text().splitlines()]
            reset=[x for x in messages if x['to']=='student@example.test' and 'Reset token:' in x['body']][-1]
            token=re.search(r'Reset token: ([a-f0-9]+)',reset['body']).group(1)
            guest.call('/api/auth/forgot-password/confirm','POST',{'token':token,'new_password':'New-password-2026!'})
            student.call('/api/auth/session',expected=401)
            guest.call('/api/auth/forgot-password/confirm','POST',{'token':token,'new_password':'New-password-2026!'},expected=422)
            check(True,'Password reset invalidates sessions and is single-use')
            admin.call('/api/admin/users/4/freeze','PATCH',{'is_frozen':True}); other.call('/api/auth/session',expected=401)
            check(True,'Freezing user invalidates active session')
            admin.call('/api/admin/users/4','DELETE')
            check(all(x['id']!=4 for x in guest.call('/api/users/instructors')),'Deleted instructor hidden publicly')
            admin.call('/api/auth/logout','POST'); admin.call('/api/auth/session',expected=401)
            check(True,'Logout invalidates session')
            print('\n'.join('PASS '+x for x in passed))
            print(f'{len(passed)} integration checks passed. No external emails sent.')
        finally:
            server.terminate(); server.wait(timeout=10); log.close()
            if (runtime/'data/error.log').exists():
                errors=(runtime/'data/error.log').read_text()
                if errors: print('Application log:',errors[-2500:])

if __name__=='__main__': run()
