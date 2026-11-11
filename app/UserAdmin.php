<?php
declare(strict_types=1);

final class UserAdmin {
    private static function confirm(array $data,array $actor): void {
        Http::limit('admin-account-change',20);
        Http::text($data,'current_password',128);
        if(!Auth::verify($data['current_password'],$actor['password_hash'])) Http::fail(403,'Confirm your own administrator password');
    }
    public static function create(array $data): array {
        return Db::transaction(function() use($data) {
            Db::lock(); $actor=Auth::requireRoles(['admin']);
            $role=Http::choice($data['role']??null,['student','instructor','admin'],'role');
            if($role==='admin') self::confirm($data,$actor);
            unset($data['password']);
            $temporary=$role==='admin'?null:bin2hex(random_bytes(12));
            if($temporary) $data['password']=$temporary;
            $user=Auth::create($data,$role);
            if($temporary) Db::update('users',$user['id'],['must_change_password'=>1,'temporary_password_expires_at'=>gmdate('Y-m-d H:i:s',time()+86400)]);
            Auth::sendReset($user);
            Auth::audit('user.create','user',$user['id'],$actor,['role'=>$role]);
            return Auth::publicUser($user)+['is_frozen'=>false,'is_deleted'=>false,'temporary_password'=>$temporary];
        });
    }
    public static function change(int $id,string $action,array $data): array {
        return Db::transaction(function() use($id,$action,$data) {
            Db::lock(); $actor=Auth::requireRoles(['admin']); $user=Api::row('users',$id);
            $state=Db::one('SELECT * FROM user_admin_states WHERE user_id=?',[$id]);
            if($user['role']==='admin') self::confirm($data,$actor);
            if(isset($data['role']) && $data['role']!==$user['role']) Http::fail(422,'Account roles cannot be changed');
            if($action==='edit') {
                if($state['is_deleted']??false) Http::fail(422,'Restore this account before editing');
                $changes=[];
                foreach(['full_name'=>120,'phone'=>30,'profile_photo_url'=>500,'permit_number'=>120] as $key=>$max) {
                    if(isset($data[$key])) $changes[$key]=Http::text($data,$key,$max,in_array($key,['full_name','phone'],true));
                }
                if(isset($data['email'])) $changes['email']=Http::email($data);
                if(isset($data['instructor_type'])) $changes['instructor_type']=Http::choice($data['instructor_type'],['manual','automatic','both'],'instructor_type');
                if(!empty($changes['profile_photo_url'])) Config::safeUrl($changes['profile_photo_url']);
                $changes=array_filter($changes,fn($value,$key)=>$value!==$user[$key],ARRAY_FILTER_USE_BOTH);
                Db::update('users',$id,$changes);
                if(isset($changes['email'])) self::invalidate($id);
                if($changes) Auth::audit('user.update','user',$id,$actor,['changed_fields'=>array_keys($changes)]);
            } else {
                $freeze=$action==='freeze'?Api::boolean($data['is_frozen']??null):0;
                $disable=$action==='delete'||($action==='freeze'&&$freeze);
                if($disable && $id===$actor['id']) Http::fail(403,'You cannot disable or delete your own account');
                if($disable && $user['role']==='admin') {
                    $others=Db::one("SELECT COUNT(*) total FROM users u LEFT JOIN user_admin_states s ON s.user_id=u.id WHERE u.role='admin' AND u.id<>? AND COALESCE(s.is_deleted,0)=0 AND COALESCE(s.is_frozen,0)=0",[$id]);
                    if(!$others['total']) Http::fail(409,'At least one active administrator must remain');
                }
                if($action==='freeze' && ($state['is_deleted']??false)) Http::fail(422,'Restore this account first');
                $change=match($action) {
                    'delete'=>['is_deleted'=>1], 'restore'=>['is_deleted'=>0], 'freeze'=>['is_frozen'=>$freeze],
                    default=>throw new HttpError(405,'Unsupported account action'),
                };
                $change['updated_at']=now();
                if($state) Db::update('user_admin_states',$state['id'],$change); else Db::insert('user_admin_states',$change+['user_id'=>$id]);
                self::invalidate($id);
                Auth::audit('user.'.($action==='freeze'?($freeze?'freeze':'unfreeze'):$action),'user',$id,$actor);
            }
            return Auth::publicUser(Db::one('SELECT u.*,COALESCE(s.is_frozen,0) is_frozen,COALESCE(s.is_deleted,0) is_deleted FROM users u LEFT JOIN user_admin_states s ON s.user_id=u.id WHERE u.id=?',[$id]));
        });
    }
    private static function invalidate(int $id): void {
        Auth::revoke($id);
        Db::run('UPDATE password_reset_tokens SET used_at=? WHERE user_id=? AND used_at IS NULL',[now(),$id]);
    }
}
