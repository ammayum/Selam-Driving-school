"""Run inside the disposable MySQL harness, after other account-dependent tests."""
import json
import re
import subprocess
from pathlib import Path
from integration import Client, ROOT


def run(env, guest, admin, owner, student):
    guest.call('/api/cms/pages/catalog', expected=401)
    owner.call('/api/cms/pages/catalog', expected=403)
    catalog = admin.call('/api/cms/pages/catalog')
    assert {'home_packages','faq_booking','book','site_footer','lessons_manual','login','signup'} <= {p['slug'] for p in catalog}
    for slug in ['home_packages','faq_booking','lessons_manual','book','site_footer']:
        row = dict(title='Published '+slug, body='Copy for '+slug, is_published=True)
        admin.call('/api/cms/pages/'+slug, 'PUT', row)
        assert guest.call('/api/cms/pages/'+slug+'?published=1')['title']==row['title']
    html = guest.call('/')
    assert 'Published home_packages' in html and 'Published faq_booking' in html
    schema = json.loads(re.search(r'<script id="ld-json"[^>]*>(.*?)</script>', html).group(1))
    faq = next(x for x in schema['@graph'] if x['@type']=='FAQPage')
    assert faq['mainEntity'][0]['name']=='Published faq_booking'
    assert 'Published lessons_manual' in guest.call('/lessons')
    assert 'Published book' in guest.call('/book')
    assert 'Published site_footer' in html
    admin.call('/api/cms/pages/home_packages','PUT',dict(title='Secret draft',body='Private draft',is_published=False))
    assert 'Secret draft' not in guest.call('/')
    assert admin.call('/api/cms/pages/home_packages?published=1')['title']!='Secret draft'
    assert 'home_packages' not in guest.call('/sitemap.xml')
    guest.call('/home_packages', expected=404)
    admin.call('/api/cms/pages/custom-guide','PUT',dict(title='Custom guide',body='Safe <script> copy',is_published=True))
    assert 'Safe &lt;script&gt; copy' in guest.call('/custom-guide')
    print('PASS CMS: catalog permissions, published section wiring, draft isolation, custom pages, escaping and FAQ schema parity.')

    route='/api/admin/users/3/reset-password'
    guest.call(route,'POST',{},expected=401)
    owner.call(route,'POST',{},expected=403)
    student.call(route,'POST',{},expected=403)
    admin.call(route,'POST',{},csrf=False,expected=403)
    admin.call(route,'POST',dict(current_password='wrong'),expected=403)
    assert len(admin.call('/api/admin/users?role=admin'))==1
    # Admin is last because completing its reset revokes this session too.
    for uid,name,session in [(3,'student',student),(2,'instructor',owner),(1,'admin',admin)]:
        response=admin.call(f'/api/admin/users/{uid}/reset-password','POST',dict(current_password='Test-password-2026!'))
        assert 'queued' in response['message'] and 'token' not in response
        for _ in range(10):
            subprocess.run(['php','bin/mail-worker.php'],cwd=ROOT,env=env,check=True,capture_output=True)
        messages=[json.loads(line) for line in (Path(env['APP_DATA_DIR'])/'mail-test.jsonl').read_text().splitlines()]
        mail=next(m for m in reversed(messages) if m['to']==name+'@example.test' and 'Reset token:' in m['body'])
        token=re.search(r'Reset token: ([a-f0-9]+)',mail['body']).group(1)
        logs=admin.call('/api/activity-logs')
        assert any(x['action']=='user.password_reset_requested' and x['target_id']==uid for x in logs)
        assert token not in json.dumps(logs)
        guest.call('/api/auth/forgot-password/confirm','POST',dict(token=token,new_password='New-test-password-2026!'))
        guest.call('/api/auth/forgot-password/confirm','POST',dict(token=token,new_password='New-test-password-2026!'),expected=422)
        session.call('/api/auth/session',expected=401)
        fresh=Client(guest.base)
        fresh.call('/api/auth/login','POST',dict(username=name,password='New-test-password-2026!'))
    print('PASS password reset: all three roles, reauthentication, CSRF/role restrictions, queued email, private tokens, single-use and session revocation.')
