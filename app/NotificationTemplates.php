<?php
declare(strict_types=1);

final class NotificationTemplates {
    private const CATEGORIES = [
        'booking_created'=>'Booking confirmation', 'booking_status_update'=>'Booking status',
        'booking_rescheduled'=>'Booking rescheduled', 'booking_instructor_assigned'=>'Instructor assigned',
        'booking_admin_alert'=>'Admin booking alert', 'payment_waiting'=>'Payment requested',
        'payment_paid'=>'Payment received', 'payment_not_requested'=>'Payment status reset',
        'password_reset'=>'Password setup / reset', 'invite_sent'=>'Account invitation',
        'event_created'=>'Event created', 'event_updated'=>'Event updated',
        'event_cancelled'=>'Event cancelled', 'event_reminder'=>'Event reminder',
        'default'=>'Other email notifications',
    ];

    public static function catalog(): array {
        $saved=Config::group('notification_templates'); $rows=[];
        foreach(self::CATEGORIES as $category=>$label) {
            $row=isset($saved[$category])?json_decode($saved[$category],true,16,JSON_THROW_ON_ERROR):[];
            $rows[]=['category'=>$category,'label'=>$label,'subject'=>$row['subject']??'{{subject}}','body'=>$row['body']??'{{details}}'];
        }
        return $rows;
    }

    public static function dispatch(string $method,array $data): array {
        Auth::requireRoles(['admin']);
        if($method==='GET') return self::catalog();
        if($method!=='PUT') Http::fail(405,'Method not allowed');
        $category=Http::choice($data['category']??null,array_keys(self::CATEGORIES),'category');
        $subject=Http::text($data,'subject',200); $body=Http::text($data,'body',12000);
        if(preg_match('/[\r\n]/',$subject)) Http::fail(422,'Subject must be one line');
        if(!str_contains($body,'{{details}}')) Http::fail(422,'Keep {{details}} in the message to preserve booking details, reset tokens and links.');
        foreach([$subject,$body] as $index=>$text) {
            $allowed=$index===0?['subject','site_name','site_url']:['subject','details','site_name','site_url'];
            foreach($allowed as $key) $text=str_replace('{{'.$key.'}}','',$text);
            if(str_contains($text,'{{')||str_contains($text,'}}')) Http::fail(422,'Unknown or malformed placeholder');
        }
        Config::save('notification_templates',[$category=>json_encode(compact('subject','body'),JSON_THROW_ON_ERROR)]);
        Auth::audit('notification_template.save','notification_template',null,null,['category'=>$category]);
        return self::catalog();
    }

    public static function render(string $category,string $subject,string $body): array {
        $templates=array_column(self::catalog(),null,'category');
        $template=$templates[$category]??$templates['default'];
        $values=['{{subject}}'=>$subject,'{{details}}'=>$body,'{{site_name}}'=>'Selam Driving School','{{site_url}}'=>rtrim(env('APP_URL'),'/')];
        return [strtr($template['subject'],$values),strtr($template['body'],$values)];
    }
}
