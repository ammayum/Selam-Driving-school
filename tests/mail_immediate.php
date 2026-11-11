<?php
declare(strict_types=1);
require dirname(__DIR__).'/config/bootstrap.php';
if(env('APP_ENV')!=='testing' || !str_contains(env('DB_DSN'),'dbname=selam_mail_test_')) exit(1);
Schema::migrate();
Config::save('notification_templates',['default'=>json_encode(['subject'=>'Message: {{subject}}','body'=>"Welcome\n{{details}}\n{{site_name}}"])]);
function check(bool $ok,string $label): void {
    if(!$ok) throw new RuntimeException($label);
    echo "PASS: $label\n";
}
function enqueue(): int { return Mailer::queue('recipient@example.test','Test','Synthetic body','test'); }
function status(int $id): string { return Db::one('SELECT status FROM notifications WHERE id=?',[$id])['status']; }
$id=enqueue();
check(status($id)==='captured','immediate delivery without worker invocation');
$mail=json_decode(file(DATA_DIR.'/mail-test.jsonl')[0],true);
check($mail['subject']==='Message: Test' && $mail['body']==="Welcome\nSynthetic body\nSelam Driving School",'CMS template applied before sending');
$id=Db::transaction(function() {
    $id=enqueue(); check(status($id)==='queued','no delivery before commit'); return $id;
});
check(status($id)==='captured','delivery after commit');
$before=count(file(DATA_DIR.'/mail-test.jsonl'));
try { Db::transaction(function() { enqueue(); throw new RuntimeException('Rollback'); }); }
catch(RuntimeException $ex) { if($ex->getMessage()!=='Rollback') throw $ex; }
Db::transaction(static fn()=>null);
check(count(file(DATA_DIR.'/mail-test.jsonl'))===$before,'rollback discards delivery callback');
putenv('MAIL_SEND_IMMEDIATELY=false'); $old=enqueue();
putenv('MAIL_SEND_IMMEDIATELY=true'); $new=enqueue();
check(status($old)==='queued' && status($new)==='captured','new delivery targets its own queue entry');
Mailer::deliverNow($new);
check(Db::one('SELECT attempts FROM mail_outbox WHERE notification_id=?',[$new])['attempts']===1,'sent email is not resent');
putenv('MAIL_TRANSPORT=smtp');
Config::save('smtp',['host'=>'','from_email'=>'']);
$failed=enqueue();
check(status($failed)==='retrying','SMTP failure remains retryable without failing caller');
check(Db::one('SELECT sent_at FROM mail_outbox WHERE notification_id=?',[$failed])['sent_at']===null,'failure is never marked sent');
putenv('MAIL_TRANSPORT=log');
Mailer::work(1);
check(status($old)==='captured','worker still drains older queued mail');
