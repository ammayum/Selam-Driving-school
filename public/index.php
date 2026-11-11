<?php
declare(strict_types=1);
require dirname(__DIR__).'/config/bootstrap.php';
require_once ROOT.'/app/Http.php';
MailWorker::register();
$nonce=base64_encode(random_bytes(18));
header('X-Content-Type-Options: nosniff'); header('X-Frame-Options: DENY'); header('Referrer-Policy: no-referrer');
header('Permissions-Policy: camera=(), microphone=(), geolocation=()');
header("Content-Security-Policy: default-src 'self'; script-src 'self' 'nonce-$nonce'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self'; frame-src https://www.youtube.com https://www.youtube-nocookie.com https://www.instagram.com https://www.tiktok.com; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'");
if(env('APP_ENV')==='production') header('Strict-Transport-Security: max-age=31536000');
if(env('APP_INDEXING','true')!=='true') header('X-Robots-Tag: noindex, nofollow');
$path=parse_url($_SERVER['REQUEST_URI']??'/',PHP_URL_PATH)?:'/'; $method=$_SERVER['REQUEST_METHOD']??'GET';
try {
    if(preg_match('~^/(?:api/)?media/([a-f0-9]{48}\.(?:jpg|png|webp))$~',$path,$m)&&$method==='GET') {
        $file=DATA_DIR.'/uploads/'.$m[1]; if(!is_file($file)) Http::fail(404,'Image not found'); header('Content-Type: '.(new finfo(FILEINFO_MIME_TYPE))->file($file)); header('Content-Disposition: inline; filename="'.$m[1].'"'); header('Cache-Control: public, max-age=86400'); header('Content-Security-Policy: sandbox'); readfile($file); exit;
    }
    if(str_starts_with($path,'/api/')) {
        header('X-Robots-Tag: noindex, nofollow'); $route=rtrim(substr($path,4),'/');
        if(!in_array($method,['GET','POST','PUT','PATCH','DELETE'])) Http::fail(405,'Method not allowed');
        if($method!=='GET') Http::csrf();
        $body=$route==='/media/upload-photo'?[]:($method==='GET'?[]:Http::body());
        if($method==='GET'&&$route==='/seo') { $p=Http::text($_GET,'path',200); $meta=Seo::metadata($p); unset($meta['page']); Http::json($meta); }
        Http::json(Api::dispatch($method,$route,$body));
    }
    if($method!=='GET'&&$method!=='HEAD') Http::fail(405,'Method not allowed');
    if(env('APP_INDEXING','true')!=='true' && $path==='/sitemap.xml') Http::fail(404,'Sitemap disabled');
    if(env('APP_INDEXING','true')!=='true' && $path==='/robots.txt') { header('Content-Type: text/plain'); echo "User-agent: *\nDisallow: /\n"; exit; }
    if($path==='/robots.txt') {header('Content-Type: text/plain');echo "User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /portal\nDisallow: /login\nDisallow: /signup\nDisallow: /assign/\nSitemap: ".rtrim(env('APP_URL'),'/')."/sitemap.xml\n";exit;}
    if($path==='/sitemap.xml') Seo::sitemap();
    if($path!=='/'&&str_ends_with($path,'/')) {header('Location: '.rtrim($path,'/'),true,308);exit;}
    if(str_contains($path,'.')||str_contains($path,'//')||str_contains($path,'%')) Http::fail(404,'Page not found');
    Seo::render($path,$nonce);
} catch(HttpError $ex) { Http::json(['detail'=>$ex->getMessage()],$ex->status); }
catch(PDOException $ex) { error_log('Database error: '.$ex->getCode()); Http::json(['detail'=>$ex->getCode()==='23000'?'Record conflicts with existing data':'Database operation failed'],$ex->getCode()==='23000'?409:500); }
catch(Throwable $ex) { error_log(get_class($ex).': '.$ex->getMessage()); Http::json(['detail'=>'Unable to complete request. Please try again.'],500); }
