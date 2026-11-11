<?php
declare(strict_types=1);
final class Db {
    private static ?PDO $pdo = null;
    private static array $afterCommit = [];
    public static function get(): PDO {
        if (self::$pdo) return self::$pdo;
        $dsn = env('DB_DSN', 'mysql:host=db5021612448.hosting-data.io;port=3306;dbname=dbs16212533;charset=utf8mb4');
        $private=Config::privateAll()['database']??[];
        $dbUser=env('DB_USER','root'); $dbPassword=env('DB_PASSWORD');
        if(($private['active']??'')==='true') {
            if(!in_array($private['host']??'',explode(',',env('DB_ALLOWED_HOSTS','localhost,127.0.0.1')),true)||!preg_match('/^[a-zA-Z0-9_]{1,64}$/',$private['database']??'')) throw new RuntimeException('Invalid private database configuration');
            $dsn='mysql:host='.$private['host'].';port='.(int)$private['port'].';dbname='.$private['database'].';charset=utf8mb4'; $dbUser=$private['username']; $dbPassword=$private['password']??'';
        }
        if (env('APP_ENV') !== 'testing' && !str_starts_with($dsn, 'mysql:')) throw new RuntimeException('This application requires a MySQL database.');
        if (str_starts_with($dsn, 'sqlite:') && !preg_match('~^sqlite:([A-Za-z]:|/)~', $dsn)) $dsn = 'sqlite:' . ROOT . '/' . substr($dsn, 7);
        self::$pdo = new PDO($dsn, $dbUser, $dbPassword, [PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC, PDO::ATTR_EMULATE_PREPARES=>false]);
        if (self::sqlite()) { self::$pdo->exec('PRAGMA foreign_keys=ON'); self::$pdo->exec('PRAGMA busy_timeout=10000'); }
        return self::$pdo;
    }
    public static function sqlite(): bool { return self::get()->getAttribute(PDO::ATTR_DRIVER_NAME) === 'sqlite'; }
    public static function run(string $sql, array $args=[]): PDOStatement { $s=self::get()->prepare($sql); $s->execute($args); return $s; }
    public static function all(string $sql, array $args=[]): array { return array_map([self::class,'cast'], self::run($sql,$args)->fetchAll()); }
    public static function one(string $sql, array $args=[]): ?array { $r=self::run($sql,$args)->fetch(); return $r ? self::cast($r) : null; }
    public static function cast(array $r): array {
        foreach ($r as $k=>&$v) {
            if ($v===null) continue;
            if (in_array($k,['is_active','is_published','is_frozen','is_deleted','allow_email_assign','receive_booking_emails'])) $v=(bool)$v;
            elseif ($k==='id' || str_ends_with($k,'_id') || in_array($k,['lesson_count','rating','progress_score','attempts'])) $v=(int)$v;
            elseif (in_array($k,['price','hours','package_price','package_hours'])) $v=(float)$v;
            elseif (in_array($k,['role','status','instructor_type','attendance_status','payment_status','payment_method'])) $v=strtolower((string)$v);
        } return $r;
    }
    public static function insert(string $table, array $data): int {
        $keys=array_keys($data); self::run('INSERT INTO `'.$table.'` (`'.implode('`,`',$keys).'`) VALUES ('.implode(',',array_fill(0,count($keys),'?')).')',array_values($data)); return (int)self::get()->lastInsertId();
    }
    public static function update(string $table, int $id, array $data): void {
        if (!$data) return; $parts=array_map(fn($k)=>'`'.$k.'`=?',array_keys($data)); self::run('UPDATE `'.$table.'` SET '.implode(',',$parts).' WHERE id=?',[...array_values($data),$id]);
    }
    public static function transaction(callable $fn): mixed {
        self::get()->beginTransaction();
        try { $result=$fn(); self::get()->commit(); }
        catch(Throwable $ex) {
            self::$afterCommit=[];
            if(self::get()->inTransaction()) self::get()->rollBack();
            throw $ex;
        }
        $callbacks=self::$afterCommit; self::$afterCommit=[];
        foreach($callbacks as $callback) {
            try { $callback(); }
            catch(Throwable $ex) { error_log('After-commit task failed: '.get_class($ex)); }
        }
        return $result;
    }
    public static function afterCommit(callable $callback): void {
        if(self::get()->inTransaction()) self::$afterCommit[]=$callback;
        else $callback();
    }
    public static function lock(): void { self::run('UPDATE app_locks SET value=value+1 WHERE id=1'); }
}
