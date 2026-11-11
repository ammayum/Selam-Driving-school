<?php
declare(strict_types=1);
if(PHP_SAPI!=='cli') exit;
$root=dirname(__DIR__);
if(!is_file($root.'/.env')) {
    $content=file_get_contents($root.'/.env.example'); $content=str_replace("APP_KEY=\n",'APP_KEY='.bin2hex(random_bytes(32))."\n",str_replace("\r\n","\n",$content));
    file_put_contents($root.'/.env',$content,LOCK_EX); chmod($root.'/.env',0600);
}
require $root.'/config/bootstrap.php';
require_once ROOT.'/app/Http.php';
Schema::migrate();
echo "Configuration and database ready. Run php bin/create-admin.php to create your administrator.\n";
