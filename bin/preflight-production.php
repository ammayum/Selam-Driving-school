<?php
declare(strict_types=1);

/**
 * Read-only release preflight. Run on the IONOS host after uploading a new
 * release and configuring its own .env, before changing the domain target.
 * Does not migrate or modify production data, trigger email or expose secrets.
 */
if(PHP_SAPI!=='cli') exit(1);
require dirname(__DIR__).'/config/bootstrap.php';
require_once ROOT.'/app/Http.php';

$checks=[];
$check=static function(string $name,bool $ok,string $detail='') use (&$checks): void {
    $checks[]=['check'=>$name,'ok'=>$ok,'detail'=>$detail];
};
$check('PHP >= 8.2',PHP_VERSION_ID>=80200,PHP_VERSION);
foreach(['pdo_mysql','mbstring','fileinfo','openssl','gd'] as $module) {
    $check('PHP extension '.$module,extension_loaded($module));
}
$check('production mode',env('APP_ENV')==='production');
$url=env('APP_URL');
$validUrl=filter_var($url,FILTER_VALIDATE_URL)!==false
    && str_starts_with($url,'https://')
    && !str_contains($url,'localhost');
$check('canonical HTTPS APP_URL',$validUrl);
$check('configured APP_KEY',strlen(env('APP_KEY'))>=32);
$check('Composer autoloader',is_file(ROOT.'/vendor/autoload.php'));
$check('compiled React manifest',is_file(ROOT.'/public/build/.vite/manifest.json'));
$check('private writable storage',is_dir(DATA_DIR) && is_writable(DATA_DIR));
$check('private writable config',is_dir(PRIVATE_DIR) && is_writable(PRIVATE_DIR));
$public=realpath(ROOT.'/public');
$data=realpath(DATA_DIR);
$private=realpath(PRIVATE_DIR);
$outside=static fn($path)=>$path!==false && $public!==false
    && $path!==$public && !str_starts_with($path,$public.DIRECTORY_SEPARATOR);
$check('storage outside document root',$outside($data));
$check('config outside document root',$outside($private));
$check('upload size setting', (int)env('UPLOAD_MAX_BYTES','5242880')<=((int)ini_get('upload_max_filesize')*1048576) || (int)ini_get('upload_max_filesize')===0,'Check effective PHP upload limits separately (M suffix expected)');
try {
    Db::get()->query('SELECT 1')->fetchColumn();
    $check('MySQL connection',true);
} catch(Throwable $ex) {
    $check('MySQL connection',false,'Database connection failed; inspect private logs');
}
$indexing=env('APP_INDEXING','true');
$checks[]=['check'=>'Search indexing intent','ok'=>true,'detail'=>($indexing==='true'?'Enabled (only for live production)': 'Disabled (expected for staging)')];
$checks[]=['check'=>'SMTP configuration','ok'=>true,'detail'=>'Confirm from address and send one approved test booking separately'];
$pass=count(array_filter($checks,static fn($x)=>$x['ok']));
echo json_encode(['passed'=>$pass,'total'=>count($checks),'checks'=>$checks],JSON_PRETTY_PRINT|JSON_UNESCAPED_SLASHES)."\n";
exit($pass===count($checks)?0:1);
