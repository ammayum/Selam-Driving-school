<?php
declare(strict_types=1);
final class DatabaseAdmin {
    private static function target(): PDO {
        $c=Config::group('database'); $allowed=explode(',',env('DB_ALLOWED_HOSTS','localhost,127.0.0.1'));
        if(!in_array($c['host']??'',$allowed,true)) Http::fail(422,'Database host must be in DB_ALLOWED_HOSTS');
        if(!preg_match('/^[a-zA-Z0-9_]{1,64}$/',$c['database']??'')) Http::fail(422,'Invalid database name');
        return new PDO('mysql:host='.$c['host'].';port='.(int)($c['port']??3306).';dbname='.$c['database'].';charset=utf8mb4',$c['username']??'',$c['password']??'',[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC,PDO::ATTR_EMULATE_PREPARES=>false,PDO::ATTR_TIMEOUT=>5]);
    }
    public static function dispatch(string $method,string $path,array $b): array {
        Auth::requireRoles(['admin']);
        if($path==='connection'&&$method==='PUT') { $v=[]; foreach(['host','username','database','password'] as $k) $v[$k]=Http::text($b,$k,255,$k!=='password'); $v['port']=(string)Http::integer($b['port']??3306,1,65535,'port'); if($v['password']==='') unset($v['password']); Config::save('database',$v); }
        if($path==='connection'&&in_array($method,['GET','PUT'])) { $v=Config::group('database'); return ['host'=>$v['host']??'localhost','port'=>(int)($v['port']??3306),'username'=>$v['username']??'','database'=>$v['database']??'','has_password'=>!empty($v['password'])]; }
        if($method!=='POST') Http::fail(405,'Method not allowed'); Http::limit('database-admin',10);
        if($path==='test') {try {$pdo=self::target();$pdo->query('SELECT 1');return ['ok'=>true,'message'=>'Connection successful'];} catch(PDOException) {return ['ok'=>false,'message'=>'Connection failed. Check the private connection settings.'];}}
        if($path==='migrate') {
            if(!Db::sqlite()) Http::fail(409,'Migration is for SQLite to a separate empty MySQL database'); $target=self::target();
            // Only an empty destination is accepted. Existing databases are never erased.
            if($target->query('SHOW TABLES')->fetch()) Http::fail(409,'Destination must be empty'); Schema::migrate($target); $rows=0;
            Db::transaction(function()use($target,&$rows){ Db::lock(); $target->beginTransaction(); try {
                foreach(Schema::tables() as $table=>$unused) {
                    if($table==='app_locks') continue;
                    foreach(Db::all('SELECT * FROM `'.$table.'`') as $r) { $sql='INSERT INTO `'.$table.'` (`'.implode('`,`',array_keys($r)).'`) VALUES ('.implode(',',array_fill(0,count($r),'?')).')'; $target->prepare($sql)->execute(array_map(fn($v)=>is_bool($v)?(int)$v:$v,array_values($r)));$rows++; }
                } $target->commit();
            } catch(Throwable $ex) {$target->rollBack();throw $ex;} });
            $c=Config::group('database'); Config::save('database',['migration_ready'=>hash('sha256',json_encode(array_intersect_key($c,array_flip(['host','port','database','username']))))]); Auth::audit('database.migrate','database',null);
            return ['ok'=>true,'tables'=>count(Schema::tables()),'rows'=>$rows,'target_host'=>$c['host']];
        }
        if($path==='apply') {
            $pdo=self::target(); foreach(array_keys(Schema::tables()) as $table) $pdo->query('SELECT id FROM `'.$table.'` LIMIT 1');
            $c=Config::group('database'); if(empty($c['migration_ready'])) Http::fail(409,'Complete migration before applying');
            $fingerprint=hash('sha256',json_encode(array_intersect_key($c,array_flip(['host','port','database','username'])))); if(!hash_equals($c['migration_ready'],$fingerprint)) Http::fail(409,'Connection changed after migration');
            if(Db::sqlite()) {
                foreach(array_keys(Schema::tables()) as $table) {
                    if(in_array($table,['app_locks','activity_logs'])) continue;
                    $source=Db::all('SELECT * FROM `'.$table.'` ORDER BY id');
                    $target=array_map([Db::class,'cast'],$pdo->query('SELECT * FROM `'.$table.'` ORDER BY id')->fetchAll());
                    if($source!=$target) Http::fail(409,'Data changed after migration. Keep the current database and migrate again into a new empty destination during maintenance.');
                }
            }
            Auth::audit('database.apply','database',null); Config::save('database',['active'=>'true']); return ['ok'=>true,'message'=>'MySQL selected for subsequent requests. Keep the SQLite backup.'];
        } Http::fail(404,'Endpoint not found');
    }
}
