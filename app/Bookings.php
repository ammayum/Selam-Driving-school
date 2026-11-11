<?php
declare(strict_types=1);
final class Bookings {
    private static function validateTime(string $start,string $end,bool $public=false): void {
        $seconds=strtotime($end)-strtotime($start);
        if($seconds<900 || $seconds>28800) Http::fail(422,'A lesson must last between 15 minutes and 8 hours');
        if($public && ($start<=now() || strtotime($start)>time()+730*86400)) Http::fail(422,'Choose a future start within the next two years');
    }
    private static function terms(array $package): array {
        return ['package_id'=>$package['id'],'package_title'=>$package['title'],'package_price'=>$package['price'],'package_hours'=>$package['hours'],'package_currency'=>'GBP'];
    }
    private static function audit(string $action,array $after,array $before=[]): void {
        $changes=[];
        $fields=['instructor_id','package_id','package_title','package_price','package_hours','package_currency','lesson_type','start_time','end_time','status','attendance_status','payment_method','payment_status','payment_requested_at','progress_score'];
        foreach($fields as $key) if(($before[$key]??null)!==($after[$key]??null)) $changes[$key]=['from'=>$before[$key]??null,'to'=>$after[$key]??null];
        // Record that private text changed, without duplicating student data in logs.
        foreach(['pickup_location','notes','progress_notes'] as $key) if(($before[$key]??null)!==($after[$key]??null)) $changes[$key]=['changed'=>true];
        if($changes) Auth::audit($action,'booking',$after['id'],null,['changes'=>$changes]);
    }
    public static function query(): string { return 'SELECT b.*,s.full_name student_name,s.email student_email,s.phone student_phone,i.full_name instructor_name,i.email instructor_email,i.phone instructor_phone FROM bookings b LEFT JOIN users s ON b.student_id=s.id LEFT JOIN users i ON b.instructor_id=i.id'; }
    public static function get(int $id): array { $b=Db::one(self::query().' WHERE b.id=?',[$id]); if(!$b) Http::fail(404,'Booking not found'); return $b; }
    public static function owned(int $id): array { $u=Auth::requireRoles(['admin','instructor']); $b=self::get($id); if($u['role']==='instructor' && $b['instructor_id']!==$u['id']) Http::fail(403,'This booking belongs to another instructor'); return $b; }
    public static function listing(bool $mine=false): array {
        $u=Auth::requireRoles($mine?['student','instructor','admin']:['admin','instructor']); $sql=self::query(); $args=[];
        if($u['role']!=='admin') { $sql.=$u['role']==='student'?' WHERE b.student_id=?':' WHERE b.instructor_id=?'; $args=[$u['id']]; }
        return Db::all($sql.' ORDER BY b.start_time DESC',$args);
    }
    public static function date(string $v): string { if(!preg_match('/^\d{4}-\d\d-\d\d[T ]\d\d:\d\d/',$v)) Http::fail(422,'Invalid lesson date'); try { $d=new DateTimeImmutable($v,new DateTimeZone('UTC')); } catch(Exception) { Http::fail(422,'Invalid lesson date'); } $errors=DateTimeImmutable::getLastErrors(); if($errors && ($errors['warning_count']||$errors['error_count'])) Http::fail(422,'Invalid lesson date'); return $d->setTimezone(new DateTimeZone('UTC'))->format('Y-m-d H:i:s'); }
    private static function instructor(int $id): void {
        $u=Db::one('SELECT u.id FROM users u LEFT JOIN user_admin_states s ON u.id=s.user_id WHERE u.id=? AND LOWER(u.role)=? AND COALESCE(s.is_frozen,0)=0 AND COALESCE(s.is_deleted,0)=0',[$id,'instructor']); if(!$u) Http::fail(422,'Invalid instructor');
    }
    private static function conflict(?int $id,string $start,string $end,int $exclude=0): void {
        if(!$id) return; self::instructor($id);
        if(Db::one("SELECT id FROM bookings WHERE instructor_id=? AND LOWER(status)<>'cancelled' AND start_time<? AND end_time>? AND id<>?",[$id,$end,$start,$exclude])) Http::fail(409,'Instructor is unavailable for this time');
    }
    private static function package(array $b): array { $p=!empty($b['package_id'])?Db::one('SELECT * FROM lesson_packages WHERE id=?',[(int)$b['package_id']]):Db::one('SELECT * FROM lesson_packages WHERE title=?',[$b['package_title']??'']); if(!$p||!$p['is_active']) Http::fail(422,'Choose an active package'); return $p; }
    public static function create(array $data): array {
        Http::limit('booking',12);
        return Db::transaction(function() use($data) {
            Db::lock(); $u=Auth::user(false); $p=self::package($data);
            if(!empty($data['instructor_id']) && ($u['role']??'')!=='admin') Http::fail(403,'Only administrators can assign instructors');
            $lessonType=Http::choice(strtolower(Http::text($data,'lesson_type',20)),['manual','automatic'],'lesson_type');
            if($lessonType!==$p['package_type']) Http::fail(422,'Choose a package matching the selected lesson type');
            $start=self::date(Http::text($data,'start_time',50)); $end=self::date(Http::text($data,'end_time',50)); if($end<=$start) Http::fail(422,'End must be after start');
            self::validateTime($start,$end,($u['role']??'')!=='admin');
            $student=null; $email=empty($data['student_id'])?Http::email($data,'guest_email'):'';
            if(!empty($data['student_id'])) { if(!$u||($u['role']!=='admin'&&$u['id']!==(int)$data['student_id'])) Http::fail(403,'Invalid student'); $student=Db::one("SELECT * FROM users WHERE id=? AND LOWER(role)='student'",[(int)$data['student_id']]); if(!$student) Http::fail(422,'Invalid student'); $email=$student['email']; }
            else { $student=Db::one("SELECT * FROM users WHERE email=?",[$email]); if($student && $student['role']!=='student') Http::fail(422,'Use a student email'); }
            $iid=!empty($data['instructor_id'])?Http::integer($data['instructor_id'],1,PHP_INT_MAX,'instructor_id'):null;
            $existing=Db::one('SELECT id FROM bookings WHERE guest_email=? AND start_time=? AND end_time=? AND package_id=? AND (instructor_id=? OR (instructor_id IS NULL AND ? IS NULL))',[$email,$start,$end,$p['id'],$iid,$iid]);
            if($existing) return self::receipt(self::get($existing['id']),$u);
            self::conflict($iid,$start,$end);
            if(!$student) $student=Auth::create(['email'=>$email,'full_name'=>Http::text($data,'guest_name',120),'phone'=>Http::text($data,'guest_phone',30)],'student');
            $b=['student_id'=>$student['id'],'instructor_id'=>$iid,'package_id'=>$p['id'],'package_title'=>$p['title'],'lesson_type'=>$lessonType,'start_time'=>$start,'end_time'=>$end,'pickup_location'=>Http::text($data,'pickup_location',255),'guest_name'=>Http::text($data,'guest_name',120,false),'guest_email'=>$email,'guest_phone'=>Http::text($data,'guest_phone',30,false),'notes'=>Http::text($data,'notes',500,false),'payment_method'=>Http::choice($data['payment_method']??null,['advance_2_hours','pay_instructor_in_class'],'payment_method'),'created_at'=>now()];
            $id=Db::insert('bookings',array_merge($b,self::terms($p))); $b=self::get($id); self::notify($b,'Booking request received','booking_created'); self::adminNotify($b); self::audit('booking.create',$b); return self::receipt($b,$u);
        });
    }
    private static function receipt(array $b,?array $u): array {
        if(!$u || ($u['role']!=='admin' && $u['id']!==$b['student_id'])) {
            // Public requests must not reveal details from an existing student's account.
            foreach(['student_id','student_name','student_email','student_phone','guest_name','guest_email','guest_phone','pickup_location','instructor_name','instructor_email','instructor_phone','notes','progress_notes','progress_score'] as $k) $b[$k]=null;
        } return $b;
    }
    public static function update(int $id,array $data): array {
        return Db::transaction(function() use($id,$data) {
            Db::lock(); $old=self::owned($id); $b=[];
            foreach(['start_time','end_time'] as $key) if(isset($data[$key])) $b[$key]=self::date(Http::text($data,$key,50));
            foreach(['pickup_location'=>255,'notes'=>500,'progress_notes'=>1000] as $key=>$max) if(array_key_exists($key,$data)) $b[$key]=Http::text($data,$key,$max,false);
            foreach(['status'=>['pending','approved','cancelled','completed'],'attendance_status'=>['pending','attended','missed'],'payment_method'=>['advance_2_hours','pay_instructor_in_class']] as $key=>$choices) if(isset($data[$key])) $b[$key]=Http::choice($data[$key],$choices,$key);
            if(isset($data['progress_score'])) $b['progress_score']=Http::integer($data['progress_score'],0,100,'progress_score');
            if(isset($data['instructor_id'])) { if(Auth::user()['role']!=='admin' && (int)$data['instructor_id']!==$old['instructor_id']) Http::fail(403,'Only administrators can reassign lessons'); $b['instructor_id']=Http::integer($data['instructor_id'],1,PHP_INT_MAX,'instructor_id'); }
            if(isset($data['package_id'])||isset($data['package_title'])) { $p=self::package($data); if($p['id']!==$old['package_id']) { if(Auth::user()['role']!=='admin') Http::fail(403,'Only administrators can change the agreed package'); if($p['package_type']!==strtolower($old['lesson_type'])) Http::fail(422,'Choose a package matching the booking lesson type'); $b=array_merge($b,self::terms($p)); } }
            if(isset($b['start_time'])||isset($b['end_time'])) self::validateTime($b['start_time']??$old['start_time'],$b['end_time']??$old['end_time']);
            $next=array_merge($old,$b); if($next['end_time']<=$next['start_time']) Http::fail(422,'End must be after start'); if($next['status']!=='cancelled') self::conflict($next['instructor_id'],$next['start_time'],$next['end_time'],$id);
            Db::update('bookings',$id,$b); $next=self::get($id);
            if($old['status']!==$next['status']) self::notify($next,'Booking status: '.$next['status'],'booking_status_update');
            if($old['start_time']!==$next['start_time']||$old['end_time']!==$next['end_time']) self::notify($next,'Booking rescheduled','booking_rescheduled');
            if($old['instructor_id']!==$next['instructor_id']) self::notify($next,'Instructor assigned','booking_instructor_assigned');
            self::audit('booking.update',$next,$old); return $next;
        });
    }
    public static function payment(int $id,array $data,bool $request=false): array {
        return Db::transaction(function() use($id,$data,$request) { Db::lock(); $current=self::owned($id); $s=$request?'waiting':Http::choice($data['payment_status']??null,['not_requested','waiting','paid'],'payment_status'); if(in_array($s,['waiting','paid']) && $current['status']!=='completed') Http::fail(422,'Booking must be completed before requesting or recording payment'); $d=['payment_status'=>$s]; if($request || ($s==='waiting' && !$current['payment_requested_at'])) $d['payment_requested_at']=now(); Db::update('bookings',$id,$d); $b=self::get($id); self::notify($b,'Payment status: '.$s,'payment_'.$s,true); self::audit('booking.payment',$b,$current); return $b; });
    }
    public static function availability(int $iid,string $day): array {
        self::instructor($iid); $d=DateTimeImmutable::createFromFormat('!Y-m-d',$day); if(!$d || $d->format('Y-m-d')!==$day) Http::fail(422,'Invalid day');
        $slots=[]; for($h=8;$h<18;$h++) { $s=$d->setTime($h,0)->format('Y-m-d H:i:s'); $end=$d->setTime($h+1,0)->format('Y-m-d H:i:s'); if(!Db::one("SELECT id FROM bookings WHERE instructor_id=? AND LOWER(status)<>'cancelled' AND start_time<? AND end_time>?",[$iid,$end,$s])) $slots[]=sprintf('%02d:00',$h); } return ['instructor_id'=>$iid,'date'=>$day,'slots'=>$slots];
    }
    public static function assign(int $id,array $data): array {
        Http::limit('assign',20); return Db::transaction(function() use($id,$data) {Db::lock(); $t=Db::one('SELECT * FROM booking_assignment_tokens WHERE booking_id=? AND token_hash=?',[$id,hash('sha256',Http::text($data,'token',100))]); if(!$t||$t['used_at']||$t['expires_at']<now()) Http::fail(422,'Assignment link expired or already used'); $b=self::get($id); $old=$b; if($b['status']!=='pending') Http::fail(409,'Booking is no longer pending'); self::conflict($t['instructor_id'],$b['start_time'],$b['end_time'],$id); Db::update('bookings',$id,['instructor_id'=>$t['instructor_id']]); Db::run('UPDATE booking_assignment_tokens SET used_at=? WHERE booking_id=?',[now(),$id]); $b=self::get($id); self::notify($b,'Instructor assigned','booking_instructor_assigned'); self::audit('booking.assign_by_token',$b,$old); return self::receipt($b,Auth::user(false)); });
    }
    private static function notify(array $b,string $subject,string $category,bool $studentOnly=false): void {
        $body="Booking #{$b['id']}\nPackage: {$b['package_title']}\nStart (UTC): {$b['start_time']}\nEnd (UTC): {$b['end_time']}\nPickup: {$b['pickup_location']}\nStatus: {$b['status']}\nPayment: {$b['payment_status']}\nInstructor: ".($b['instructor_name']??'Pending')."\n";
        $ics="BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Selam Driving School//EN\r\nMETHOD:REQUEST\r\nBEGIN:VEVENT\r\nUID:booking-{$b['id']}@".parse_url(env('APP_URL'),PHP_URL_HOST)."\r\nDTSTAMP:".gmdate('Ymd\THis\Z')."\r\nDTSTART:".gmdate('Ymd\THis\Z',strtotime($b['start_time']))."\r\nDTEND:".gmdate('Ymd\THis\Z',strtotime($b['end_time']))."\r\nSUMMARY:Driving lesson\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n";
        Mailer::queue($b['student_email']??$b['guest_email'],$subject.' (#'.$b['id'].')',$body,$category,$studentOnly?null:$ics);
        if(!$studentOnly && $b['instructor_email']) Mailer::queue($b['instructor_email'],$subject.' (#'.$b['id'].')',$body."Student: {$b['guest_name']}\nEmail: {$b['guest_email']}\nPhone: {$b['guest_phone']}",$category,$ics);
    }
    private static function adminNotify(array $b): void {
        $lines=[]; foreach(Db::all("SELECT u.* FROM users u LEFT JOIN user_admin_states s ON u.id=s.user_id WHERE LOWER(role)='instructor' AND COALESCE(s.is_frozen,0)=0 AND COALESCE(s.is_deleted,0)=0") as $i) { $token=bin2hex(random_bytes(24)); Db::insert('booking_assignment_tokens',['booking_id'=>$b['id'],'instructor_id'=>$i['id'],'token_hash'=>hash('sha256',$token),'expires_at'=>gmdate('Y-m-d H:i:s',time()+86400),'created_at'=>now()]); $lines[]=$i['full_name'].': '.env('APP_URL').'/assign/booking/'.$b['id'].'?token='.$token; }
        foreach(Db::all("SELECT u.*,COALESCE(p.allow_email_assign,1) allow_email_assign,COALESCE(p.receive_booking_emails,1) receive_booking_emails FROM users u LEFT JOIN admin_preferences p ON p.user_id=u.id WHERE LOWER(u.role)='admin'") as $admin) if($admin['receive_booking_emails']) Mailer::queue($admin['email'],'New booking #'.$b['id'],"A booking request has arrived. Open your portal to manage it.\n".($admin['allow_email_assign']?implode("\n",$lines):''),'booking_admin_alert');
    }
    public static function stats(array $rows): array {
        $s=['total'=>count($rows),'by_status'=>[],'by_attendance'=>[],'by_payment'=>[],'completion_rate'=>0,'average_progress_score'=>0]; $scores=[];
        foreach($rows as $r) { foreach(['status'=>'by_status','attendance_status'=>'by_attendance','payment_status'=>'by_payment'] as $key=>$group) $s[$group][$r[$key]]=($s[$group][$r[$key]]??0)+1; if($r['progress_score']!==null) $scores[]=$r['progress_score']; }
        $s['completion_rate']=$rows?round(($s['by_status']['completed']??0)/count($rows)*100,2):0; $s['average_progress_score']=$scores?round(array_sum($scores)/count($scores),2):0; return $s;
    }
}
