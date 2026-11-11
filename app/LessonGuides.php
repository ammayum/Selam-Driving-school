<?php
declare(strict_types=1);

/**
 * Helpful, location-specific service information rendered in PHP for search crawlers
 * and returned in the existing /api/seo response for the React client.
 * Avoid unverified claims about prices, instructor credentials, or pass rates.
 */
final class LessonGuides {
    public const PAGES = [
        'manual-driving-lessons-sheffield' => [
            'heading' => 'Manual Driving Lessons in Sheffield',
            'intro' => 'Learn clutch control, gear changes and safe decision-making with manual driving lessons in Sheffield. Selam Driving School offers a lesson request process where you choose a package and preferred date, and the school confirms the instructor and schedule with you.',
            'service_type' => 'Manual driving lessons',
            'sections' => [
                ['title' => 'Clutch control, gears and moving off', 'body' => 'Manual driving lessons include learning how to coordinate the clutch, accelerator and gear changes. These skills matter for smooth moving off, slowing down and responding safely to traffic conditions.'],
                ['title' => 'Junctions, roundabouts and observation', 'body' => 'A good lesson combines vehicle control with observation and judgement. You may practise approaches to junctions, appropriate speed, mirror checks, lane positioning and giving way on suitable Sheffield roads.'],
                ['title' => 'Hill starts and stop–start driving', 'body' => 'Sheffield has varied road gradients. Manual learners can discuss hill starts, parking and slow traffic with their instructor as their experience develops.'],
                ['title' => 'Choose lessons that fit your progress', 'body' => 'Everyone learns at a different pace. Check current lesson packages and prices, then request a start date and pickup point. An instructor and lesson arrangements are confirmed after your request.'],
            ],
            'faqs' => [
                ['question' => 'Can a complete beginner book manual driving lessons in Sheffield?', 'answer' => 'Yes. The booking process accepts requests from learners starting their driving journey. Tell the school about your experience so it can discuss an appropriate lesson plan.'],
                ['question' => 'Do I need a provisional driving licence before my first lesson?', 'answer' => 'You generally need a valid UK provisional driving licence to learn to drive on public roads. Bring it to your lesson and check any individual requirements with the school.'],
                ['question' => 'How many manual driving lessons will I need?', 'answer' => 'There is no fixed number of lessons that guarantees test readiness. Your instructor can review your progress, experience and areas requiring more practice.'],
                ['question' => 'Where can I see manual driving lesson prices?', 'answer' => 'Use the Prices page to compare currently offered manual lesson packages and hours. Submit a booking request to ask about availability.'],
            ],
            'booking_type' => 'manual',
        ],
        'automatic-driving-lessons-sheffield' => [
            'heading' => 'Automatic Driving Lessons in Sheffield',
            'intro' => 'Automatic driving lessons in Sheffield allow you to focus on observation, steering, road positioning and safe decisions without operating a clutch pedal. Selam Driving School lists automatic lesson packages and confirms instructor availability after you make a booking request.',
            'service_type' => 'Automatic driving lessons',
            'sections' => [
                ['title' => 'Learn in an automatic vehicle', 'body' => 'An automatic car manages gear changes for you. Lessons still involve controlling speed, using mirrors, recognising hazards, planning ahead and following road signs.'],
                ['title' => 'Build confidence on Sheffield roads', 'body' => 'Ask your instructor about suitable practice for junctions, roundabouts, parking and different road conditions in Sheffield. The route and pace should reflect your current driving ability.'],
                ['title' => 'Understand the automatic licence restriction', 'body' => 'If you pass your practical driving test in an automatic car, your licence normally allows you to drive automatic vehicles only. Passing in a manual car can provide wider entitlement. Check the official DVSA/GOV.UK guidance for your circumstances.'],
                ['title' => 'Request your preferred lesson package', 'body' => 'Compare the currently available automatic packages on our Prices page. Select a package, preferred start date and pickup location in the booking form; the school will contact you to confirm the arrangements.'],
            ],
            'faqs' => [
                ['question' => 'Does Selam Driving School offer automatic driving lessons in Sheffield?', 'answer' => 'Automatic lesson options are listed on the site. Check the current packages and send a booking request; the school will confirm instructor availability and lesson details.'],
                ['question' => 'Is an automatic driving test different from a manual driving test?', 'answer' => 'The practical test assesses safe driving skills in either vehicle type, but passing in an automatic car normally results in a licence restricted to automatic vehicles.'],
                ['question' => 'Will I pass faster with automatic lessons?', 'answer' => 'There is no guaranteed shorter route to passing. Learning time depends on your experience, practice, confidence and ability to drive safely and independently.'],
                ['question' => 'Can I change from manual lessons to automatic lessons?', 'answer' => 'You can enquire about switching lesson types. The school will need to confirm the appropriate instructor, vehicle and package availability.'],
            ],
            'booking_type' => 'automatic',
        ],
    ];

    public static function page(string $slug): ?array {
        return self::PAGES[$slug] ?? null;
    }

    public static function render(array $guide, string $heading, string $intro): void {
        $type=$guide['booking_type'];
        echo '<section class="section container lesson-guide">';
        echo '<nav aria-label="Breadcrumb"><a href="/">Home</a> / <a href="/lessons">Driving Lessons</a></nav>';
        echo '<h1>'.e($heading).'</h1><p class="guide-intro">'.e($intro).'</p>';
        echo '<div class="hero-actions"><a class="btn btn-gold" href="/book?lesson_type='.e($type).'">Request '.e(ucfirst($type)).' Lessons</a><a class="btn btn-outline" href="/prices">View Current Prices</a></div>';
        echo '<div class="card-grid">';
        foreach($guide['sections'] as $section) echo '<article class="card"><h2>'.e($section['title']).'</h2><p>'.e($section['body']).'</p></article>';
        echo '</div><h2>Frequently asked questions</h2>';
        foreach($guide['faqs'] as $faq) echo '<details><summary>'.e($faq['question']).'</summary><p>'.e($faq['answer']).'</p></details>';
        echo '<p>Also explore <a href="/lessons">all driving lessons</a>, <a href="/instructors">our instructors</a> and <a href="/contact">contact options</a>.</p>';
        echo '</section>';
    }
}
