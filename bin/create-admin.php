<?php
declare(strict_types=1);
if(PHP_SAPI!=='cli') exit;
require dirname(__DIR__).'/config/bootstrap.php'; require_once ROOT.'/app/Http.php';
function prompt(string $label): string { echo $label.': '; return trim(fgets(STDIN)?:''); }
$data=['full_name'=>prompt('Full name'),'username'=>prompt('Username'),'email'=>prompt('Email'),'phone'=>prompt('Phone')];
echo "Password input is visible in this CLI. Use a private terminal.\n";
$data['password']=prompt('Password (12+ characters)');
try { Auth::password($data); $u=Auth::create($data,'admin'); echo 'Administrator created: '.$u['username']."\n"; } catch(Throwable $ex) {fwrite(STDERR,$ex->getMessage()."\n");exit(1);}
