<?php
declare(strict_types=1);
final class BusinessCards {
    public static function dispatch(string $method, array $body): array {
        $user=Auth::requireRoles(['admin','instructor']);
        $id=Http::integer($_GET['instructor_id']??$user['id'],1,PHP_INT_MAX,'instructor_id');
        if($user['role']==='instructor' && $id!==$user['id']) Http::fail(403,'You can only manage your own business card');
        $instructor=Db::one("SELECT u.* FROM users u LEFT JOIN user_admin_states s ON s.user_id=u.id WHERE u.id=? AND LOWER(u.role)='instructor' AND COALESCE(s.is_deleted,0)=0 AND COALESCE(s.is_frozen,0)=0",[$id]);
        if(!$instructor) Http::fail(404,'Instructor not found');
        $row=Db::one('SELECT * FROM instructor_business_cards WHERE instructor_id=?',[$id]);
        if($method==='GET') return ['instructor_id'=>$id,'details'=>$row?json_decode($row['details'],true,32,JSON_THROW_ON_ERROR):[
            'name'=>$instructor['full_name'],'qualification'=>'Driving instructor','phone'=>$instructor['phone'],
            'instagram'=>'@Selam_driving_school','facebook'=>'Selam Driving School','location'=>'Sheffield, United Kingdom',
            'booking_url'=>rtrim(env('APP_URL'),'/').'/book',
        ]];
        if($method!=='PUT') Http::fail(405,'Method not allowed');
        $details=[];
        foreach(['name'=>120,'qualification'=>65,'phone'=>35,'instagram'=>65,'facebook'=>65,'location'=>90,'booking_url'=>300] as $field=>$max) {
            $details[$field]=Http::text($body,$field,$max,in_array($field,['name','phone','booking_url'],true));
            if(preg_match('/[\x00-\x1f\x7f]/',$details[$field])) Http::fail(422,'Use single-line card details');
        }
        if(!filter_var($details['booking_url'],FILTER_VALIDATE_URL)||!in_array(strtolower(parse_url($details['booking_url'],PHP_URL_SCHEME)??''),['https','http'],true)||parse_url($details['booking_url'],PHP_URL_USER)!==null) Http::fail(422,'Use a valid public HTTP or HTTPS booking URL');
        Db::transaction(function() use($id,$details) {
            Db::lock();
            $old=Db::one('SELECT id FROM instructor_business_cards WHERE instructor_id=?',[$id]);
            $data=['details'=>json_encode($details,JSON_THROW_ON_ERROR),'updated_at'=>now()];
            if($old) Db::update('instructor_business_cards',$old['id'],$data); else Db::insert('instructor_business_cards',$data+['instructor_id'=>$id]);
            Auth::audit('business_card.update','instructor',$id);
        });
        return ['instructor_id'=>$id,'details'=>$details];
    }
}
