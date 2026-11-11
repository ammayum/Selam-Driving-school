<?php
declare(strict_types=1);
if(PHP_SAPI!=='cli') exit;
$checks=[];
try {
    require dirname(__DIR__).'/config/bootstrap.php';
    $host=parse_url(env('APP_URL'),PHP_URL_HOST)?:'';
    $checks['production_mode']=env('APP_ENV')==='production';
    $checks['https_url']=str_starts_with(env('APP_URL'),'https://') && $host!=='' && !str_ends_with($host,'.invalid') && !in_array($host,['localhost','127.0.0.1']);
    $checks['indexing_disabled']=env('APP_INDEXING')==='false';
    $private=Config::privateAll()['database']??[];
    $active=($private['active']??'')==='true';
    $user=$active?($private['username']??''):env('DB_USER');
    $password=$active?($private['password']??''):env('DB_PASSWORD');
    $checks['restricted_database_account']=$user!=='' && strtolower($user)!=='root' && $password!=='' && !str_contains($password,'REPLACE_');
    $checks['private_directories_writable']=is_writable(DATA_DIR)&&is_writable(PRIVATE_DIR);
    $checks['compiled_frontend']=is_file(ROOT.'/public/build/.vite/manifest.json');
    $checks['dependencies_installed']=is_file(ROOT.'/vendor/autoload.php');
    $smtp=Config::group('smtp');
    $checks['smtp_configured']=env('MAIL_TRANSPORT')==='smtp' && !empty($smtp['host']) && filter_var($smtp['from_email']??'',FILTER_VALIDATE_EMAIL)!==false;
    Db::run('SELECT package_price,package_hours,package_currency FROM bookings LIMIT 0');
    Db::run('SELECT must_change_password,temporary_password_expires_at FROM users LIMIT 0');
    $checks['database_schema']=true;
} catch(Throwable $e) { $checks['configuration_or_database']=false; }
echo json_encode($checks,JSON_PRETTY_PRINT)."\n";
echo "This checks configuration only. HTTPS reachability, database grants, email delivery, scheduler and access restrictions require manual verification.\n";
exit(in_array(false,$checks,true)?1:0);
