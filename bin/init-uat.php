<?php
declare(strict_types=1);
if(PHP_SAPI!=='cli') exit;
$root=dirname(__DIR__);
$file=fopen($root.'/.env','x');
if(!$file) {fwrite(STDERR,"An environment file already exists; it was not changed.\n"); exit(1);}
$template=str_replace("\r\n","\n",file_get_contents($root.'/.env.uat.example'));
fwrite($file,str_replace("APP_KEY=\n",'APP_KEY='.bin2hex(random_bytes(32))."\n",$template));
fclose($file); chmod($root.'/.env',0600);
echo "UAT environment initialized with a unique key. Set URL, database and SMTP values before setup. No database was changed.\n";
