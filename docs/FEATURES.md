# Feature Mapping

| Existing feature | PHP implementation |
| --- | --- |
| Home, about, lessons, prices, instructors, reviews, contact, blog | Original browser pages plus `Seo.php` public rendering |
| Signup, username/password login, refresh/logout, reset | `Auth.php`, secure server sessions |
| Guest/account booking, duplicate prevention, availability | `Bookings.php`, transactional scheduling |
| Admin/instructor assignments and email links | `Bookings.php`, single-use tokens and confirmation POST |
| Status, rescheduling, attendance, progress | `Bookings.php`, owned-booking authorization |
| Payment request/status | `Bookings.php`, completed-lesson precondition retained |
| Student progress and staff dashboards/statistics | `Api.php`, data scoped by role |
| Packages | `Api.php`, create/update/list and active status |
| User creation/editing/freezing/deletion | `Api.php`, soft deletion and immediate session revocation |
| Admin email preferences | `Api.php`, assignment and booking-alert preferences |
| Invitations and invitation signup/accept | `Api.php` and `Auth.php`, email-bound, expiring codes |
| Email and calendar attachments | `Mailer.php`, PHPMailer, encrypted durable outbox and retries |
| SMS/WhatsApp queue and settings | `Api.php` and `Config.php`; same queue-only delivery scope as original |
| Notifications/activity logs | `Api.php`, scoped reads and email retry action |
| CMS, SEO editing, home repeatables | `Content.php`, published-only public responses |
| Review submission/filtering/moderation | `Content.php`, duplicate-safe moderation and removal on rejection |
| Photos | `Api.php`, admin-only MIME/dimension/size validation and private image storage |
| Contact/social/video settings | `Config.php` and `Api.php`, safe URL validation |
| SMTP/SMS/database secrets | Separate encrypted private file, masked responses |
| Database connection test/migrate/apply | `DatabaseAdmin.php`, empty-target and allowed-host safeguards |

Security-related compatibility changes:

- API paths are served under `/api` on the PHP origin. The copied browser client already uses this prefix.
- `GET /bookings/{id}/assign-by-token` becomes a confirmation-page POST with a CSRF token. Opening a mail link alone no longer changes a booking.
- Instructor acceptance uses the existing POST endpoint with an authenticated matching instructor. The unauthenticated GET mutation is removed.
- `access_token`/`refresh_token` response strings are compatibility markers (`cookie`), not credentials. The HttpOnly session cookie authenticates requests. Existing browser tokens and sessions are not imported.
- Username checking advances the login form without exposing names or account existence.
- New/reset passwords require at least 12 characters. Imported legacy passwords still work.
- Instructor lists, progress, notifications, invitations and logs are limited to authorized data. Admin functions remain admin-only.
- Invitation list responses do not reveal reusable invitation secrets; the recipient receives the code by email and the creating response includes it once.
- Sensitive values are masked in admin responses. `********` preserves a previously stored secret on save.
- Database migration refuses a populated destination instead of deleting its contents.
- Invalid/unknown public paths return HTTP 404 rather than redirecting everything to the homepage.

`original-routes.json` lists the source API routes used during the port. `original-hashes.json` records SHA-256 hashes of the original source at the start of the work.
