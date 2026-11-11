<?php
declare(strict_types=1);
final class Content {
    public const REPEATABLES = [
        'trust_badges'=>[['title'=>'DVSA-style coaching','text'=>''],['title'=>'Flexible schedules','text'=>''],['title'=>'Guest booking available','text'=>'']],
        'highlights'=>[
            ['title'=>'Manual & Automatic','text'=>'Choose lesson type based on your confidence level.'],
            ['title'=>'Flexible Times','text'=>'Weekday and weekend slots across Sheffield.'],
            ['title'=>'Progress Tracking','text'=>'Student progress and reminders through the portal.'],
        ],
        'services'=>[
            ['title'=>'Automatic Lessons','text'=>'Build confidence faster with focused road awareness training.','badge'=>'Automatic','cta_label'=>'Book Package','cta_url'=>'/book'],
            ['title'=>'Manual Lessons','text'=>'Master clutch control, hill starts, and real Sheffield routes.','badge'=>'Manual','cta_label'=>'Book Package','cta_url'=>'/book'],
            ['title'=>'Intensive Courses','text'=>'Condensed plans for learners targeting near-term test dates.','badge'=>'Intensive','cta_label'=>'Book Package','cta_url'=>'/book'],
        ],
        'steps'=>[
            ['title'=>'Choose Package','text'=>'Pick the lesson package that fits your plan.','badge'=>'01'],
            ['title'=>'Share Your Start Date','text'=>'Tell us when you want to begin lessons.','badge'=>'02'],
            ['title'=>'We Contact You','text'=>'We confirm the instructor and lesson details directly.','badge'=>'03'],
            ['title'=>'Track Progress','text'=>'Manage lessons and reminders in portal.','badge'=>'04'],
        ],
    ];
    public const SECTIONS = [
        'home_about'=>['Why Choose Selam Driving School','Structured teaching, supportive feedback, and reliable scheduling for learners across Sheffield.'],
        'home_services'=>['Training Services','Choose the package that matches your confidence level and test timeline.'],
        'home_process'=>['How Booking Works','Simple flow designed for mobile-first learners.'],
        'home_cta'=>['Start Your Driving Journey in Sheffield','Book your first lesson now or call us for quick guidance on the right course.'],
        'home_quick_book'=>['Book in 60 seconds','Choose a package and preferred start date, then we confirm the details with you.'],
        'home_packages'=>['Find your starting gear.','Manual or automatic. Choose your hours, then let us help you take the next turn.'],
        'home_instructors'=>['Meet Our Instructors',''],
        'booking_faq'=>['Booking Questions',''],
        'faq_booking'=>['How do I book driving lessons?','Choose a package, enter your preferred start date and pickup location, and submit a booking request. The school will contact you to confirm your instructor and lesson details.'],
        'faq_account'=>['Do I need an account to request a lesson?','No. Guest booking is available. Creating an account is optional and lets you use the student portal.'],
        'faq_payment'=>['How can I pay for lessons?','The booking form offers advance payment for two hours or payment directly to the instructor in class. The school confirms the payment and lesson arrangements.'],
        'lessons_manual'=>['Manual','Clutch control, hill starts, junctions, and exam route confidence.'],
        'lessons_automatic'=>['Automatic','Focus faster on road awareness and decision making.'],
        'lessons_intensive'=>['Intensive','Compact schedules for learners targeting a quick test date.'],
        'book_process'=>['How Booking Works','Choose your package and preferred start date. Select how you want to pay: advance payment or directly to the instructor in class. After you submit, our team will assign the right instructor and contact you with the final schedule.'],
        'book_request'=>['Booking Request',''],
        'reviews_submit'=>['Share Your Testimonial',''],
        'site_footer'=>['Selam Driving School','Manual and automatic driving lessons'],
        'login'=>['Login','Sign in to manage your account.'],
        'signup'=>['Student Signup','Optional account for managing bookings and progress. You can still book as a guest.'],
    ];
    public static function defaults(): array {
        $rows=[];
        foreach(Seo::PAGES+self::SECTIONS+PublicCopy::TEXT as $slug=>$copy) $rows[$slug]=['id'=>0,'slug'=>$slug,'title'=>$copy[0],'body'=>$copy[1],'meta_title'=>null,'meta_description'=>null,'is_published'=>true,'updated_at'=>null];
        return $rows;
    }
    public static function display(string $slug): ?array { return self::page($slug)??self::defaults()[$slug]??null; }
    public static function faq(): array {
        return array_map(fn($slug)=>['question'=>self::display($slug)['title'],'answer'=>self::display($slug)['body']],['faq_booking','faq_account','faq_payment']);
    }
    public static function page(string $slug,bool $admin=false): ?array { return Db::one('SELECT * FROM cms_pages WHERE slug=?'.($admin?'':' AND is_published=1'),[$slug]); }
    public static function repeatables(): array { $c=Config::group('cms_repeatables'); $v=[]; foreach(['trust_badges','highlights','services','steps'] as $k) $v[$k]=self::jsonList($c[$k]??'[]'); return $v; }
    private static function jsonList(string $s): array { $v=json_decode($s,true); return is_array($v)&&array_is_list($v)?array_values(array_filter($v,'is_array')):[]; }
    public static function reviews(): array {
        $c=Config::group('cms_repeatables'); $rows=self::jsonList($c['review_testimonials']??'[]');
        foreach(Db::all("SELECT id,author,testimonial,rating,photo_filename FROM review_testimonial_submissions WHERE status='approved' ORDER BY id DESC") as $r) {
            $r['photo_url']=$r['photo_filename']?ReviewMedia::url((int)$r['id']):null;
            unset($r['photo_filename']);
            $rows[]=$r;
        }
        return $rows;
    }
    public static function dispatch(string $method,string $path,array $b): mixed {
        if($method==='GET' && $path==='/published') {
            $rows=self::defaults();
            foreach(Db::all('SELECT * FROM cms_pages WHERE is_published=1') as $row) $rows[$row['slug']]=$row;
            return array_values($rows);
        }
        if($method==='GET' && $path==='/catalog') {
            Auth::requireRoles(['admin']); $rows=self::defaults();
            foreach(Db::all('SELECT * FROM cms_pages ORDER BY slug') as $row) $rows[$row['slug']]=$row;
            return array_values($rows);
        }
        if($method==='GET'&&$path==='/home/repeatables') return self::repeatables();
        if($path==='/reviews/testimonials') {
            if($method==='GET') {
                if(($_GET['managed']??'')==='1') {
                    Auth::requireRoles(['admin']);
                    return ['items'=>self::jsonList(Config::group('cms_repeatables')['review_testimonials']??'[]')];
                }
                $rating=Http::integer($_GET['min_rating']??1,1,5,'min_rating');
                return ['items'=>array_values(array_filter(self::reviews(),fn($r)=>(int)($r['rating']??0)>=$rating))];
            }
            if($method==='PUT') {Auth::requireRoles(['admin']); if(!is_array($b['items']??null)||count($b['items'])>500) Http::fail(422,'Invalid testimonials'); $rows=[]; foreach($b['items'] as $r) $rows[]=self::review($r,true); Config::save('cms_repeatables',['review_testimonials'=>json_encode($rows)]); return ['items'=>self::reviews()];}
        }
        if($method==='POST'&&$path==='/reviews/testimonials/submit') {
            Http::limit('review',5);
            $r=self::review($b);
            $r['email']=empty($b['email'])?null:Http::email($b);
            $f=$_FILES['photo']??null;
            $photo=null;
            if($f && ($f['error']??UPLOAD_ERR_NO_FILE)!==UPLOAD_ERR_NO_FILE) {
                if(($b['photo_consent']??null)!=='1') Http::fail(422,'Consent is required to publish your photo');
                $photo=ReviewMedia::store($f);
            }
            $r['photo_filename']=$photo;
            $r['created_at']=now();
            try { $id=Db::insert('review_testimonial_submissions',$r); }
            catch(Throwable $error) { if($photo) ReviewMedia::remove($photo); throw $error; }
            return ['message'=>'Thank you. Your testimonial and any photo have been submitted for review.','submission_id'=>$id];
        }
        if($method==='GET'&&$path==='/reviews/testimonials/submissions') {
            Auth::requireRoles(['admin']);
            $s=isset($_GET['status'])?Http::choice($_GET['status'],['pending','approved','rejected'],'status'):null;
            $rows=Db::all('SELECT * FROM review_testimonial_submissions'.($s?' WHERE status=?':'').' ORDER BY id DESC',$s?[$s]:[]);
            foreach($rows as &$item) {
                $item['photo_url']=$item['photo_filename']?ReviewMedia::url((int)$item['id']):null;
                unset($item['photo_filename']);
            }
            unset($item);
            return $rows;
        }
        if($method==='PATCH'&&preg_match('~^/reviews/testimonials/submissions/(\d+)$~',$path,$m)) {
            Auth::requireRoles(['admin']);
            $id=(int)$m[1];
            $record=Api::row('review_testimonial_submissions',$id);
            $status=Http::choice($b['status']??null,['approved','rejected'],'status');
            $changes=['status'=>$status,'reviewed_at'=>now()];
            if($status==='rejected' && $record['photo_filename']) {
                ReviewMedia::remove($record['photo_filename']);
                $changes['photo_filename']=null;
            }
            Db::update('review_testimonial_submissions',$id,$changes);
            Auth::audit('review.moderate','review',$id);
            $result=Api::row('review_testimonial_submissions',$id);
            $result['photo_url']=$result['photo_filename']?ReviewMedia::url($id):null;
            unset($result['photo_filename']);
            return $result;
        }
        $admin=(Auth::user(false)['role']??null)==='admin';
        if($path===''&&$method==='GET') return Db::all('SELECT * FROM cms_pages'.($admin?'':' WHERE is_published=1').' ORDER BY id');
        if($path===''&&$method==='POST') {Auth::requireRoles(['admin']); $slug=Http::text($b,'slug',120); if(self::page($slug,true)) Http::fail(409,'Page exists'); return self::save($slug,$b);}
        if(preg_match('~^/([a-z0-9_-]{1,120})(/seo)?$~',$path,$m)) {
            $slug=$m[1]; $p=self::page($slug,$admin);
            if($method==='GET'&&empty($m[2])) {if(($_GET['published']??'')==='1') $p=self::display($slug); if(!$p) Http::fail(404,'Page not found'); return $p;}
            Auth::requireRoles(['admin']); if(!in_array($method,['PUT','PATCH'])) Http::fail(405,'Method not allowed');
            if($method==='PATCH'&&!$p) Http::fail(404,'Page not found');
            if(!empty($m[2])) $b=array_intersect_key($b,array_flip(['meta_title','meta_description','is_published']));
            return self::save($slug,$b,$p);
        } Http::fail(404,'Page not found');
    }
    private static function review(array $b,bool $managed=false): array {
        $r=['author'=>Http::text($b,'author',120),'testimonial'=>Http::text($b,'testimonial',1500),'rating'=>Http::integer($b['rating']??null,1,5,'rating')];
        if(mb_strlen($r['author'])<2||mb_strlen($r['testimonial'])<10) Http::fail(422,'Please provide your name and a longer testimonial');
        if($managed) {
            $image=Http::text($b,'photo_url',100,false);
            if($image!=='' && !preg_match('~^/media/[a-f0-9]{48}\.(?:jpg|png|webp)$~',$image) && !preg_match('~^/media/reviews/[1-9][0-9]*$~',$image)) Http::fail(422,'Invalid testimonial photo');
            $r['photo_url']=$image?:null;
        }
        return $r;
    }
    private static function save(string $slug,array $b,?array $p=null): array {
        if(!preg_match('/^[a-z0-9_-]{1,120}$/',$slug)) Http::fail(422,'Invalid page slug'); $p??=self::page($slug,true); $d=['slug'=>$slug,'updated_at'=>now()];
        foreach(['title'=>200,'body'=>20000,'meta_title'=>255,'meta_description'=>500] as $k=>$max) if(isset($b[$k])) $d[$k]=Http::text($b,$k,$max,false);
        if(isset($b['is_published'])) $d['is_published']=Api::boolean($b['is_published']); if(!$p && (empty($d['title'])||!isset($d['body']))) Http::fail(422,'Title and body required');
        if($p) Db::update('cms_pages',$p['id'],$d); else Db::insert('cms_pages',$d); Auth::audit('cms.save','page',null,null,['slug'=>$slug]); return self::page($slug,true);
    }
}
