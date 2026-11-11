<?php
declare(strict_types=1);
final class Schema {
    public static function tables(): array { return [
        'users'=>"full_name VARCHAR(120) NOT NULL, username VARCHAR(80) NOT NULL UNIQUE, email VARCHAR(255) NOT NULL UNIQUE, password_hash VARCHAR(255) NOT NULL, must_change_password INTEGER NOT NULL DEFAULT 0, temporary_password_expires_at DATETIME, phone VARCHAR(30) NOT NULL, role VARCHAR(20) NOT NULL, profile_photo_url VARCHAR(500), permit_number VARCHAR(120), instructor_type VARCHAR(20), created_at DATETIME NOT NULL",
        'user_admin_states'=>"user_id INTEGER NOT NULL UNIQUE, is_frozen INTEGER NOT NULL DEFAULT 0, is_deleted INTEGER NOT NULL DEFAULT 0, updated_at DATETIME NOT NULL, FOREIGN KEY(user_id) REFERENCES users(id)",
        'admin_preferences'=>"user_id INTEGER NOT NULL UNIQUE, allow_email_assign INTEGER NOT NULL DEFAULT 1, receive_booking_emails INTEGER NOT NULL DEFAULT 1, updated_at DATETIME NOT NULL, FOREIGN KEY(user_id) REFERENCES users(id)",
        'lesson_packages'=>"title VARCHAR(120) NOT NULL, lesson_count INTEGER NOT NULL, hours DECIMAL(7,2) NOT NULL DEFAULT 1, package_type VARCHAR(20) NOT NULL DEFAULT 'manual', price DECIMAL(10,2) NOT NULL, description TEXT, is_active INTEGER NOT NULL DEFAULT 1, updated_at DATETIME NOT NULL",
        'bookings'=>"student_id INTEGER, instructor_id INTEGER, package_id INTEGER, package_title VARCHAR(120), package_price DECIMAL(10,2), package_hours DECIMAL(7,2), package_currency VARCHAR(3), lesson_type VARCHAR(50) NOT NULL, start_time DATETIME NOT NULL, end_time DATETIME NOT NULL, pickup_location VARCHAR(255) NOT NULL, status VARCHAR(30) NOT NULL DEFAULT 'pending', guest_name VARCHAR(120), guest_email VARCHAR(255), guest_phone VARCHAR(30), notes TEXT, attendance_status VARCHAR(30) NOT NULL DEFAULT 'pending', progress_notes TEXT, progress_score INTEGER, payment_method VARCHAR(40), payment_status VARCHAR(30) NOT NULL DEFAULT 'not_requested', payment_requested_at DATETIME, created_at DATETIME NOT NULL, FOREIGN KEY(student_id) REFERENCES users(id), FOREIGN KEY(instructor_id) REFERENCES users(id), FOREIGN KEY(package_id) REFERENCES lesson_packages(id)",
        'cms_pages'=>"slug VARCHAR(120) NOT NULL UNIQUE, title VARCHAR(200) NOT NULL, body TEXT NOT NULL, meta_title VARCHAR(255), meta_description VARCHAR(500), is_published INTEGER NOT NULL DEFAULT 0, updated_at DATETIME NOT NULL",
        'system_configs'=>"`group` VARCHAR(50) NOT NULL, `key` VARCHAR(120) NOT NULL, value TEXT NOT NULL, updated_at DATETIME NOT NULL, UNIQUE (`group`,`key`)",
        'notifications'=>"recipient VARCHAR(255) NOT NULL, channel VARCHAR(30) NOT NULL, message TEXT NOT NULL, category VARCHAR(50) NOT NULL, status VARCHAR(30) NOT NULL DEFAULT 'queued', created_at DATETIME NOT NULL",
        'mail_outbox'=>"notification_id INTEGER NOT NULL, payload TEXT NOT NULL, attempts INTEGER NOT NULL DEFAULT 0, available_at DATETIME NOT NULL, locked_at DATETIME, sent_at DATETIME, FOREIGN KEY(notification_id) REFERENCES notifications(id)",
        'invites'=>"code VARCHAR(64) NOT NULL UNIQUE, email VARCHAR(255) NOT NULL, phone VARCHAR(30), role VARCHAR(30) NOT NULL, instructor_id INTEGER, created_by_id INTEGER NOT NULL, status VARCHAR(30) NOT NULL DEFAULT 'pending', expires_at DATETIME NOT NULL, accepted_at DATETIME, created_at DATETIME NOT NULL, FOREIGN KEY(instructor_id) REFERENCES users(id), FOREIGN KEY(created_by_id) REFERENCES users(id)",
        'password_reset_tokens'=>"user_id INTEGER NOT NULL, token_hash VARCHAR(128) NOT NULL UNIQUE, expires_at DATETIME NOT NULL, used_at DATETIME, created_at DATETIME NOT NULL, FOREIGN KEY(user_id) REFERENCES users(id)",
        'booking_assignment_tokens'=>"booking_id INTEGER NOT NULL, instructor_id INTEGER NOT NULL, token_hash VARCHAR(128) NOT NULL UNIQUE, expires_at DATETIME NOT NULL, used_at DATETIME, created_at DATETIME NOT NULL, FOREIGN KEY(booking_id) REFERENCES bookings(id), FOREIGN KEY(instructor_id) REFERENCES users(id)",
        'review_testimonial_submissions'=>"author VARCHAR(120) NOT NULL, email VARCHAR(255), testimonial TEXT NOT NULL, rating INTEGER NOT NULL, photo_filename VARCHAR(100), status VARCHAR(30) NOT NULL DEFAULT 'pending', created_at DATETIME NOT NULL, reviewed_at DATETIME",
        'blog_posts'=>"slug VARCHAR(120) NOT NULL UNIQUE, title VARCHAR(200) NOT NULL, excerpt VARCHAR(500) NOT NULL, body TEXT NOT NULL, cover_image_url VARCHAR(500), image_alt VARCHAR(200), is_published INTEGER NOT NULL DEFAULT 0, published_at DATETIME, created_at DATETIME NOT NULL, updated_at DATETIME NOT NULL",
        'activity_logs'=>"actor_role VARCHAR(30) NOT NULL, actor_id INTEGER, actor_username VARCHAR(80), action VARCHAR(120) NOT NULL, target_type VARCHAR(80) NOT NULL, target_id INTEGER, details TEXT, created_at DATETIME NOT NULL",
        'auth_versions'=>"user_id INTEGER NOT NULL UNIQUE, version INTEGER NOT NULL DEFAULT 1, FOREIGN KEY(user_id) REFERENCES users(id)",
        'instructor_events'=>"instructor_id INTEGER NOT NULL, title VARCHAR(160) NOT NULL, description TEXT, location VARCHAR(255), event_type VARCHAR(30) NOT NULL, start_time DATETIME NOT NULL, end_time DATETIME NOT NULL, status VARCHAR(30) NOT NULL DEFAULT 'scheduled', notify_email INTEGER NOT NULL DEFAULT 0, reminder_minutes INTEGER NOT NULL DEFAULT 30, revision INTEGER NOT NULL DEFAULT 1, created_at DATETIME NOT NULL, updated_at DATETIME NOT NULL, FOREIGN KEY(instructor_id) REFERENCES users(id)",
        'event_alerts'=>"event_id INTEGER NOT NULL, instructor_id INTEGER NOT NULL, revision INTEGER NOT NULL, kind VARCHAR(30) NOT NULL, title VARCHAR(200) NOT NULL, message TEXT NOT NULL, read_at DATETIME, created_at DATETIME NOT NULL, UNIQUE(event_id,revision,kind), FOREIGN KEY(event_id) REFERENCES instructor_events(id), FOREIGN KEY(instructor_id) REFERENCES users(id)",
        'instructor_business_cards'=>"instructor_id INTEGER NOT NULL UNIQUE, details TEXT NOT NULL, updated_at DATETIME NOT NULL, FOREIGN KEY(instructor_id) REFERENCES users(id)",
        'app_locks'=>"value INTEGER NOT NULL DEFAULT 0",
    ]; }
    public static function migrate(?PDO $pdo=null): void {
        $pdo??=Db::get(); $sqlite=$pdo->getAttribute(PDO::ATTR_DRIVER_NAME)==='sqlite';
        foreach(self::tables() as $table=>$columns) $pdo->exec('CREATE TABLE IF NOT EXISTS `'.$table.'` (id '.($sqlite?'INTEGER PRIMARY KEY AUTOINCREMENT':'INTEGER PRIMARY KEY AUTO_INCREMENT').', '.$columns.')'.($sqlite?'':' ENGINE=InnoDB DEFAULT CHARSET=utf8mb4'));
        $columns=$pdo->query($sqlite?'PRAGMA table_info(lesson_packages)':'SHOW COLUMNS FROM lesson_packages')->fetchAll(PDO::FETCH_ASSOC);
        $names=array_column($columns,$sqlite?'name':'Field');
        if(!in_array('hours',$names,true)) {
            $pdo->exec('ALTER TABLE lesson_packages ADD COLUMN hours DECIMAL(7,2) NOT NULL DEFAULT 1');
            $pdo->exec('UPDATE lesson_packages SET hours=lesson_count');
        }
        if(!in_array('package_type',$names,true)) {
            $pdo->exec("ALTER TABLE lesson_packages ADD COLUMN package_type VARCHAR(20) NOT NULL DEFAULT 'manual'");
            $pdo->exec("UPDATE lesson_packages SET package_type='automatic' WHERE LOWER(title) LIKE '%automatic%'");
        }
        // Historical agreed terms are unknown; never invent them from today's prices.
        $columns=$pdo->query($sqlite?'PRAGMA table_info(bookings)':'SHOW COLUMNS FROM bookings')->fetchAll(PDO::FETCH_ASSOC);
        $names=array_column($columns,$sqlite?'name':'Field');
        foreach(['package_price'=>'DECIMAL(10,2)','package_hours'=>'DECIMAL(7,2)','package_currency'=>'VARCHAR(3)'] as $name=>$type) {
            if(!in_array($name,$names,true)) $pdo->exec('ALTER TABLE bookings ADD COLUMN '.$name.' '.$type.' NULL');
        }
        $columns=$pdo->query($sqlite?'PRAGMA table_info(users)':'SHOW COLUMNS FROM users')->fetchAll(PDO::FETCH_ASSOC);
        $names=array_column($columns,$sqlite?'name':'Field');
        foreach(['must_change_password'=>'INTEGER NOT NULL DEFAULT 0','temporary_password_expires_at'=>'DATETIME NULL'] as $name=>$type) {
            if(!in_array($name,$names,true)) $pdo->exec('ALTER TABLE users ADD COLUMN '.$name.' '.$type);
        }
        $reviewColumns=$pdo->query($sqlite?'PRAGMA table_info(review_testimonial_submissions)':'SHOW COLUMNS FROM review_testimonial_submissions')->fetchAll(PDO::FETCH_ASSOC);
        $reviewNames=array_column($reviewColumns,$sqlite?'name':'Field');
        if(!in_array('photo_filename',$reviewNames,true)) $pdo->exec('ALTER TABLE review_testimonial_submissions ADD COLUMN photo_filename VARCHAR(100) NULL');
        if(!$pdo->query('SELECT id FROM app_locks WHERE id=1')->fetch()) $pdo->exec('INSERT INTO app_locks(id,value) VALUES (1,0)');
    }
}
