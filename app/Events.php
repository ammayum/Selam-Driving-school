<?php
declare(strict_types=1);

final class Events {
    private static function instructor(array $input): int {
        $user = Auth::requireRoles(['instructor', 'admin']);
        $id = Http::integer($input['instructor_id'] ?? $user['id'], 1, PHP_INT_MAX, 'instructor_id');
        if ($user['role'] === 'instructor' && $id !== $user['id']) Http::fail(403, 'You can only access your own schedule');
        $instructor = Db::one("SELECT u.id FROM users u LEFT JOIN user_admin_states s ON s.user_id=u.id WHERE u.id=? AND LOWER(u.role)='instructor' AND COALESCE(s.is_deleted,0)=0 AND COALESCE(s.is_frozen,0)=0", [$id]);
        if (!$instructor) Http::fail(422, 'Choose an active instructor');
        return $id;
    }

    private static function owned(int $id): array {
        $user = Auth::requireRoles(['instructor', 'admin']);
        $event = Db::one('SELECT * FROM instructor_events WHERE id=?', [$id]);
        if (!$event) Http::fail(404, 'Event not found');
        if ($user['role'] !== 'admin' && $event['instructor_id'] !== $user['id']) Http::fail(403, 'You can only manage your own events');
        return $event;
    }

    public static function dispatch(string $method, string $path, array $body): array {
        Auth::requireRoles(['instructor', 'admin']);
        if ($method === 'GET' && $path === '/instructor/timeline') {
            $id = self::instructor($_GET);
            $start = Bookings::date(Http::text($_GET, 'start', 50));
            $end = Bookings::date(Http::text($_GET, 'end', 50));
            if ($end <= $start || strtotime($end) - strtotime($start) > 32 * 86400) Http::fail(422, 'Choose a range of up to 32 days');
            $items = [];
            foreach (Db::all(Bookings::query() . ' WHERE b.instructor_id=? AND b.start_time<? AND b.end_time>? ORDER BY b.start_time', [$id, $end, $start]) as $b) {
                $items[] = ['id'=>$b['id'], 'source'=>'booking', 'title'=>$b['package_title'] ?: $b['lesson_type'], 'description'=>$b['notes'] ?? '', 'location'=>$b['pickup_location'], 'student_name'=>$b['student_name'] ?: $b['guest_name'], 'event_type'=>'lesson', 'status'=>$b['status'], 'payment_status'=>$b['payment_status'], 'start_time'=>self::iso($b['start_time']), 'end_time'=>self::iso($b['end_time'])];
            }
            foreach (Db::all('SELECT * FROM instructor_events WHERE instructor_id=? AND start_time<? AND end_time>? ORDER BY start_time', [$id, $end, $start]) as $event) $items[] = self::serialize($event);
            usort($items, fn($a, $b) => strcmp($a['start_time'], $b['start_time']));
            return ['instructor_id'=>$id, 'items'=>$items];
        }
        if ($path === '/instructor/events' && $method === 'POST') {
            $id = self::instructor($body);
            return Db::transaction(function() use ($body, $id) {
                Db::lock();
                $data = self::validate($body) + ['instructor_id'=>$id, 'revision'=>1, 'status'=>'scheduled', 'created_at'=>now(), 'updated_at'=>now()];
                $eventId = Db::insert('instructor_events', $data);
                $event = self::owned($eventId);
                self::alert($event, 'created');
                Auth::audit('event.create', 'event', $eventId);
                return self::serialize($event);
            });
        }
        if (preg_match('~^/instructor/events/(\d+)$~', $path, $match) && in_array($method, ['PATCH','DELETE'], true)) {
            return Db::transaction(function() use ($body, $method, $match) {
                Db::lock();
                $old = self::owned((int)$match[1]);
                if ($method === 'DELETE' && $old['status'] === 'cancelled') return self::serialize($old);
                if ($method === 'PATCH' && $old['status'] === 'cancelled') Http::fail(409, 'Cancelled events cannot be edited');
                if (isset($body['instructor_id']) && (int)$body['instructor_id'] !== $old['instructor_id']) Http::fail(422, 'The event owner cannot be changed');
                $data = $method === 'DELETE' ? ['status'=>'cancelled'] : self::validate(array_merge($old, $body));
                $data['revision'] = (int)$old['revision'] + 1;
                $data['updated_at'] = now();
                Db::update('instructor_events', $old['id'], $data);
                $event = self::owned($old['id']);
                self::alert($event, $method === 'DELETE' ? 'cancelled' : 'updated');
                Auth::audit('event.' . ($method === 'DELETE' ? 'cancel' : 'update'), 'event', $old['id']);
                return self::serialize($event);
            });
        }
        if ($path === '/instructor/event-notifications' && $method === 'GET') {
            $id = self::instructor($_GET);
            $rows = Db::all('SELECT * FROM event_alerts WHERE instructor_id=? ORDER BY id DESC LIMIT 100', [$id]);
            foreach ($rows as &$row) $row['created_at'] = self::iso($row['created_at']);
            $count = Db::one('SELECT COUNT(*) AS total FROM event_alerts WHERE instructor_id=? AND read_at IS NULL', [$id]);
            return ['items'=>$rows, 'unread_count'=>(int)$count['total']];
        }
        if (preg_match('~^/instructor/event-notifications/(\d+)/read$~', $path, $match) && $method === 'PATCH') {
            $alert = Db::one('SELECT * FROM event_alerts WHERE id=?', [(int)$match[1]]);
            if (!$alert) Http::fail(404, 'Notification not found');
            self::instructor(['instructor_id'=>$alert['instructor_id']]);
            Db::run('UPDATE event_alerts SET read_at=? WHERE id=? AND read_at IS NULL', [now(), $alert['id']]);
            return ['status'=>'read'];
        }
        Http::fail(404, 'Endpoint not found');
    }

    private static function validate(array $body): array {
        $start = Bookings::date(Http::text($body, 'start_time', 50));
        $end = Bookings::date(Http::text($body, 'end_time', 50));
        if ($end <= $start || strtotime($end) - strtotime($start) > 31 * 86400) Http::fail(422, 'Event must end after it starts and last no more than 31 days');
        $reminder = Http::integer($body['reminder_minutes'] ?? 30, 0, 10080, 'reminder_minutes');
        $email = $body['notify_email'] ?? false;
        if (!is_bool($email) && !in_array($email, [0,1], true)) Http::fail(422, 'Invalid email preference');
        if (preg_match('/[\r\n]/', Http::text($body, 'title', 160))) Http::fail(422, 'Event title must be a single line');
        return ['title'=>Http::text($body,'title',160), 'description'=>Http::text($body,'description',2000,false), 'location'=>Http::text($body,'location',255,false), 'event_type'=>Http::choice($body['event_type'] ?? 'meeting',['meeting','driving_test','training','personal','other'],'event_type'), 'start_time'=>$start, 'end_time'=>$end, 'notify_email'=>(int)$email, 'reminder_minutes'=>$reminder];
    }

    private static function iso(string $date): string { return gmdate('Y-m-d\TH:i:s\Z', strtotime($date)); }

    private static function serialize(array $event): array {
        $event['source'] = 'event';
        $event['notify_email'] = (bool)$event['notify_email'];
        $event['reminder_minutes'] = (int)$event['reminder_minutes'];
        $event['start_time'] = self::iso($event['start_time']);
        $event['end_time'] = self::iso($event['end_time']);
        return $event;
    }

    private static function alert(array $event, string $kind): void {
        if (Db::one('SELECT id FROM event_alerts WHERE event_id=? AND revision=? AND kind=?', [$event['id'],$event['revision'],$kind])) return;
        $title = ($kind === 'reminder' ? 'Upcoming event' : 'Event '.$kind) . ': ' . $event['title'];
        $message = $event['title']."\nStart (UTC): ".$event['start_time']."\nEnd (UTC): ".$event['end_time']."\nLocation: ".($event['location'] ?: 'Not specified');
        Db::insert('event_alerts', ['event_id'=>$event['id'],'instructor_id'=>$event['instructor_id'],'revision'=>$event['revision'],'kind'=>$kind,'title'=>$title,'message'=>$message,'created_at'=>now()]);
        if ($event['notify_email']) {
            $instructor = Db::one('SELECT email FROM users WHERE id=?', [$event['instructor_id']]);
            Mailer::queue($instructor['email'], $title, $message."\nView schedule: ".rtrim(env('APP_URL'),'/').'/instructor/timeline', 'event_'.$kind);
        }
    }

    public static function reminders(): int {
        return Db::transaction(function() {
            Db::lock();
            $count = 0;
            $events = Db::all("SELECT e.* FROM instructor_events e JOIN users u ON u.id=e.instructor_id LEFT JOIN user_admin_states s ON s.user_id=u.id WHERE e.status='scheduled' AND e.reminder_minutes>0 AND e.start_time>? AND e.start_time<=? AND COALESCE(s.is_frozen,0)=0 AND COALESCE(s.is_deleted,0)=0 AND NOT EXISTS (SELECT 1 FROM event_alerts a WHERE a.event_id=e.id AND a.revision=e.revision AND a.kind='reminder')", [now(), gmdate('Y-m-d H:i:s',time()+10080*60)]);
            foreach ($events as $event) {
                if (strtotime($event['start_time']) - (int)$event['reminder_minutes'] * 60 > time()) continue;
                self::alert($event, 'reminder');
                $count++;
            }
            return $count;
        });
    }
}
