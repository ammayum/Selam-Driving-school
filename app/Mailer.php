<?php
declare(strict_types=1);
final class Mailer {
    public static function queue(string $to,string $subject,string $body,string $category,?string $ics=null): int {
        [$subject,$body]=NotificationTemplates::render($category,$subject,$body);
        if(!filter_var($to,FILTER_VALIDATE_EMAIL)||preg_match('/[\r\n]/',$to.$subject)) throw new InvalidArgumentException('Invalid mail address or subject');
        $create=static function() use($to,$subject,$body,$category,$ics): int {
            $n=Db::insert('notifications',['recipient'=>$to,'channel'=>'email','message'=>$subject,'category'=>$category,'status'=>'queued','created_at'=>now()]);
            Db::insert('mail_outbox',['notification_id'=>$n,'payload'=>Config::seal(json_encode(compact('to','subject','body','ics'),JSON_THROW_ON_ERROR)),'attempts'=>0,'available_at'=>now()]);
            Db::afterCommit(static fn()=>self::deliverNow($n));
            return $n;
        };
        return Db::get()->inTransaction()?$create():Db::transaction($create);
    }
    public static function deliverNow(int $notificationId): void {
        if(env('MAIL_SEND_IMMEDIATELY','true')!=='true') return;
        try { self::work(1,$notificationId); }
        catch(Throwable $ex) { error_log('Immediate mail delivery failed: '.get_class($ex)); }
    }
    public static function work(int $limit=20,?int $notificationId=null): array {
        $sent=0;$failed=0;
        for($i=0;$i<$limit;$i++) {
            $row=Db::transaction(function() use($notificationId) {
                Db::lock();
                $args=[now(),gmdate('Y-m-d H:i:s',time()-300)];
                if($notificationId!==null) $args[]=$notificationId;
                $r=Db::one('SELECT * FROM mail_outbox WHERE sent_at IS NULL AND attempts<5 AND available_at<=? AND (locked_at IS NULL OR locked_at<?)'.($notificationId!==null?' AND notification_id=?':'').' ORDER BY id LIMIT 1',$args);
                if($r) Db::update('mail_outbox',$r['id'],['locked_at'=>now(),'attempts'=>$r['attempts']+1]);
                return $r;
            });
            if(!$row) break;
            try {
                $p=json_decode(Config::open($row['payload']),true,32,JSON_THROW_ON_ERROR); self::send($p);
                Db::update('mail_outbox',$row['id'],['sent_at'=>now(),'locked_at'=>null]); Db::update('notifications',$row['notification_id'],['status'=>env('MAIL_TRANSPORT')==='log'?'captured':'sent']); $sent++;
            } catch(Throwable $ex) {
                $attempt=$row['attempts']+1; Db::update('mail_outbox',$row['id'],['locked_at'=>null,'available_at'=>gmdate('Y-m-d H:i:s',time()+min(3600,60*(2**$attempt)))]);
                Db::update('notifications',$row['notification_id'],['status'=>$attempt>=5?'failed':'retrying']); error_log('Mail outbox '.$row['id'].' failed: '.get_class($ex)); $failed++;
            }
        } return compact('sent','failed');
    }
    private static function send(array $p): void {
        if(env('MAIL_TRANSPORT')==='log' && env('APP_ENV')!=='production') { file_put_contents(DATA_DIR.'/mail-test.jsonl',json_encode($p)."\n",FILE_APPEND|LOCK_EX); return; }
        if(!is_file(ROOT.'/vendor/autoload.php')) throw new RuntimeException('Install Composer dependencies'); require_once ROOT.'/vendor/autoload.php';
        $cfg=Config::group('smtp'); if(empty($cfg['host'])||empty($cfg['from_email'])) throw new RuntimeException('SMTP settings required');
        $mail=new PHPMailer\PHPMailer\PHPMailer(true); $mail->isSMTP(); $mail->Host=$cfg['host']; $mail->Port=(int)($cfg['port']??587);
        $mail->SMTPAuth=!empty($cfg['username']); $mail->Username=$cfg['username']??''; $mail->Password=$cfg['password']??'';
        $ssl=filter_var($cfg['use_ssl']??false,FILTER_VALIDATE_BOOLEAN);
        $mail->SMTPSecure=$ssl?'ssl':($cfg['encryption']??'tls');
        if(!in_array($mail->SMTPSecure,['tls','ssl'],true)) throw new RuntimeException('SMTP TLS is required');
        $mail->Timeout=20; $mail->CharSet='UTF-8'; $mail->setFrom($cfg['from_email'],'Selam Driving School'); $mail->addAddress($p['to']);
        $mail->Subject=$p['subject']; $mail->isHTML(true); $mail->Body='<h2>'.e($p['subject']).'</h2><p>'.nl2br(e($p['body'])).'</p>'; $mail->AltBody=$p['body'];
        if($p['ics']) $mail->addStringAttachment($p['ics'],'booking.ics','base64','text/calendar; method=REQUEST');
        $mail->send();
    }
}
