"""User-management checks inside the disposable MySQL harness."""

def run(guest, admin, owner, student):
    password={'current_password':'Test-password-2026!'}
    payload=dict(full_name='Managed Test',email='managed@example.test',phone='07000000000',role='student')
    guest.call('/api/admin/users','POST',payload,expected=401)
    owner.call('/api/admin/users','POST',payload,expected=403)
    student.call('/api/admin/users','POST',payload,expected=403)
    admin.call('/api/admin/users','POST',payload,csrf=False,expected=403)
    created=admin.call('/api/admin/users','POST',dict(payload,password='ignored-password'))
    assert 'password_hash' not in created
    uid=created['id']; path=f'/api/admin/users/{uid}'
    admin.call(path,'PUT',dict(full_name='Updated Test',phone='123'))
    admin.call(path,'PUT',dict(role='admin'),expected=422)
    admin.call(path,'PUT',dict(email='admin@example.test'),expected=409)
    admin.call(path+'/freeze','PATCH',dict(is_frozen=True))
    admin.call(path+'/reset-password','POST',password,expected=422)
    admin.call(path+'/freeze','PATCH',dict(is_frozen=False))
    admin.call(path,'DELETE')
    assert uid not in [u['id'] for u in admin.call('/api/admin/users?role=student')]
    assert next(u for u in admin.call('/api/admin/users?role=student&include_deleted=true') if u['id']==uid)['is_deleted']
    admin.call(path,'PUT',dict(full_name='Hidden change'),expected=422)
    admin.call(path+'/restore','PATCH')
    assert uid in [u['id'] for u in admin.call('/api/admin/users?role=student')]
    admin.call('/api/admin/users','POST',dict(payload,email='manager@example.test',role='admin'),expected=422)
    second=admin.call('/api/admin/users','POST',dict(payload,email='manager@example.test',role='admin',**password))
    second_path=f'/api/admin/users/{second["id"]}'
    admin.call(second_path,'PUT',dict(full_name='Second Admin'),expected=422)
    admin.call(second_path,'PUT',dict(full_name='Second Admin',**password))
    admin.call('/api/admin/users/1','DELETE',password,expected=403)
    admin.call('/api/admin/users/1/freeze','PATCH',dict(is_frozen=True,**password),expected=403)
    admin.call(second_path+'/freeze','PATCH',dict(is_frozen=True,**password))
    admin.call(second_path+'/freeze','PATCH',dict(is_frozen=False,**password))
    admin.call(second_path,'DELETE',password)
    actions={r['action'] for r in admin.call('/api/activity-logs') if r['target_type']=='user' and r['target_id']==uid}
    assert {'user.create','user.update','user.freeze','user.unfreeze','user.delete','user.restore'} <= actions
    print('PASS user management: role/CSRF checks, add/edit/freeze/delete/restore, admin reauthentication, self-protection and audit trail.')
