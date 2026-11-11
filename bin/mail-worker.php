<?php
declare(strict_types=1);
if(PHP_SAPI!=='cli') exit;
require dirname(__DIR__).'/config/bootstrap.php'; require_once ROOT.'/app/Http.php';
$reminders = Events::reminders();
echo json_encode(Mailer::work(50) + ['event_reminders'=>$reminders],JSON_THROW_ON_ERROR).PHP_EOL;
