<?php
declare(strict_types=1);
final class Auth {
    public static function user(bool $required=true,bool $refresh=false): ?array {
        $uid=$_SESSION['uid']??null; $u=$uid?Db::one('SELECT u.*,COALESCE(s.is_frozen,0) is_frozen,COALESCE(s.is_deleted,0) is_deleted FROM users u LEFT JOIN user_admin_states s ON s.user_id=u.id WHERE u.id=?',[$uid]):null;
        $version=$u?(Db::one('SELECT version FROM auth_versions WHERE user_id=?',[$uid])['version']??1):0;
        $expiry=$refresh?($_SESSION['absolute_expires']??0):($_SESSION['expires']??0);
        if(!$u||$u['is_frozen']||$u['is_deleted']||$expiry<time()||($_SESSION['version']??0)!=$version) { if($required) Http::fail(401,'Please sign in'); return null; }
        return $u;
    }
    public static function requireRoles(array $roles): array { $u=self::user(); if(!in_array($u['role'],$roles,true)) Http::fail(403,'Access denied'); return $u; }
    public static function publicUser(array $u): array { unset($u['password_hash']); return $u; }
    public static function verify(string $password,string $hash): bool {
        if(preg_match('/^([a-f0-9]{32})\$([a-f0-9]{64})$/',$hash,$m)) return hash_equals($m[2],hash_pbkdf2('sha256',$password,$m[1],120000,64));
        return password_verify($password,$hash);
    }
    public static function password(array $b,string $key='password'): string { Http::text($b,$key,128); $p=$b[$key]; if(strlen($p)<12) Http::fail(422,'Use a password with at least 12 characters'); return $p; }
    public static function login(array $b): array {
        Http::limit('login',10); $name=strtolower(Http::text($b,'username',80)); Http::text($b,'password',128); $password=$b['password'];
        $u=Db::one('SELECT * FROM users WHERE username=?',[$name]);
        $ok=self::verify($password,$u['password_hash']??'$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2uheWG/igi.');
        $state=$u?Db::one('SELECT * FROM user_admin_states WHERE user_id=?',[$u['id']]):null;
        if(!$ok||!$u||($state['is_frozen']??false)||($state['is_deleted']??false)) Http::fail(401,'Invalid username or password');
        if($u['must_change_password'] && ($u['temporary_password_expires_at']??'')<=now()) Http::fail(401,'Temporary password expired. Request a password reset.');
        if(password_needs_rehash($u['password_hash'],PASSWORD_DEFAULT)) Db::update('users',$u['id'],['password_hash'=>password_hash($password,PASSWORD_DEFAULT)]);
        session_regenerate_id(true); $_SESSION['uid']=$u['id']; $_SESSION['expires']=time()+3600; $_SESSION['absolute_expires']=time()+86400;
        $_SESSION['version']=Db::one('SELECT version FROM auth_versions WHERE user_id=?',[$u['id']])['version']??1;
        self::audit('auth.login','user',$u['id'],$u); return self::response($u);
    }
    public static function response(array $u): array { return ['user_id'=>$u['id'],'username'=>$u['username'],'full_name'=>$u['full_name'],'role'=>$u['role'],'student_id'=>$u['role']==='student'?$u['id']:null,'access_token'=>'cookie','refresh_token'=>'cookie','token_type'=>'cookie','expires_in'=>3600,'must_change_password'=>(bool)$u['must_change_password']]; }
    public static function signup(array $b): array {
        Http::limit('signup',8); $password=self::password($b); $email=Http::email($b); $role='student'; $invite=null;
        return Db::transaction(function() use($b,$password,$email,$role,$invite) {
            Db::lock(); if(!empty($b['invite_code'])) { $invite=Db::one('SELECT * FROM invites WHERE code=?',[hash('sha256',Http::text($b,'invite_code',100))]); if(!$invite||$invite['status']!=='pending'||$invite['expires_at']<now()||$invite['email']!==$email) Http::fail(422,'Invalid or expired invitation'); $role=$invite['role']; }
            $u=self::create($b+['password'=>$password],$role);
            if($invite) Db::update('invites',$invite['id'],['status'=>'accepted','accepted_at'=>now()]);
            self::audit('auth.signup','user',$u['id'],$u); return ['user_id'=>$u['id'],'username'=>$u['username'],'email'=>$email,'role'=>$role,'linked_instructor_id'=>$invite['instructor_id']??null];
        });
    }
    public static function create(array $b,string $role): array {
        $email=Http::email($b); if(Db::one('SELECT id FROM users WHERE email=?',[$email])) Http::fail(409,'Email already registered');
        $username=strtolower(Http::text($b,'username',80,false)); if($username==='') { $base=preg_replace('/[^a-z0-9._-]/','',strstr($email,'@',true))?:'student'; $username=substr($base,0,65); while(Db::one('SELECT id FROM users WHERE username=?',[$username])) $username=substr($base,0,65).bin2hex(random_bytes(3)); }
        if(!preg_match('/^[a-zA-Z0-9._-]{2,80}$/',$username)) Http::fail(422,'Invalid username');
        if(Db::one('SELECT id FROM users WHERE username=?',[$username])) Http::fail(409,'Username already registered');
        $data=['full_name'=>Http::text($b,'full_name',120),'username'=>$username,'email'=>$email,'phone'=>Http::text($b,'phone',30),'role'=>$role,'password_hash'=>password_hash($b['password']??bin2hex(random_bytes(32)),PASSWORD_DEFAULT),'created_at'=>now()];
        foreach(['profile_photo_url','permit_number','instructor_type'] as $key) if(isset($b[$key])) $data[$key]=Http::text($b,$key,500,false);
        if(!empty($data['profile_photo_url'])) Config::safeUrl($data['profile_photo_url']);
        if(!empty($data['instructor_type'])) Http::choice($data['instructor_type'],['manual','automatic','both'],'instructor_type');
        $id=Db::insert('users',$data); return Db::one('SELECT * FROM users WHERE id=?',[$id]);
    }
    public static function revoke(int $id): void {
        $v=Db::one('SELECT * FROM auth_versions WHERE user_id=?',[$id]); if($v) Db::update('auth_versions',$v['id'],['version'=>$v['version']+1]); else Db::insert('auth_versions',['user_id'=>$id,'version'=>2]);
    }
    public static function changePassword(array $data): array {
        Http::limit('change-password',10);
        return Db::transaction(function() use($data) {
            Db::lock(); $user=self::user(); Http::text($data,'current_password',128);
            if(!self::verify($data['current_password'],$user['password_hash'])) Http::fail(403,'Current password is incorrect');
            if($user['must_change_password'] && ($user['temporary_password_expires_at']??'')<=now()) Http::fail(403,'Temporary password expired. Request a password reset.');
            $password=self::password($data,'new_password');
            if(self::verify($password,$user['password_hash'])) Http::fail(422,'Choose a different password');
            Db::update('users',$user['id'],['password_hash'=>password_hash($password,PASSWORD_DEFAULT),'must_change_password'=>0,'temporary_password_expires_at'=>null]);
            Db::run('UPDATE password_reset_tokens SET used_at=? WHERE user_id=? AND used_at IS NULL',[now(),$user['id']]);
            self::revoke($user['id']);
            $_SESSION['version']=Db::one('SELECT version FROM auth_versions WHERE user_id=?',[$user['id']])['version'];
            session_regenerate_id(true);
            self::audit('user.password_changed','user',$user['id'],$user);
            return ['message'=>'Password changed.'];
        });
    }
    public static function resetRequest(array $b): array {
        Http::limit('password-reset',5); $u=Db::one('SELECT * FROM users WHERE username=?',[Http::text($b,'username',80)]);
        if($u) self::sendReset($u); return ['message'=>'If the account exists, password reset instructions will be sent.'];
    }
    public static function sendReset(array $u): void {
        $token=bin2hex(random_bytes(32)); Db::insert('password_reset_tokens',['user_id'=>$u['id'],'token_hash'=>hash('sha256',$token),'expires_at'=>gmdate('Y-m-d H:i:s',time()+3600),'created_at'=>now()]);
        Mailer::queue($u['email'],'Set your Selam Driving School password',"Username: {$u['username']}\nReset token: $token\nOpen ".env('APP_URL')."/login to set your password. This token expires in one hour.",'password_reset');
    }
    public static function resetConfirm(array $b): array {
        Http::limit('reset-confirm',10); $password=self::password($b,'new_password');
        Db::transaction(function() use($b,$password) {Db::lock(); $t=Db::one('SELECT * FROM password_reset_tokens WHERE token_hash=?',[hash('sha256',Http::text($b,'token',100))]); if(!$t||$t['used_at']||$t['expires_at']<now()) Http::fail(422,'Invalid or expired reset token');
            Db::update('users',$t['user_id'],['password_hash'=>password_hash($password,PASSWORD_DEFAULT),'must_change_password'=>0,'temporary_password_expires_at'=>null]); Db::run('UPDATE password_reset_tokens SET used_at=? WHERE user_id=? AND used_at IS NULL',[now(),$t['user_id']]); self::revoke($t['user_id']); self::audit('user.password_reset_completed','user',$t['user_id'],Db::one('SELECT * FROM users WHERE id=?',[$t['user_id']]));
        }); return ['message'=>'Password updated. Please sign in.'];
    }
    public static function audit(string $action,string $type,?int $id,?array $u=null,array $details=[]): void {
        $u??=self::user(false); Db::insert('activity_logs',['actor_role'=>$u['role']??'guest','actor_id'=>$u['id']??null,'actor_username'=>$u['username']??null,'action'=>$action,'target_type'=>$type,'target_id'=>$id,'details'=>json_encode($details),'created_at'=>now()]);
    }
}
