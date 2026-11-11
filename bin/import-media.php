<?php
declare(strict_types=1);
if(PHP_SAPI!=='cli') exit;
require dirname(__DIR__).'/config/bootstrap.php';
$source=realpath($argv[1]??''); if(!$source||!is_dir($source)) {fwrite(STDERR,"Usage: php bin/import-media.php PATH_TO_ORIGINAL_UPLOADS\n");exit(1);}
if(!is_dir(DATA_DIR.'/uploads')) mkdir(DATA_DIR.'/uploads',0700,true);
$count=0;
foreach(Db::all('SELECT id,profile_photo_url FROM users WHERE profile_photo_url IS NOT NULL') as $u) {
    $name=basename(parse_url($u['profile_photo_url'],PHP_URL_PATH)?:''); if(!$name) continue;
    $file=realpath($source.DIRECTORY_SEPARATOR.$name); if(!$file||!str_starts_with($file,$source.DIRECTORY_SEPARATOR)||!is_file($file)) continue;
    $mime=(new finfo(FILEINFO_MIME_TYPE))->file($file); $ext=['image/jpeg'=>'jpg','image/png'=>'png','image/webp'=>'webp'][$mime]??null; if(!$ext||!getimagesize($file)||filesize($file)>(int)env('UPLOAD_MAX_BYTES','5242880')) continue;
    $dest=bin2hex(random_bytes(24)).'.'.$ext; if(!copy($file,DATA_DIR.'/uploads/'.$dest)) throw new RuntimeException('Image copy failed'); Db::update('users',$u['id'],['profile_photo_url'=>'/media/'.$dest]);$count++;
}
echo "$count photos copied. Source files were not modified.\n";
