<?php
declare(strict_types=1);
// Read-only source connection; this command only writes to the new PHP database.
if(PHP_SAPI!=='cli') exit;
require dirname(__DIR__).'/config/bootstrap.php'; require_once ROOT.'/app/Http.php';
try {
    $sourceDsn=env('IMPORT_DSN'); if(!$sourceDsn) throw new RuntimeException('Set IMPORT_DSN, IMPORT_USER and IMPORT_PASSWORD in your shell. Use --apply after reviewing the dry run.');
    if($sourceDsn===env('DB_DSN')) throw new RuntimeException('Source and destination must differ');
    $source=new PDO($sourceDsn,env('IMPORT_USER'),env('IMPORT_PASSWORD'),[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC]);
    if($source->getAttribute(PDO::ATTR_DRIVER_NAME)==='sqlite') $source->exec('PRAGMA query_only=ON'); else $source->exec('SET SESSION TRANSACTION READ ONLY');
    $source->beginTransaction();
    $tables=array_keys(Schema::tables()); $skip=['mail_outbox','password_reset_tokens','booking_assignment_tokens','auth_versions','app_locks']; $data=[];
    foreach($tables as $table) {
        if(in_array($table,$skip)) continue;
        try {$data[$table]=$source->query('SELECT * FROM `'.$table.'`')->fetchAll();} catch(PDOException) {echo "Source table unavailable: $table\n";continue;}
        if($table==='system_configs') $data[$table]=array_values(array_filter($data[$table],fn($r)=>in_array($r['group'],['cms_repeatables','media','contact'])));
        echo $table.': '.count($data[$table])." rows\n";
    }
    $source->rollBack();
    if(!in_array('--apply',$argv,true)) {echo "Dry run only. Re-run with --apply to import into an empty PHP database.\n";exit;}
    Schema::migrate(); foreach(array_keys($data) as $table) if(Db::one('SELECT id FROM `'.$table.'` LIMIT 1')) throw new RuntimeException('Target must be empty. Existing target data in '.$table);
    Db::transaction(function()use($data){ Db::lock(); foreach($data as $table=>$rows) foreach($rows as $r) {
        $r=Db::cast($r); foreach($r as &$value) if(is_bool($value)) $value=(int)$value; unset($value);
        if($table==='users') { $r['email']=strtolower($r['email']); $r['username']=strtolower($r['username']??('imported_'.$r['id'])); $r['password_hash']=$r['password_hash']??password_hash(bin2hex(random_bytes(32)),PASSWORD_DEFAULT); }
        if($table==='invites') $r['code']=hash('sha256',$r['code']);
        if($table==='lesson_packages') { $r['hours']=$r['hours']??$r['lesson_count']; $r['package_type']=$r['package_type']??(str_contains(strtolower($r['title']),'automatic')?'automatic':'manual'); }
        if($table==='system_configs' && Db::one('SELECT id FROM system_configs WHERE `group`=? AND `key`=?',[$r['group'],$r['key']])) continue;
        Db::insert($table,$r);
    }});
    echo "Import complete. Re-enter SMTP/SMS settings privately. Tokens and active sessions were not imported. Copy approved photos using bin/import-media.php.\n";
} catch(Throwable $ex) {fwrite(STDERR,'Import failed: '.$ex->getMessage()."\n");exit(1);}
