<?php
declare(strict_types=1);
final class HttpError extends RuntimeException { public function __construct(public int $status, string $message) { parent::__construct($message); } }
final class Http {
    public static function fail(int $status,string $message): never { throw new HttpError($status,$message); }
    public static function json(mixed $data,int $status=200): never { http_response_code($status); header('Content-Type: application/json; charset=utf-8'); header('Cache-Control: no-store'); echo json_encode($data,JSON_THROW_ON_ERROR|JSON_UNESCAPED_SLASHES); exit; }
    public static function body(): array {
        if ((int)($_SERVER['CONTENT_LENGTH']??0)>1048576) self::fail(413,'Request too large');
        $raw=file_get_contents('php://input'); if($raw==='') return [];
        if(!str_starts_with($_SERVER['CONTENT_TYPE']??'','application/json')) self::fail(415,'Use application/json');
        try { $v=json_decode($raw,true,32,JSON_THROW_ON_ERROR); } catch(JsonException) { self::fail(400,'Invalid JSON'); }
        if(!is_array($v) || array_is_list($v) && $v!==[]) self::fail(422,'Expected a JSON object'); return $v;
    }
    public static function text(array $b,string $k,int $max=255,bool $required=true): string {
        if(isset($b[$k]) && !is_string($b[$k])) self::fail(422,"Invalid $k"); $v=trim($b[$k]??'');
        if(($required && $v==='') || mb_strlen($v)>$max || str_contains($v,"\0")) self::fail(422,"Invalid $k"); return $v;
    }
    public static function email(array $b,string $k='email'): string { $v=strtolower(self::text($b,$k)); if(!filter_var($v,FILTER_VALIDATE_EMAIL)) self::fail(422,"Invalid $k"); return $v; }
    public static function choice(mixed $v,array $choices,string $key): string { if(!is_string($v)||!in_array($v,$choices,true)) self::fail(422,"Invalid $key"); return $v; }
    public static function integer(mixed $v,int $min,int $max,string $key): int { if(filter_var($v,FILTER_VALIDATE_INT)===false || $v<$min || $v>$max) self::fail(422,"Invalid $key"); return (int)$v; }
    public static function csrf(): void {
        if(!hash_equals($_SESSION['csrf']??'', $_SERVER['HTTP_X_CSRF_TOKEN']??'') || empty($_SERVER['HTTP_X_CSRF_TOKEN'])) self::fail(403,'Invalid request token. Reload the page.');
        $origin=$_SERVER['HTTP_ORIGIN']??''; if($origin!=='' && $origin!==rtrim(env('APP_URL'),'/')) self::fail(403,'Origin not allowed');
        if(($_SERVER['HTTP_SEC_FETCH_SITE']??'')==='cross-site') self::fail(403,'Cross-site request denied');
    }
    public static function limit(string $bucket,int $max=15,int $window=900): void {
        $key=hash_hmac('sha256',$bucket.'|'.($_SERVER['REMOTE_ADDR']??'cli'),env('APP_KEY'));
        $file=DATA_DIR.'/rate-'.$key; $fp=fopen($file,'c+'); if(!$fp || !flock($fp,LOCK_EX)) self::fail(503,'Please try again');
        $v=json_decode(stream_get_contents($fp),true) ?: ['time'=>time(),'count'=>0]; if($v['time']+$window<time()) $v=['time'=>time(),'count'=>0];
        $v['count']++; ftruncate($fp,0); rewind($fp); fwrite($fp,json_encode($v)); flock($fp,LOCK_UN); fclose($fp);
        if($v['count']>$max) { header('Retry-After: '.$window); self::fail(429,'Too many requests. Try again later.'); }
    }
}
