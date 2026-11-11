<?php
declare(strict_types=1);
final class Config {
    public static function seal(string $text): string { $iv=random_bytes(12); $tag=''; $c=openssl_encrypt($text,'aes-256-gcm',hash('sha256',env('APP_KEY'),true),OPENSSL_RAW_DATA,$iv,$tag); if($c===false) throw new RuntimeException('Encryption failed'); return base64_encode($iv.$tag.$c); }
    public static function open(string $text): string { $b=base64_decode($text,true); if($b===false||strlen($b)<28) throw new RuntimeException('Invalid secret'); $v=openssl_decrypt(substr($b,28),'aes-256-gcm',hash('sha256',env('APP_KEY'),true),OPENSSL_RAW_DATA,substr($b,0,12),substr($b,12,16)); if($v===false) throw new RuntimeException('Invalid secret'); return $v; }
    public static function privateAll(): array { $file=PRIVATE_DIR.'/secrets.json'; return is_file($file)?json_decode(self::open(file_get_contents($file)),true,32,JSON_THROW_ON_ERROR):[]; }
    public static function group(string $group,bool $masked=false): array {
        if(in_array($group,['smtp','sms','database'])) {
            $v=self::privateAll()[$group]??[];
            if($group==='smtp') foreach(['host','port','username','password','from_email','encryption'] as $k) if(!array_key_exists($k,$v) && env('SMTP_'.strtoupper($k))!=='') $v[$k]=env('SMTP_'.strtoupper($k));
        } else { $v=[]; foreach(Db::all('SELECT `key`,value FROM system_configs WHERE `group`=?',[$group]) as $r) $v[$r['key']]=$r['value']; }
        if($group==='cms_repeatables') foreach(Content::REPEATABLES as $key=>$items) $v[$key]??=json_encode($items,JSON_THROW_ON_ERROR);
        if($masked) foreach($v as $k=>&$value) if(preg_match('/password|token|secret|api_key|auth/i',$k)) $value=$value!==''?'********':'';
        return $v;
    }
    public static function save(string $group,array $values): array {
        if(!in_array($group,['smtp','sms','database','cms_repeatables','media','contact','notification_templates'])) Http::fail(422,'Unsupported config group');
        foreach($values as $k=>$v) if(!is_string($k)||!preg_match('/^[a-zA-Z0-9_]{1,120}$/',$k)||!is_string($v)||strlen($v)>30000) Http::fail(422,'Invalid configuration value');
        if(in_array($group,['smtp','sms','database'])) {
            $fp=fopen(PRIVATE_DIR.'/secrets.lock','c'); flock($fp,LOCK_EX);
            try { $all=self::privateAll(); foreach($values as $k=>$v) if($v!=='********') $all[$group][$k]=$v;
                $temp=PRIVATE_DIR.'/secrets-'.bin2hex(random_bytes(6)).'.tmp'; file_put_contents($temp,self::seal(json_encode($all,JSON_THROW_ON_ERROR)),LOCK_EX); chmod($temp,0600);
                if(!rename($temp,PRIVATE_DIR.'/secrets.json')) throw new RuntimeException('Cannot save configuration');
            } finally {flock($fp,LOCK_UN); fclose($fp);}
        } else Db::transaction(function() use($group,$values) { Db::lock(); foreach($values as $k=>$v) {
            if(str_contains($k,'url') || str_ends_with($k,'link')) self::safeUrl($v);
            if($group==='cms_repeatables') {
                $list=json_decode($v,true); if(!is_array($list)||!array_is_list($list)) Http::fail(422,'Repeatable content must be a JSON list');
                foreach($list as $item) { if(!is_array($item)) Http::fail(422,'Invalid repeatable item'); foreach($item as $field=>$value) {if(!is_scalar($value)&&$value!==null) Http::fail(422,'Invalid content value'); if(str_contains($field,'url')&&is_string($value)) self::safeUrl($value);} }
            }
            $row=Db::one('SELECT id FROM system_configs WHERE `group`=? AND `key`=?',[$group,$k]);
            $data=['group'=>$group,'key'=>$k,'value'=>$v,'updated_at'=>now()]; if($row) Db::update('system_configs',$row['id'],$data); else Db::insert('system_configs',$data);
        }});
        return self::group($group,true);
    }
    public static function safeUrl(string $v): void { if(preg_match('/[\x00-\x20\\\\]/',$v)||($v!==''&&!preg_match('~^(https?://|tel:|mailto:|/(?!/))~i',$v))) Http::fail(422,'Unsupported URL scheme'); }
}
