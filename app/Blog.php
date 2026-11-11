<?php
declare(strict_types=1);

/** Public articles and administrator-only blog publishing. Content is plain text, never HTML. */
final class Blog {
    public static function published(string $slug): ?array {
        if (!preg_match('/^[a-z0-9-]{1,120}$/', $slug)) return null;
        return Db::one('SELECT * FROM blog_posts WHERE slug=? AND is_published=1', [$slug]);
    }

    public static function publishedList(): array {
        return Db::all('SELECT * FROM blog_posts WHERE is_published=1 ORDER BY published_at DESC,id DESC LIMIT 100');
    }

    public static function dispatch(string $method, string $path, array $body): mixed {
        if ($path === '/posts' && $method === 'GET') {
            if (($_GET['admin'] ?? '') === '1') {
                Auth::requireRoles(['admin']);
                return Db::all('SELECT * FROM blog_posts ORDER BY updated_at DESC,id DESC LIMIT 200');
            }
            return self::publishedList();
        }
        if ($method === 'GET' && preg_match('~^/posts/([a-z0-9-]{1,120})$~', $path, $m)) {
            $post = self::published($m[1]);
            if (!$post) Http::fail(404, 'Article not found');
            return $post;
        }
        if ($method === 'POST' && $path === '/posts') {
            Auth::requireRoles(['admin']);
            $data = self::validated($body);
            $data['created_at'] = now();
            $data['updated_at'] = now();
            $data['published_at'] = $data['is_published'] ? now() : null;
            $id = Db::insert('blog_posts', $data);
            Auth::audit('blog.create', 'blog_post', $id);
            return Api::row('blog_posts', $id);
        }
        if ($method === 'PUT' && preg_match('~^/posts/([1-9][0-9]*)$~', $path, $m)) {
            Auth::requireRoles(['admin']);
            $id = (int)$m[1];
            $previous = Api::row('blog_posts', $id);
            $data = self::validated($body);
            $data['updated_at'] = now();
            $data['published_at'] = $data['is_published']
                ? ($previous['published_at'] ?: now()) : null;
            Db::update('blog_posts', $id, $data);
            Auth::audit('blog.update', 'blog_post', $id);
            return Api::row('blog_posts', $id);
        }
        Http::fail(404, 'Article endpoint not found');
    }

    private static function validated(array $body): array {
        $slug = Http::text($body, 'slug', 120);
        if (!preg_match('/^[a-z0-9]+(?:-[a-z0-9]+)*$/', $slug)) {
            Http::fail(422, 'Slug must contain lowercase letters, numbers and hyphens');
        }
        $image = Http::text($body, 'cover_image_url', 100, false);
        if ($image !== '' && !preg_match('~^/media/[a-f0-9]{48}\.(?:jpg|png|webp)$~', $image)) {
            Http::fail(422, 'Choose an uploaded image');
        }
        $alt = Http::text($body, 'image_alt', 200, false);
        if ($image !== '' && $alt === '') Http::fail(422, 'Image description is required');
        if (!is_bool($body['is_published'] ?? null)) Http::fail(422, 'Invalid publication state');
        return [
            'slug' => $slug,
            'title' => Http::text($body, 'title', 200),
            'excerpt' => Http::text($body, 'excerpt', 500),
            'body' => Http::text($body, 'body', 20000),
            'cover_image_url' => $image ?: null,
            'image_alt' => $alt ?: null,
            'is_published' => (int)$body['is_published'],
        ];
    }
}
