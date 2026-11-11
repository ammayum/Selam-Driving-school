<?php
declare(strict_types=1);
final class Api {
    public static function dispatch(string $method,string $path,array $b): mixed {
        $session=Auth::user(false,true);
        if(($session['must_change_password']??false) && !in_array($path,['/auth/csrf','/auth/session','/auth/refresh','/auth/logout','/auth/change-password','/auth/forgot-password/request','/auth/forgot-password/confirm'],true)) Http::fail(403,'Change your temporary password before continuing');
        if($method==='POST' && $path==='/auth/change-password') return Auth::changePassword($b);
        if($path==='/instructor/business-card') return BusinessCards::dispatch($method,$b);
        if(str_starts_with($path,'/instructor/')) return Events::dispatch($method,$path,$b);
        if($method==='GET' && $path==='/health') return ['status'=>'ok'];
        if($method==='GET' && $path==='/auth/csrf') return ['csrf_token'=>$_SESSION['csrf']];
        if($method==='POST' && $path==='/auth/login') return Auth::login($b);
        if($method==='POST' && $path==='/auth/signup') return Auth::signup($b);
        if($method==='POST' && $path==='/auth/check-username') {Http::limit('username',10); Http::text($b,'username',80); return ['exists'=>true,'full_name'=>null];}
        if($method==='GET' && $path==='/auth/session') return Auth::response(Auth::user());
        if($method==='POST' && $path==='/auth/refresh') { $u=Auth::user(true,true); session_regenerate_id(true); $_SESSION['expires']=min(time()+3600,$_SESSION['absolute_expires']); return Auth::response($u); }
        if($method==='POST' && $path==='/auth/logout') { $_SESSION=[]; session_regenerate_id(true); $_SESSION['csrf']=bin2hex(random_bytes(32)); return ['message'=>'Signed out']; }
        if($method==='POST' && $path==='/auth/forgot-password/request') return Auth::resetRequest($b);
        if($method==='POST' && $path==='/auth/forgot-password/confirm') return Auth::resetConfirm($b);
        if($method==='GET' && $path==='/users/instructors') return self::users('instructor');
        if($method==='GET' && $path==='/users/students') { $u=Auth::requireRoles(['admin','instructor']); return self::users('student',$u['role']==='instructor'?$u['id']:null); }
        if($method==='POST' && $path==='/users') {Auth::requireRoles(['admin']); Auth::password($b); $u=Auth::create($b,Http::choice($b['role']??null,['student','instructor'],'role')); Auth::audit('user.create','user',$u['id']); return Auth::publicUser($u);}
        if($path==='/packages' && $method==='GET') return Db::all('SELECT * FROM lesson_packages'.((Auth::user(false)['role']??null)==='admin'?'':' WHERE is_active=1').' ORDER BY id');
        if(($path==='/packages' && $method==='POST') || ($method==='PUT' && preg_match('~^/packages/(\d+)$~',$path,$m))) {
            Auth::requireRoles(['admin']);
            $previous=$method==='PUT'?self::row('lesson_packages',(int)$m[1]):null;
            $hours=$b['hours']??$b['lesson_count']??$previous['hours']??null;
            if(is_bool($hours)||!is_numeric($hours)||!is_finite((float)$hours)||(float)$hours<0.01||(float)$hours>10000||abs(round((float)$hours,2)-(float)$hours)>0.000001) Http::fail(422,'Hours must be between 0.01 and 10000, with up to two decimal places');
            $d=['title'=>Http::text($b,'title',120),'hours'=>(float)$hours,'package_type'=>Http::choice($b['package_type']??$previous['package_type']??'manual',['manual','automatic'],'package_type'),
                'lesson_count'=>(int)ceil((float)$hours),'description'=>Http::text($b,'description',500,false),'is_active'=>self::boolean($b['is_active']??true),'updated_at'=>now()];
            if(!is_numeric($b['price']??null)||$b['price']<=0||$b['price']>99999999) Http::fail(422,'Invalid price'); $d['price']=round((float)$b['price'],2);
            if($method==='PUT') { $id=(int)$m[1]; self::row('lesson_packages',$id); Db::update('lesson_packages',$id,$d); } else $id=Db::insert('lesson_packages',$d); Auth::audit('package.save','package',$id); return self::row('lesson_packages',$id);
        }
        if($path==='/bookings' && $method==='POST') return Bookings::create($b);
        if($path==='/bookings' && $method==='GET') return Bookings::listing();
        if($path==='/bookings/my' && $method==='GET') return Bookings::listing(true);
        if($path==='/bookings/stats' && $method==='GET') return Bookings::stats(Bookings::listing());
        if($path==='/bookings/availability' && $method==='GET') return Bookings::availability(Http::integer($_GET['instructor_id']??null,1,PHP_INT_MAX,'instructor_id'),Http::text($_GET,'day',10));
        if(preg_match('~^/bookings/(\d+)(?:/(request-payment|payment|assign-by-token|accept-by-email))?$~',$path,$m)) {
            $id=(int)$m[1]; $action=$m[2]??'';
            if($method==='PATCH' && $action==='') return Bookings::update($id,$b);
            if($method==='POST' && $action==='request-payment') return Bookings::payment($id,$b,true);
            if($method==='PATCH' && $action==='payment') return Bookings::payment($id,$b);
            if($method==='POST' && $action==='assign-by-token') return Bookings::assign($id,$b);
            if($method==='POST' && $action==='accept-by-email') { $u=Auth::requireRoles(['instructor']); $booking=Bookings::owned($id); if(strtolower(Http::email($b,'instructor_email'))!==$u['email']) Http::fail(403,'Instructor mismatch'); return Bookings::update($id,['status'=>'approved']); }
        }
        if($method==='GET' && preg_match('~^/students/(\d+)/progress$~',$path,$m)) {
            $u=Auth::user(); $id=(int)$m[1]; if($u['role']==='student'&&$u['id']!==$id) Http::fail(403,'Access denied');
            if($u['role']==='instructor'&&!Db::one('SELECT id FROM bookings WHERE student_id=? AND instructor_id=?',[$id,$u['id']])) Http::fail(403,'Access denied');
            $rows=Db::all('SELECT * FROM bookings WHERE student_id=?'.($u['role']==='instructor'?' AND instructor_id=?':''),$u['role']==='instructor'?[$id,$u['id']]:[$id]);
            $count=fn($key,$v)=>count(array_filter($rows,fn($r)=>$r[$key]===$v)); return ['student_id'=>$id,'total_lessons'=>count($rows),'completed_lessons'=>$count('status','completed'),'pending_lessons'=>$count('status','pending')+$count('status','approved'),'attended_lessons'=>$count('attendance_status','attended'),'missed_lessons'=>$count('attendance_status','missed')];
        }
        if($method==='GET' && $path==='/dashboard') {
            $u=Auth::requireRoles(['admin','instructor']); $rows=Bookings::listing(); return ['total_students'=>$u['role']==='admin'?count(self::users('student')):count(array_unique(array_column($rows,'student_id'))),'total_instructors'=>$u['role']==='admin'?count(self::users('instructor')):1,'total_bookings'=>count($rows),'pending_bookings'=>count(array_filter($rows,fn($r)=>$r['status']==='pending')),'upcoming_lessons'=>count(array_filter($rows,fn($r)=>$r['start_time']>=now()&&$r['status']!=='cancelled'))];
        }
        if($path==='/notifications') {
            $u=Auth::requireRoles(['admin','instructor']);
            if($method==='GET') return Db::all('SELECT * FROM notifications'.($u['role']==='instructor'?' WHERE recipient=?':'').' ORDER BY id DESC LIMIT 200',$u['role']==='instructor'?[$u['email']]:[]);
            if($method==='POST') {
                $d=['recipient'=>Http::text($b,'recipient'),'channel'=>Http::choice($b['channel']??null,['email','sms','whatsapp'],'channel'),'category'=>Http::text($b,'category',50),'message'=>Http::text($b,'message',1000),'status'=>'queued','created_at'=>now()];
                if($u['role']==='instructor' && !Db::one('SELECT b.id FROM bookings b JOIN users s ON s.id=b.student_id WHERE b.instructor_id=? AND (s.email=? OR s.phone=?)',[$u['id'],$d['recipient'],$d['recipient']])) Http::fail(403,'Instructors can notify their own students only');
                $id=$d['channel']==='email'?Mailer::queue(Http::email(['email'=>$d['recipient']]),'Selam Driving School notification',$d['message'],$d['category']):Db::insert('notifications',$d);
                Auth::audit('notification.create','notification',$id); return self::row('notifications',$id);
            }
        }
        if($method==='POST' && preg_match('~^/notifications/(\d+)/retry$~',$path,$m)) {Auth::requireRoles(['admin']); Db::run('UPDATE mail_outbox SET attempts=0,available_at=?,locked_at=NULL WHERE notification_id=? AND sent_at IS NULL',[now(),(int)$m[1]]); Db::run("UPDATE notifications SET status='queued' WHERE id=? AND status IN ('failed','retrying')",[(int)$m[1]]); Mailer::deliverNow((int)$m[1]); return ['message'=>'Retry processed'];}
        if($method==='GET' && $path==='/activity-logs') { $u=Auth::requireRoles(['admin','instructor']); $limit=Http::integer($_GET['limit']??200,1,1000,'limit'); return Db::all('SELECT * FROM activity_logs'.($u['role']==='instructor'?' WHERE actor_id=?':'').' ORDER BY id DESC LIMIT '.$limit,$u['role']==='instructor'?[$u['id']]:[]); }
        if(str_starts_with($path,'/admin/users')) return self::adminUsers($method,$path,$b);
        if(preg_match('~^/admin/config/([a-z_]+)$~',$path,$m)) {Auth::requireRoles(['admin']); if(!in_array($m[1],['smtp','sms','cms_repeatables','media','contact'])) Http::fail(404,'Unknown configuration group'); if($method==='GET') return ['group'=>$m[1],'values'=>(object)Config::group($m[1],true)]; if($method==='PUT') {if(!is_array($b['values']??null)) Http::fail(422,'Values required'); $v=Config::save($m[1],$b['values']); Auth::audit('config.update','config',null,null,['group'=>$m[1]]); return ['group'=>$m[1],'values'=>(object)$v];}}
        if(str_starts_with($path,'/admin/database/')) return DatabaseAdmin::dispatch($method,substr($path,16),$b);
        if($path==='/admin/notification-templates') return NotificationTemplates::dispatch($method,$b);
        if($method==='GET' && str_starts_with($path,'/public/settings/')) return self::publicSettings(substr($path,17));
        if(str_starts_with($path,'/cms/pages')) return Content::dispatch($method,substr($path,10),$b);
        if(str_starts_with($path,'/invites')) return self::invites($method,$path,$b);
        if($method==='POST' && $path==='/media/upload-photo') return self::upload();
        Http::fail(404,'Endpoint not found');
    }
    public static function boolean(mixed $v): int { if(!is_bool($v)) Http::fail(422,'Expected a boolean'); return (int)$v; }
    public static function row(string $table,int $id): array { $r=Db::one('SELECT * FROM `'.$table.'` WHERE id=?',[$id]); if(!$r) Http::fail(404,'Record not found'); return $r; }
    public static function users(string $role,?int $instructor=null): array {
        $sql='SELECT u.*,COALESCE(s.is_frozen,0) is_frozen,COALESCE(s.is_deleted,0) is_deleted FROM users u LEFT JOIN user_admin_states s ON s.user_id=u.id WHERE LOWER(u.role)=? AND COALESCE(s.is_deleted,0)=0 AND COALESCE(s.is_frozen,0)=0'; $args=[$role];
        if($instructor) {$sql.=' AND u.id IN (SELECT student_id FROM bookings WHERE instructor_id=?)';$args[]=$instructor;}
        return array_map([Auth::class,'publicUser'],Db::all($sql.' ORDER BY u.id',$args));
    }
    private static function adminUsers(string $method,string $path,array $b): mixed {
        Auth::requireRoles(['admin']);
        if($method==='POST' && preg_match('~^/admin/users/(\d+)/reset-password$~',$path,$m)) {
            Http::limit('admin-password-reset',10);
            $actor=Auth::user();
            Http::text($b,'current_password',128);
            if(!Auth::verify($b['current_password'],$actor['password_hash'])) Http::fail(403,'Confirm your own administrator password');
            return Db::transaction(function() use($m,$actor) {
                Db::lock(); $user=self::row('users',(int)$m[1]);
                $state=Db::one('SELECT * FROM user_admin_states WHERE user_id=?',[$user['id']]);
                if(($state['is_deleted']??false)||($state['is_frozen']??false)) Http::fail(422,'Restore or unfreeze the account before resetting its password');
                Db::run('UPDATE password_reset_tokens SET used_at=? WHERE user_id=? AND used_at IS NULL',[now(),$user['id']]);
                Auth::sendReset($user);
                Auth::audit('user.password_reset_requested','user',$user['id'],$actor);
                return ['message'=>'Password reset email queued. The existing password remains valid until the reset is completed.'];
            });
        }
        if($path==='/admin/users/preferences'&&$method==='GET') return Db::all("SELECT u.id user_id,u.full_name,u.email,COALESCE(p.allow_email_assign,1) allow_email_assign,COALESCE(p.receive_booking_emails,1) receive_booking_emails FROM users u LEFT JOIN admin_preferences p ON p.user_id=u.id WHERE LOWER(u.role)='admin'");
        if($method==='PATCH' && preg_match('~^/admin/users/preferences/(\d+)$~',$path,$m)) {
            $id=(int)$m[1]; $u=self::row('users',$id); if($u['role']!=='admin') Http::fail(422,'Invalid admin'); $pref=Db::one('SELECT * FROM admin_preferences WHERE user_id=?',[$id]); $d=['updated_at'=>now()]; foreach(['allow_email_assign','receive_booking_emails'] as $k) if(isset($b[$k])) $d[$k]=self::boolean($b[$k]); if($pref) Db::update('admin_preferences',$pref['id'],$d); else Db::insert('admin_preferences',$d+['user_id'=>$id]); return Db::one('SELECT u.id user_id,u.full_name,u.email,p.allow_email_assign,p.receive_booking_emails FROM users u JOIN admin_preferences p ON p.user_id=u.id WHERE u.id=?',[$id]);
        }
        if($path==='/admin/users'&&$method==='GET') { $role=Http::choice($_GET['role']??'student',['student','instructor','admin'],'role'); return array_map([Auth::class,'publicUser'],Db::all('SELECT u.*,COALESCE(s.is_frozen,0) is_frozen,COALESCE(s.is_deleted,0) is_deleted FROM users u LEFT JOIN user_admin_states s ON u.id=s.user_id WHERE LOWER(u.role)=?'.(($_GET['include_deleted']??'false')==='true'?'':' AND COALESCE(s.is_deleted,0)=0'),[$role])); }
        if($path==='/admin/users'&&$method==='POST') return UserAdmin::create($b);
        if(preg_match('~^/admin/users/(\d+)(?:/(freeze|restore))?$~',$path,$m)) {
            $action=$m[2]??'';
            if($method==='PUT' && $action==='') return UserAdmin::change((int)$m[1],'edit',$b);
            if($method==='PATCH' && in_array($action,['freeze','restore'],true)) return UserAdmin::change((int)$m[1],$action,$b);
            if($method==='DELETE' && $action==='') { UserAdmin::change((int)$m[1],'delete',$b); return ['status'=>'deleted']; }
            Http::fail(405,'Method not allowed');
        } Http::fail(404,'Endpoint not found');
    }
    public static function publicSettings(string $type): array {
        if($type==='contact') return array_intersect_key(Config::group('contact')+array_fill_keys(['phone','phone_link','email','address','whatsapp','whatsapp_link','contact_note'],''),array_flip(['phone','phone_link','email','address','whatsapp','whatsapp_link','contact_note']));
        $m=Config::group('media'); if($type==='video') return ['title'=>$m['video_title']??'How Lessons Work','youtube_url'=>$m['youtube_url']??''];
        if($type==='about-media') { $v=[]; for($i=1;$i<=3;$i++) if(!empty($m['about_video_'.$i.'_url'])) $v[]=['title'=>$m['about_video_'.$i.'_title']??'','youtube_url'=>$m['about_video_'.$i.'_url']]; $out=['videos'=>$v]; foreach(['facebook','instagram','tiktok','youtube'] as $s) $out[$s.'_url']=$m['social_'.$s.'_url']??''; return $out; } Http::fail(404,'Setting not found');
    }
    private static function invites(string $method,string $path,array $b): mixed {
        if($method==='POST'&&$path==='/invites/accept') {
            Http::limit('invite-accept',8); return Db::transaction(function()use($b){ Db::lock(); $i=Db::one('SELECT * FROM invites WHERE code=?',[hash('sha256',Http::text($b,'code',100))]); if(!$i||$i['status']!=='pending'||$i['expires_at']<now()) Http::fail(422,'Invalid invitation'); $u=Auth::create(['email'=>$i['email'],'full_name'=>Http::text($b,'full_name',120),'phone'=>Http::text($b,'phone',30)],$i['role']); Db::update('invites',$i['id'],['status'=>'accepted','accepted_at'=>now()]); Auth::sendReset($u); return ['user_id'=>$u['id'],'email'=>$u['email'],'role'=>$u['role'],'linked_instructor_id'=>$i['instructor_id']]; });
        }
        $u=Auth::requireRoles(['admin','instructor']);
        if($method==='GET'&&$path==='/invites') { $rows=Db::all('SELECT * FROM invites'.($u['role']==='instructor'?' WHERE created_by_id=?':'').' ORDER BY id DESC',$u['role']==='instructor'?[$u['id']]:[]); foreach($rows as &$r) $r['code']='Sent by email'; return $rows; }
        if($method==='POST'&&$path==='/invites') { $role=Http::choice($b['role']??'student',['student','instructor'],'role'); if($u['role']==='instructor'&&$role!=='student') Http::fail(403,'Instructors may only invite students'); $iid=$u['role']==='instructor'?$u['id']:($b['instructor_id']??null); if($role==='instructor'&&$iid) Http::fail(422,'Instructor invite cannot have instructor_id'); if($iid && self::row('users',(int)$iid)['role']!=='instructor') Http::fail(422,'Invalid instructor');
            $token=bin2hex(random_bytes(24)); $id=Db::insert('invites',['code'=>hash('sha256',$token),'email'=>Http::email($b),'phone'=>Http::text($b,'phone',30,false),'role'=>$role,'instructor_id'=>$iid,'created_by_id'=>$u['id'],'expires_at'=>gmdate('Y-m-d H:i:s',time()+86400*Http::integer($b['expires_in_days']??7,1,30,'expires_in_days')),'created_at'=>now()]); $i=self::row('invites',$id); Mailer::queue($i['email'],'Selam Driving School invitation',"Invite code: $token\nSign up at ".env('APP_URL')."/signup\nExpires: {$i['expires_at']} UTC",'invite_sent'); $i['code']=$token; Auth::audit('invite.create','invite',$id); return $i;
        } Http::fail(404,'Endpoint not found');
    }
    private static function upload(): array {
        Auth::requireRoles(['admin']); Http::limit('upload',20); $f=$_FILES['file']??null;
        if(!$f||$f['error']!==UPLOAD_ERR_OK||$f['size']>(int)env('UPLOAD_MAX_BYTES','5242880')) Http::fail(422,'Invalid or oversized photo');
        $mime=(new finfo(FILEINFO_MIME_TYPE))->file($f['tmp_name']); $types=['image/jpeg'=>'jpg','image/png'=>'png','image/webp'=>'webp']; if(!isset($types[$mime])) Http::fail(422,'Upload JPEG, PNG or WebP');
        $size=getimagesize($f['tmp_name']); if(!$size||$size[0]>8000||$size[1]>8000||$size[0]*$size[1]>32000000) Http::fail(422,'Invalid image dimensions');
        $name=bin2hex(random_bytes(24)).'.'.$types[$mime]; if(!is_dir(DATA_DIR.'/uploads')) mkdir(DATA_DIR.'/uploads',0700,true); if(!move_uploaded_file($f['tmp_name'],DATA_DIR.'/uploads/'.$name)) throw new RuntimeException('Upload failed'); Auth::audit('media.upload','media',null); return ['url'=>'/media/'.$name];
    }
}
