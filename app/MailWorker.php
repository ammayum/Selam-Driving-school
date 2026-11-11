<?php
declare(strict_types=1);

final class MailWorker {
    public static function register(): void {
        if(env('MAIL_AUTO_WORKER','true')!=='true' || env('APP_ENV')==='testing') return;
        register_shutdown_function(static function(): void {
            $error=error_get_last();
            if($error && in_array($error['type'],[E_ERROR,E_PARSE,E_CORE_ERROR,E_COMPILE_ERROR],true)) return;
            if(session_status()===PHP_SESSION_ACTIVE) session_write_close();
            // Release the HTTP response first when supported by the hosting PHP handler.
            if(function_exists('fastcgi_finish_request')) fastcgi_finish_request();
            self::run();
        });
    }

    public static function run(): void {
        $lock=null;
        try {
            $lock=fopen(DATA_DIR.'/mail-auto-worker.lock','c+');
            if(!$lock || !flock($lock,LOCK_EX|LOCK_NB)) return;
            if((int)stream_get_contents($lock)>time()-10) return;
            rewind($lock); ftruncate($lock,0); fwrite($lock,(string)time()); fflush($lock);
            // Only committed queue entries may be delivered. Never run inside a caller's transaction.
            if(Db::get()->inTransaction()) return;
            Mailer::work(1);
        } catch(Throwable $ex) {
            error_log('Automatic mail worker failed: '.get_class($ex));
        } finally {
            if(is_resource($lock)) fclose($lock);
        }
    }
}
