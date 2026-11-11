"""Booking hardening checks; called only inside the disposable MySQL harness."""
import json
import subprocess
import time
from integration import ROOT


def run(env, guest, admin, owner, other, student, package):
    payload = dict(package_id=package['id'], lesson_type='automatic',
                   start_time='2028-06-10T10:00:00Z', end_time='2028-06-10T11:00:00Z',
                   pickup_location='Private pickup', guest_name='Student Test',
                   guest_email='student@example.test', guest_phone='07000000000',
                   payment_method='advance_2_hours')
    for client in [guest, student, owner]:
        client.call('/api/bookings', 'POST', dict(payload, instructor_id=2), expected=403)
    for start, end in [('2020-01-01T10:00:00Z', '2020-01-01T11:00:00Z'),
                       ('2040-01-01T10:00:00Z', '2040-01-01T11:00:00Z'),
                       ('2028-06-10T10:00:00Z', '2028-06-10T10:05:00Z'),
                       ('2028-06-10T10:00:00Z', '2028-06-11T10:00:00Z')]:
        guest.call('/api/bookings', 'POST', dict(payload, start_time=start, end_time=end), expected=422)
    booking = guest.call('/api/bookings', 'POST', dict(payload, package_price=1, package_hours=999))
    path = '/api/bookings/' + str(booking['id'])
    assert booking['package_price'] == package['price']
    assert booking['package_hours'] == package['hours'] and booking['package_currency'] == 'GBP'
    admin.call('/api/packages/'+str(package['id']), 'PUT', dict(package, price=250, hours=6))
    saved = admin.call(path, 'PATCH', dict(package_id=package['id'], notes='Private notes', instructor_id=2))
    assert saved['package_price'] == package['price'] and saved['package_hours'] == package['hours']
    owner.call(path, 'PATCH', dict(end_time='2030-01-01T00:00:00Z'), expected=422)
    other.call(path, 'PATCH', dict(status='completed'), expected=403)
    other.call(path+'/payment', 'PATCH', dict(payment_status='paid'), expected=403)
    owner.call(path, 'PATCH', dict(status='completed'))
    owner.call(path+'/payment', 'PATCH', dict(payment_status='paid'))
    logs = [x for x in admin.call('/api/activity-logs') if x['target_type']=='booking' and x['target_id']==booking['id']]
    assert {'booking.create', 'booking.update', 'booking.payment'} <= {x['action'] for x in logs}
    assert 'Private notes' not in json.dumps(logs) and 'Private pickup' not in json.dumps(logs)
    payment = next(x for x in logs if x['action']=='booking.payment')
    assert json.loads(payment['details'])['changes']['payment_status'] == {'from':'not_requested','to':'paid'}
    student.call('/api/activity-logs', expected=403)

    # Separate PHP connections prove authorization happens AFTER waiting for the lock.
    def php(code):
        return subprocess.Popen(['php', '-r', "require 'config/bootstrap.php'; require_once 'app/Http.php'; "+code],
                                cwd=ROOT, env=env, stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                                stderr=subprocess.PIPE, text=True)

    for operation in ["Bookings::update($id,['notes'=>'forbidden'])",
                      "Bookings::payment($id,['payment_status'=>'not_requested'])"]:
        admin.call(path, 'PATCH', dict(instructor_id=2))
        holder = php(f"Db::get()->beginTransaction(); Db::lock(); echo \"ready\\n\"; fflush(STDOUT); fgets(STDIN); Db::update('bookings',{booking['id']},['instructor_id'=>4]); Db::get()->commit();")
        caller = None
        try:
            assert holder.stdout.readline().strip() == 'ready'
            caller = php("$_SESSION=['uid'=>2,'version'=>1,'expires'=>time()+3600]; "
                         f"$id={booking['id']}; echo Db::get()->query('SELECT CONNECTION_ID()')->fetchColumn().\"\\n\"; fflush(STDOUT); "
                         "try { "+operation+"; echo 'unexpected success'; } catch(HttpError $e) { echo $e->status; }")
            connection = int(caller.stdout.readline())
            waiting = False
            for _ in range(50):
                probe = php(f"echo Db::one('SELECT INFO FROM information_schema.PROCESSLIST WHERE ID=?',[{connection}])['INFO']??'';")
                output, _ = probe.communicate(timeout=5)
                if 'UPDATE app_locks' in output:
                    waiting = True
                    break
                time.sleep(.05)
            assert waiting, 'Concurrent mutation did not reach the transaction lock'
            holder.communicate('release\n', timeout=5)
            output, errors = caller.communicate(timeout=5)
            assert output == '403', (output, errors)
        finally:
            for process in [holder, caller]:
                if process and process.poll() is None:
                    process.kill()
                    process.communicate()
    replacement = next(p for p in admin.call('/api/packages') if p['package_type']=='automatic' and p['id']!=package['id'])
    other.call(path, 'PATCH', dict(package_id=replacement['id']), expected=403)
    changed = admin.call(path, 'PATCH', dict(package_id=replacement['id']))
    assert changed['package_price']==replacement['price'] and changed['package_hours']==replacement['hours']
    # Simulate an older database; unknown historical terms must stay unknown.
    migration = php("foreach(['package_price','package_hours','package_currency'] as $column) Db::get()->exec('ALTER TABLE bookings DROP COLUMN '.$column); Schema::migrate(); Schema::migrate(); echo json_encode(Bookings::get("+str(booking['id'])+"));")
    output, errors = migration.communicate(timeout=10)
    assert migration.returncode==0, errors
    legacy = json.loads(output)
    assert all(legacy[key] is None for key in ['package_price','package_hours','package_currency'])
    assert legacy['id']==booking['id'] and legacy['payment_status']=='paid'
    print('PASS booking security: assignment roles, time bounds, immutable terms, redacted audit changes, concurrent ownership checks, package switches and idempotent legacy migration.')
