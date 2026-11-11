<?php
declare(strict_types=1);
if(PHP_SAPI!=='cli') exit;
require dirname(__DIR__).'/config/bootstrap.php';
$data=json_decode(file_get_contents(ROOT.'/config/public-content.json'),true,32,JSON_THROW_ON_ERROR);
Db::transaction(function()use($data){Db::lock();foreach($data as $table=>$rows) {
    if(!in_array($table,['cms_pages','lesson_packages','system_configs'])) continue;
    if(Db::one('SELECT id FROM `'.$table.'` LIMIT 1')) continue;
    foreach($rows as $row) {unset($row['id']);Db::insert($table,$row);}
}});
echo "Original public content and package snapshot seeded into empty tables. No accounts or secrets copied.\n";
