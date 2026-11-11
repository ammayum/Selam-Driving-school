"""Temporary-password lifecycle checks in a disposable database."""
import json
import subprocess
from integration import Client, ROOT


def run(env, admin, base):
    secrets=[]
    for role in ['student','instructor']:
        user=admin.call('/api/admin/users','POST',dict(full_name='Temporary '+role,email='temporary-'+role+'@example.test',phone='123',role=role))
        password=user['temporary_password']; secrets.append(password)
        assert len(password)==24 and all(c in '0123456789abcdef' for c in password)
        first,second=Client(base),Client(base)
        for client in [first,second]:
            response=client.call('/api/auth/login','POST',dict(username=user['username'],password=password))
            assert response['must_change_password']
            client.call('/api/bookings/my',expected=403)
        first.call('/api/auth/change-password','POST',dict(current_password=password,new_password='New-private-password-2026!'),csrf=False,expected=403)
        first.call('/api/auth/change-password','POST',dict(current_password='wrong',new_password='New-private-password-2026!'),expected=403)
        first.call('/api/auth/change-password','POST',dict(current_password=password,new_password=password),expected=422)
        first.call('/api/auth/change-password','POST',dict(current_password=password,new_password='New-private-password-2026!'))
        assert not first.call('/api/auth/session')['must_change_password']
        first.call('/api/bookings/my')
        second.call('/api/auth/session',expected=401)
        fresh=Client(base)
        fresh.call('/api/auth/login','POST',dict(username=user['username'],password=password),expected=401)
        # Reset the test-only IP limiter between roles; real deployments retain it.
        subprocess.run(['php','-r',"require 'config/bootstrap.php'; foreach(glob(DATA_DIR.'/rate-*') as $file) unlink($file);"],cwd=ROOT,env=env,check=True)
    assert secrets[0]!=secrets[1]
    users=admin.call('/api/admin/users?role=instructor')+admin.call('/api/admin/users?role=student')
    assert all('temporary_password' not in u and 'password_hash' not in u for u in users)
    logs=json.dumps(admin.call('/api/activity-logs'))
    assert all(secret not in logs for secret in secrets)
    expired=admin.call('/api/admin/users','POST',dict(full_name='Expired Temporary',email='expired-temp@example.test',phone='123',role='student'))
    subprocess.run(['php','-r',"require 'config/bootstrap.php'; Db::update('users',"+str(expired['id'])+",['temporary_password_expires_at'=>'2000-01-01 00:00:00']);"],cwd=ROOT,env=env,check=True)
    Client(base).call('/api/auth/login','POST',dict(username=expired['username'],password=expired['temporary_password']),expected=401)
    print('PASS temporary passwords: both roles, unique secrets, expiry, forced change, CSRF, session revocation and no password leakage in lists/audits.')
