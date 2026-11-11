<?php
declare(strict_types=1);
define('ROOT', dirname(__DIR__));
date_default_timezone_set('UTC');
ini_set('display_errors', '0');
ini_set('log_errors', '1');
ini_set('error_log', ROOT . '/storage/error.log');
$envFile = getenv('SELAM_ENV_FILE') ?: ROOT . '/.env';
if (is_file($envFile)) {
    foreach (file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
        if (str_starts_with(trim($line), '#') || !str_contains($line, '=')) continue;
        [$key, $value] = explode('=', $line, 2);
        if (getenv(trim($key)) === false) putenv(trim($key) . '=' . trim(trim($value), "\"'"));
    }
}
function env(string $key, string $default = ''): string { $v = getenv($key); return $v === false ? $default : $v; }
define('DATA_DIR', env('APP_DATA_DIR', ROOT . '/storage'));
define('PRIVATE_DIR', env('APP_PRIVATE_DIR', ROOT . '/config'));
if(!is_dir(DATA_DIR)) mkdir(DATA_DIR,0700,true);
if(!is_dir(PRIVATE_DIR)) mkdir(PRIVATE_DIR,0700,true);
ini_set('error_log', DATA_DIR . '/error.log');
function now(): string { return gmdate('Y-m-d H:i:s'); }
function e(mixed $v): string { return htmlspecialchars((string)($v ?? ''), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); }
spl_autoload_register(function (string $name): void {
    if (preg_match('/^[A-Za-z]+$/', $name) && is_file(ROOT . '/app/' . $name . '.php')) require ROOT . '/app/' . $name . '.php';
});
if (strlen(env('APP_KEY')) < 32) throw new RuntimeException('Run php bin/setup.php to configure APP_KEY.');
if (env('APP_ENV') === 'production' && !str_starts_with(env('APP_URL'), 'https://')) throw new RuntimeException('Production requires an HTTPS APP_URL.');
if (PHP_SAPI !== 'cli') {
    ini_set('session.use_strict_mode', '1');
    ini_set('session.use_only_cookies', '1');
    ini_set('session.use_trans_sid', '0');
    ini_set('session.gc_maxlifetime', '86400');
    session_name('selam_php');
    session_save_path(DATA_DIR);
    session_set_cookie_params(['lifetime'=>0, 'path'=>'/', 'secure'=>str_starts_with(env('APP_URL'), 'https://'), 'httponly'=>true, 'samesite'=>'Lax']);
    session_start();
    $_SESSION['csrf'] ??= bin2hex(random_bytes(32));
}
