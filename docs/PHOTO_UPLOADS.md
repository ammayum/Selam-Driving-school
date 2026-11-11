# Review and blog photo uploads

This feature is included in the PHP/MySQL + React/Vite application. It does **not**
change booking, payment, authentication or student records.

## Review photos (public)

Learners may submit one optional JPEG, PNG or WebP image (up to 5 MB) with a
written review. An explicit photo-publication consent checkbox is required
when a photo is attached. The server validates the real MIME type and image
dimensions, then uses PHP GD to re-encode the image as JPEG at up to 1600 px.
This drops source EXIF metadata, including possible GPS tags.

Photos are saved **outside the public document root**, under
\`APP_DATA_DIR/review_photos/\`. Photos and review text are not public until an
administrator approves the review in **Admin > CMS > Reviews**. Pending photos
are accessible only to admins through a guarded image route. Rejected photos
are deleted from private photo storage. The existing JSON review submission
API still works for text-only reviews.

Administrators may also attach a photo to a manually managed testimonial from
the same Reviews section; this uses the existing admin-only media uploader.

## Blog photos (admin)

Navigate to **Admin > CMS > Blog**, then use the **Blog Articles & Photos**
editor to create a post, add its text, upload a featured image and supply
meaningful image-alt text. Articles start as unpublished drafts. Clicking
**Publish article publicly** exposes an article at \`/blog/<slug>\`. Published
posts appear on \`/blog\`, in the XML sitemap, and with \`BlogPosting\`
structured data. Unpublished drafts are excluded.

Featured images use the existing admin-only upload mechanism. They are stored
in \`APP_DATA_DIR/uploads/\`. The path to a selected image is validated on
save so arbitrary remote URLs or script files cannot be linked as blog images.

## Deployment checklist

1. Back up the database and both upload directories before deploying.
2. Confirm PHP has GD (JPEG/PNG/WebP), fileinfo, PDO MySQL, mbstring and OpenSSL.
3. Allow uploads of at least 5 MB in PHP: \`upload_max_filesize=6M\` and
   \`post_max_size=7M\` (or higher, with suitable web-server body limits).
4. Run the additive schema migration **before switching application code**:
   \`php bin/setup.php\` (from the app root using the production \`.env\`).
   This adds \`blog_posts\` and a nullable review-photo column.
5. Build the frontend: \`cd frontend && npm ci && npm run build\` and deploy
   the resulting \`public/build/\` assets along with the PHP changes.
6. Ensure the PHP process may write to \`APP_DATA_DIR/uploads/\` and
   \`APP_DATA_DIR/review_photos/\` and that **APP_DATA_DIR is outside the
   publicly served \`public/\` directory**.
7. On staging, check a learner photo submission is private while pending,
   visible after approval, and unavailable after rejection. Test blog drafts,
   image uploads, publication, \`/sitemap.xml\`, and a normal booking request.
8. Recheck IONOS storage quota, image backups, the privacy notice and the
   retention policy for rejected/approved reviews.

### Commands

\`\`\`bash
php -l app/ReviewMedia.php
php -l app/Blog.php
php -l app/Content.php
php -l app/Schema.php
php -l app/Seo.php
python3 tests/review_blog_media.py
python3 tests/integration.py
cd frontend && npm ci && npm run build
\`\`\`

No new public API allows arbitrary standalone uploads. Blog image uploads
remain admin-only; review uploads are rate-limited and tied to a pending
testimonial with mandatory moderation.
