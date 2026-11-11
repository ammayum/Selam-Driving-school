<?php
declare(strict_types=1);
define('DATA_DIR',sys_get_temp_dir().'/selam-mail-worker-'.bin2hex(random_bytes(8)));
mkdir(DATA_DIR,0700);
require dirname(__DIR__).'/app/MailWorker.php';
final class Db {
    public static bool $transaction=false;
    public static function get(): self { return new self(); }
    public function inTransaction(): bool { return self::$transaction; }
}
final class Mailer {
    public static int $calls=0;
    public static bool $fail=false;
    public static function work(int $limit): void {
        if($limit!==1) throw new LogicException('Unbounded batch');
        self::$calls++;
        if(self::$fail) throw new RuntimeException('Simulated mail failure');
    }
}
function check(bool $ok,string $label): void {
    if(!$ok) throw new RuntimeException($label);
    echo "PASS: $label\n";
}
$path=DATA_DIR.'/mail-auto-worker.lock';
try {
    MailWorker::run();
    check(Mailer::$calls===1,'process one batch');
    MailWorker::run();
    check(Mailer::$calls===1,'throttle repeated requests');
    file_put_contents($path,'0');
    $lock=fopen($path,'c+'); flock($lock,LOCK_EX);
    MailWorker::run();
    check(Mailer::$calls===1,'skip overlapping worker');
    fclose($lock);
    Db::$transaction=true;
    MailWorker::run();
    check(Mailer::$calls===1,'skip uncommitted transaction');
    Db::$transaction=false;
    file_put_contents($path,'0'); Mailer::$fail=true;
    MailWorker::run();
    check(Mailer::$calls===2,'contain worker failures');
    file_put_contents($path,'0'); Mailer::$fail=false;
    MailWorker::run();
    check(Mailer::$calls===3,'release lock after failure');
} finally {
    if(is_file($path)) unlink($path);
    rmdir(DATA_DIR);
}
