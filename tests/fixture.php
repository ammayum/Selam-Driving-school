<?php
declare(strict_types=1);
require dirname(__DIR__).'/config/bootstrap.php'; require_once ROOT.'/app/Http.php'; Schema::migrate();
foreach(['admin','instructor','student'] as $role) Auth::create(['full_name'=>ucfirst($role).' Test','username'=>$role,'email'=>$role.'@example.test','phone'=>'07000000000','password'=>'Test-password-2026!'],$role);
Auth::create(['full_name'=>'Other Instructor','username'=>'other','email'=>'other@example.test','phone'=>'07000000001','password'=>'Test-password-2026!'],'instructor');
$salt=str_repeat('a',32); Db::update('users',3,['password_hash'=>$salt.'$'.hash_pbkdf2('sha256','Test-password-2026!',$salt,120000,64)]);
echo "Isolated fixtures ready\n";
