<?php
declare(strict_types=1);

/** Review photos remain private until the linked testimonial is approved. */
final class ReviewMedia {
    private const MAX_BYTES = 5242880;
    private const MAX_PIXELS = 16000000;
    private const OUTPUT_DIMENSION = 1600;

    public static function store(array $file): string {
        if (($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK
            || !is_string($file['tmp_name'] ?? null)
            || !is_uploaded_file($file['tmp_name'])
            || (int)($file['size'] ?? 0) <= 0
            || (int)$file['size'] > self::MAX_BYTES) {
            Http::fail(422, 'Photo must be under 5 MB');
        }
        $mime = (new finfo(FILEINFO_MIME_TYPE))->file($file['tmp_name']);
        $loaders = [
            'image/jpeg' => 'imagecreatefromjpeg',
            'image/png' => 'imagecreatefrompng',
            'image/webp' => 'imagecreatefromwebp',
        ];
        if (!isset($loaders[$mime])) Http::fail(422, 'Upload JPEG, PNG or WebP');
        $dimensions = @getimagesize($file['tmp_name']);
        if (!$dimensions || $dimensions[0] < 1 || $dimensions[1] < 1
            || $dimensions[0] > 8000 || $dimensions[1] > 8000
            || $dimensions[0] * $dimensions[1] > self::MAX_PIXELS) {
            Http::fail(422, 'Invalid photo dimensions');
        }
        $loader = $loaders[$mime];
        if (!function_exists('imagecreatetruecolor') || !function_exists($loader) || !function_exists('imagejpeg')) {
            Http::fail(503, 'Photo uploads temporarily unavailable');
        }
        $source = @$loader($file['tmp_name']);
        if (!$source) Http::fail(422, 'Invalid photo');
        $ratio = min(1, self::OUTPUT_DIMENSION / max($dimensions[0], $dimensions[1]));
        $width = max(1, (int)round($dimensions[0] * $ratio));
        $height = max(1, (int)round($dimensions[1] * $ratio));
        $output = imagecreatetruecolor($width, $height);
        if (!$output) { imagedestroy($source); throw new RuntimeException('Image processing failed'); }
        $white = imagecolorallocate($output, 255, 255, 255);
        imagefilledrectangle($output, 0, 0, $width, $height, $white);
        imagecopyresampled($output, $source, 0, 0, 0, 0, $width, $height, $dimensions[0], $dimensions[1]);
        $folder = DATA_DIR . '/review_photos';
        if (!is_dir($folder) && !mkdir($folder, 0700, true) && !is_dir($folder)) {
            imagedestroy($output); imagedestroy($source);
            throw new RuntimeException('Photo storage unavailable');
        }
        $name = bin2hex(random_bytes(24)) . '.jpg';
        $filePath = $folder . '/' . $name;
        $saved = imagejpeg($output, $filePath, 84);
        imagedestroy($output);
        imagedestroy($source);
        if (!$saved) throw new RuntimeException('Photo saving failed');
        @chmod($filePath, 0600);
        // Re-encoding removes original metadata, including potentially sensitive EXIF GPS.
        return $name;
    }

    public static function remove(string $name): void {
        if (!preg_match('/^[a-f0-9]{48}\.jpg$/', $name)) return;
        @unlink(DATA_DIR . '/review_photos/' . $name);
    }

    public static function url(int $id): string { return '/media/reviews/' . $id; }

    public static function serve(int $id): never {
        $record = Db::one('SELECT status,photo_filename FROM review_testimonial_submissions WHERE id=?', [$id]);
        if (!$record || empty($record['photo_filename'])) Http::fail(404, 'Photo not found');
        $isAdmin = (Auth::user(false)['role'] ?? null) === 'admin';
        if ($record['status'] !== 'approved' && !$isAdmin) Http::fail(404, 'Photo not found');
        $name = $record['photo_filename'];
        if (!preg_match('/^[a-f0-9]{48}\.jpg$/', $name)) Http::fail(404, 'Photo not found');
        $path = DATA_DIR . '/review_photos/' . $name;
        if (!is_file($path)) Http::fail(404, 'Photo not found');
        header('Content-Type: image/jpeg');
        header('Content-Disposition: inline');
        header('X-Content-Type-Options: nosniff');
        header('Cache-Control: ' . ($record['status'] === 'approved' ? 'public, max-age=3600' : 'private, no-store'));
        readfile($path);
        exit;
    }
}
