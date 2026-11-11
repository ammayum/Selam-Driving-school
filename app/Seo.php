<?php
declare(strict_types=1);
final class Seo {
    public const PAGES = [
        'home'=>['Learn Manual and Automatic Driving with Confidence','Professional instructors, fast booking, and a modern student portal to keep every lesson on track.'],
        'about'=>['About Selam Driving School','We help learners in Sheffield pass confidently using structured lessons and supportive coaching.'],
        'lessons'=>['Driving Lessons','Manual, automatic and intensive driving courses in Sheffield.'],
        'prices'=>['Prices','Transparent package pricing for Sheffield learners.'],
        'instructors'=>['Our Instructors','Experienced and friendly instructors ready to support your journey.'],
        'reviews'=>['Student Reviews','Feedback from learners.'],
        'contact'=>['Contact','Call or message Selam Driving School in Sheffield.'],
        'blog'=>['Learning Hub','Local driving tips, test readiness, and learner guides.'],
        'book'=>['Book Lesson','Choose a package, your preferred start date, and payment option.'],
    ];
    public const FAQ = [
        ['question'=>'How do I book driving lessons?','answer'=>'Choose a package, enter your preferred start date and pickup location, and submit a booking request. The school will contact you to confirm your instructor and lesson details.'],
        ['question'=>'Do I need an account to request a lesson?','answer'=>'No. Guest booking is available. Creating an account is optional and lets you use the student portal.'],
        ['question'=>'How can I pay for lessons?','answer'=>'The booking form offers advance payment for two hours or payment directly to the instructor in class. The school confirms the payment and lesson arrangements.'],
    ];
    public static function metadata(string $path): array {
        $slug=$path==='/'?'home':trim($path,'/'); $p=Content::display($slug); $fallback=self::PAGES[$slug]??null;
        $private=in_array($slug,['login','signup','portal','change-password','instructor/timeline','instructor/business-card'])||str_starts_with($slug,'assign/')||$slug==='admin'||str_starts_with($slug,'admin/');
        $exists=($p!==null||$fallback!==null||$private) && (!isset(Content::SECTIONS[$slug]) && !isset(PublicCopy::TEXT[$slug]) || in_array($slug,['login','signup'],true));
        $title=($p['meta_title']??'')?:$p['title']??$fallback[0]??($private?ucfirst(explode('/',$slug)[0]):'Page not found');
        if(!str_contains($title,'Selam')) $title.=' | Selam Driving School';
        $description=($p['meta_description']??'')?:$p['body']??$fallback[1]??'Selam Driving School account portal.';
        $canonical=rtrim(env('APP_URL'),'/').($path==='/'?'/':'/'.trim($path,'/'));
        $graph=[];
        if(!$private && $exists) {
            $base=rtrim(env('APP_URL'),'/'); $contact=Api::publicSettings('contact');
            $business=['@type'=>['LocalBusiness','EducationalOrganization'],'@id'=>$base.'/#school','name'=>'Selam Driving School','url'=>$base.'/','areaServed'=>['@type'=>'City','name'=>'Sheffield']];
            if($contact['phone']) $business['telephone']=$contact['phone']; if($contact['email']) $business['email']=$contact['email']; if($contact['address']) $business['address']=$contact['address'];
            $graph[]=$business;
            $graph[]=['@type'=>'WebSite','@id'=>$base.'/#website','url'=>$base.'/','name'=>'Selam Driving School','publisher'=>['@id'=>$base.'/#school']];
            $graph[]=['@type'=>'WebPage','@id'=>$canonical.'#webpage','url'=>$canonical,'name'=>$title,'description'=>mb_substr($description,0,300),'isPartOf'=>['@id'=>$base.'/#website']];
            if($path!=='/') $graph[]=['@type'=>'BreadcrumbList','itemListElement'=>[['@type'=>'ListItem','position'=>1,'name'=>'Home','item'=>$base.'/'],['@type'=>'ListItem','position'=>2,'name'=>$p['title']??$fallback[0]??$title,'item'=>$canonical]]];
            if($slug==='home') $graph[]=['@type'=>'FAQPage','mainEntity'=>array_map(fn($f)=>['@type'=>'Question','name'=>$f['question'],'acceptedAnswer'=>['@type'=>'Answer','text'=>$f['answer']]],Content::faq())];
            if(in_array($slug,['home','prices'],true)) foreach(Db::all('SELECT * FROM lesson_packages WHERE is_active=1') as $pack) $graph[]=['@type'=>'Service','name'=>$pack['title'],'provider'=>['@id'=>$base.'/#school'],'offers'=>['@type'=>'Offer','price'=>$pack['price'],'priceCurrency'=>'GBP','url'=>$base.'/book']];
        }
        return ['title'=>$title,'description'=>mb_substr(strip_tags($description),0,300),'canonical'=>$canonical,'robots'=>$private||!$exists||env('APP_INDEXING','true')!=='true'?'noindex, nofollow':'index, follow, max-image-preview:large','schema'=>['@context'=>'https://schema.org','@graph'=>$graph],'exists'=>$exists,'private'=>$private,'slug'=>$slug,'page'=>$p,'heading'=>$p['title']??$fallback[0]??$title,'body'=>$p['body']??$fallback[1]??''];
    }
    public static function sitemap(): never {
        header('Content-Type: application/xml; charset=utf-8'); $slugs=array_keys(self::PAGES); foreach(Db::all('SELECT slug FROM cms_pages WHERE is_published=1') as $p) if(!isset(Content::SECTIONS[$p['slug']]) && !isset(PublicCopy::TEXT[$p['slug']])) $slugs[]=$p['slug'];
        echo '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">';
        foreach(array_unique($slugs) as $slug) {if(in_array($slug,['login','signup','portal','admin','change-password'])) continue; echo '<url><loc>'.e(rtrim(env('APP_URL'),'/').($slug==='home'?'/':'/'.$slug)).'</loc>'; $p=Content::page($slug); if($p) echo '<lastmod>'.e(gmdate('c',strtotime($p['updated_at']))).'</lastmod>'; echo '</url>'; } echo '</urlset>'; exit;
    }
    public static function render(string $path,string $nonce): never {
        $meta=self::metadata($path); if(!$meta['exists']) http_response_code(404); if($meta['private']||!$meta['exists']) header('X-Robots-Tag: noindex, nofollow'); header('Content-Type: text/html; charset=utf-8'); header('Cache-Control: no-store');
        $manifestFile=ROOT.'/public/build/.vite/manifest.json'; $manifest=is_file($manifestFile)?json_decode(file_get_contents($manifestFile),true):[]; $entry=$manifest['index.html']??null;
        echo '<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>'.e($meta['title']).'</title><meta name="description" content="'.e($meta['description']).'"><meta name="robots" content="'.e($meta['robots']).'"><link rel="canonical" href="'.e($meta['canonical']).'"><meta property="og:type" content="website"><meta property="og:title" content="'.e($meta['title']).'"><meta property="og:description" content="'.e($meta['description']).'"><meta property="og:url" content="'.e($meta['canonical']).'"><meta name="twitter:card" content="summary"><meta name="csrf-token" content="'.e($_SESSION['csrf']??'').'"><meta name="csp-nonce" content="'.e($nonce).'">';
        echo '<link rel="icon" type="image/svg+xml" href="/build/favicon.svg">';
        foreach($entry['css']??[] as $css) echo '<link rel="stylesheet" href="/build/'.e($css).'">';
        echo '<script id="ld-json" type="application/ld+json" nonce="'.e($nonce).'">'.json_encode($meta['schema'],JSON_HEX_TAG|JSON_HEX_AMP|JSON_HEX_APOS|JSON_HEX_QUOT|JSON_UNESCAPED_SLASHES).'</script></head><body><div id="root">';
        self::body($meta);
        echo '</div><noscript><p class="container">Enable JavaScript for booking forms and the account portal.</p></noscript>';
        if($entry) echo '<script type="module" src="/build/'.e($entry['file']).'" nonce="'.e($nonce).'"></script>';
        echo '</body></html>'; exit;
    }
    private static function cards(array $items): void {echo '<div class="card-grid">';foreach($items as $i) echo '<article class="card"><h3>'.e($i['title']).'</h3><p>'.e($i['text']??'').'</p></article>';echo '</div>';}
    private static function copy(string $slug,int $level=2): void {
        $p=Content::display($slug); if(!$p) return;
        echo '<h'.$level.'>'.e($p['title']).'</h'.$level.'><p>'.nl2br(e($p['body'])).'</p>';
    }
    private static function packages(): void {
        echo '<section class="package-showcase section"><div class="container"><p class="eyebrow">Your next chapter, behind the wheel</p>'; self::copy('home_packages'); echo '<div class="package-pass-grid">';
        $packages=Db::all('SELECT * FROM lesson_packages WHERE is_active=1');
        foreach($packages as $p) {
            echo '<article class="package-pass"><div class="package-pass-top"><span>'.e(ucfirst($p['package_type'])).'</span><span>SELAM / DRIVE</span></div><div class="package-hours"><strong>'.e((string)(float)$p['hours']).'</strong><span>hours<small>of driving tuition</small></span></div><h3>'.e($p['title']).'</h3><p class="package-description">'.e($p['description']??'').'</p><div class="package-pass-bottom"><div><span>Package total</span><strong>GBP '.e(number_format((float)$p['price'],2)).'</strong></div><a class="btn btn-gold" href="/book?package='.(int)$p['id'].'">Choose package</a></div></article>';
        }
        if(!$packages) echo '<p>Contact us to discuss available lesson packages.</p>';
        echo '</div><p class="package-footnote">Hours shown are your total package allowance. We confirm individual lesson times and instructor availability after your request.</p></div></section>';
    }
    private static function body(array $m): void {
        echo '<header class="site-header"><div class="container nav-wrap"><a href="/" class="brand"><span class="brand-badge">S</span><span>Selam Driving School</span></a><nav class="menu">';
        foreach(['Home'=>'/','About'=>'/about','Lessons'=>'/lessons','Prices'=>'/prices','Instructors'=>'/instructors','Reviews'=>'/reviews','Contact'=>'/contact','Portal'=>'/login','Book Lesson'=>'/book'] as $label=>$url) echo '<a href="'.$url.'">'.e(Content::display('copy_site_'.strtolower(str_replace(' ','_',$label)))['title']??$label).'</a>'; echo '</nav></div></header><main>';
        $slug=$m['slug'];
        if($slug==='home') {
            echo '<section class="hero"><div class="container hero-grid"><div><p class="eyebrow">Trusted in Sheffield</p><h1>'.e($m['heading']).'</h1><p>'.e($m['body']).'</p><div class="hero-actions"><a href="/book" class="btn btn-gold">Book Lesson</a></div></div><div class="hero-card hero-card-strong">'; self::copy('home_quick_book',3); echo '<a href="/book" class="btn btn-black">Send Booking Request</a></div></div></section>';
            $r=Content::repeatables(); $defaults=[['title'=>'Automatic Lessons','text'=>'Build confidence faster with focused road awareness training.'],['title'=>'Manual Lessons','text'=>'Master clutch control, hill starts, and real Sheffield routes.'],['title'=>'Intensive Courses','text'=>'Condensed plans for learners targeting near-term test dates.']];
            foreach(['home_about'=>['Why Choose Selam','Supportive instruction and clear progress at every stage.'],'home_services'=>['Training Services','Choose the package that matches your confidence level and test timeline.'],'home_process'=>['How Booking Works','Choose a package, share your start date, and we contact you.'],'home_cta'=>['Start Your Driving Journey in Sheffield','Book your first lesson now or call us for quick guidance on the right course.']] as $key=>$fallback) { $p=Content::display($key); echo '<section class="section container"><h2>'.e($p['title']??$fallback[0]).'</h2><p>'.e($p['body']??$fallback[1]).'</p>'; if($key==='home_services') self::cards($r['services']); if($key==='home_process') self::cards($r['steps']); echo '</section>'; if($key==='home_process') { self::packages(); echo '<section class="section container">'; self::copy('home_instructors'); echo '</section>'; } }
            echo '<section class="section container">'; self::copy('booking_faq'); foreach(Content::faq() as $f) echo '<details><summary>'.e($f['question']).'</summary><p>'.e($f['answer']).'</p></details>';echo '</section>';
        } else {
            echo '<section class="section container"><h1>'.e($m['heading']).'</h1><p>'.nl2br(e($m['body'])).'</p>';
            if($slug==='prices') {echo '<div class="card-grid">';foreach(Db::all('SELECT * FROM lesson_packages WHERE is_active=1') as $p) echo '<article class="card"><h3>'.e($p['title']).'</h3><p>'.e(ucfirst($p['package_type'])).' - '.e($p['hours']).' hours</p><strong>GBP '.e($p['price']).'</strong></article>';echo '</div>';}
            if($slug==='reviews') {foreach(Content::reviews() as $r) echo '<article class="card"><p>'.e($r['rating']).'/5</p><blockquote>'.e($r['testimonial']).'</blockquote><p>'.e($r['author']).'</p></article>';}
            if($slug==='instructors') {foreach(Api::users('instructor') as $i) echo '<article class="card"><h2>'.e($i['full_name']).'</h2><p>Type: '.e($i['instructor_type']).'</p><p>'.e($i['email']).'</p><p>'.e($i['phone']).'</p></article>';}
            if($slug==='contact') { $c=Api::publicSettings('contact'); foreach(['phone','email','address','whatsapp'] as $k) echo '<article class="card"><h2>'.ucfirst($k).'</h2><p>'.e($c[$k]).'</p></article>'; }
            if($slug==='lessons') { echo '<div class="card-grid">'; foreach(['lessons_manual','lessons_automatic','lessons_intensive'] as $key) { echo '<article class="card">'; self::copy($key,3); echo '</article>'; } echo '</div>'; }
            if($slug==='book') { self::copy('book_process',3); self::copy('book_request',3); }
            if($slug==='reviews') self::copy('reviews_submit',3);
            if(!$m['exists']) echo '<a href="/">Return home</a>'; echo '</section>';
        }
        echo '</main><footer class="site-footer"><div class="container">'; self::copy('site_footer',4); echo '<a href="/contact">Contact</a></div></footer>';
    }
}
