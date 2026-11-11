# Selam Driving School - PHP Version

This separate application replaces the Python API with PHP and PDO. It preserves the existing React/TypeScript browser interface and styling. Public HTML, metadata, structured data, robots.txt and the sitemap are served by PHP. Python and Node.js are not needed to run the deployed website; Node.js is only used to rebuild browser assets, and Python is only used by the automated tests.

The original `../selamapp` source is not modified. This app has its own database, uploads, environment and private configuration.

## Start Locally

Requirements: PHP 8.2 or newer with PDO MySQL, OpenSSL, mbstring, fileinfo and sessions, and a running MySQL/MariaDB server. Use a currently patched PHP release for deployment.

From this folder:

```powershell
php bin/setup.php
php bin/create-admin.php
php -S 127.0.0.1:8088 -t public public/router.php
```

Open `http://127.0.0.1:8088`. Sign in at `/login` with the administrator you created. There are no shipped default passwords. The setup command creates a random application key and initializes tables in the configured MySQL database. This working copy uses `127.0.0.1:3306`, database `selamdrivingschoolphp`, username `root`, and a blank password. The database has already been created. Normal application execution requires MySQL; there is no SQLite fallback. Isolated automated tests may still use temporary SQLite fixtures.

Dependencies and browser assets have been installed/built in this working copy. For a clean checkout:

```powershell
composer install --no-dev --prefer-dist
cd frontend
npm ci
npm run build
cd ..
```

If Composer is not installed, this working copy also includes `bin/composer.phar`: run `php bin/composer.phar install --no-dev --prefer-dist`.

## Existing Content and Data

`config/public-content.json` contains only the public CMS/package/settings snapshot available in the local source database. That snapshot contains one CMS record and no packages. No existing users, credentials or live database were copied into the new app.

`php bin/seed-public.php` loads that snapshot into empty public-content tables. It has already been run in this working copy. Create lesson packages and instructors in the admin portal, or import a full database copy using [docs/MIGRATION.md](docs/MIGRATION.md).

## Email

Configure SMTP in the admin portal or in `.env`. Select STARTTLS for port 587 or implicit TLS for port 465 as required by your provider. Certificate verification remains enabled. Settings saved by the portal take precedence over environment defaults.

Booking confirmations, calendar attachments, instructor assignments, payment updates, invitations and password resets enter a persistent encrypted email queue. Run the worker:

```powershell
php bin/mail-worker.php
```

Schedule that command every minute with Task Scheduler or cron. Production delivery requires both valid SMTP settings and a running scheduled worker. The Notifications screen shows queued, retrying, failed and sent states. Failed email can be retried by an admin. Five automatic attempts are made with backoff. As with other SMTP queues, a crash after SMTP acceptance but before recording success can result in a duplicate email.

SMS and WhatsApp retain the original application's queue and configuration functionality. The original did not contain an SMS/WhatsApp delivery adapter; neither channel is advertised as delivered by this version.

For isolated development, `MAIL_TRANSPORT=log` captures messages in private storage and marks them `captured`, not `sent`. Log transport is disabled in production. Real SMTP inbox delivery has not been tested with your provider.

## Private Configuration

- `.env`: application URL/key, database defaults, SMTP defaults, deployment settings.
- `config/secrets.json`: AES-256-GCM-encrypted SMTP, SMS and database settings saved by an administrator.
- `storage/`: sessions, rate limits, uploads and logs, outside the public web root. Any old SQLite file is unused; application data is in MySQL.
- `public/`: the only directory the web server should expose.

Keep `.env` and `config/secrets.json` private and backed up together. Losing `APP_KEY` makes encrypted configuration and pending emails unreadable. Never copy the old project's `.env` into this app or point this app at the original database: the PHP schema and authentication state are separate.

## Features

The public pages, booking form, optional signup, two-stage login, password reset, student/instructor/admin portals, lesson packages, scheduling, assignment, attendance/progress, payment tracking, invitations, notifications, user management, CMS/repeatables, review moderation, social/video/contact settings, uploads, audit logs, admin preferences and database administration are implemented.

Payment tracking preserves the original rule that requests and waiting/paid states require a completed lesson. Availability retains the 08:00-18:00 hourly window. This is payment status management, not a payment gateway.

Security changes are intentional: assignment links require a confirmation POST; instructor acceptance requires login; instructor data is scoped to their lessons; drafts are private; username lookup does not disclose account existence; secrets are masked; invitations/reset/assignment tokens are single-use; session credentials stay in HttpOnly cookies. See [docs/FEATURES.md](docs/FEATURES.md).

## Package Types and Hours

Admin packages have a Manual/Automatic type and total teaching hours (fractional hours are supported to two decimal places). The booking form shows only active packages matching the selected lesson type and clears the package when that type changes. New bookings validate the package/type pairing on the server. Price pages also show type and hours. Package hours are the total allowance, not the duration of one continuous lesson; the existing initial one-hour booking request is unchanged.

Run `php bin/setup.php` to upgrade existing MySQL databases. Existing numeric lesson counts are carried into hours; titles containing "automatic" become Automatic, while other packages default to Manual. **Review these migrated values in Admin > Packages**, because the old counts did not record actual teaching hours or a reliable transmission type. Existing bookings are not rewritten. The legacy `lesson_count` column/API input remains for compatibility, but the PHP UI uses `hours` exclusively.

Package migration, validation and booking filtering are tested with `$env:PACKAGE_BROWSER_TEST='1'; python tests/events_mysql.py` against a disposable MySQL database and synthetic accounts.

## Instructor Timeline and Events

Open **Portal > Bookings & Events Timeline**. Instructors see only their own assigned bookings and events; administrators can select an instructor. The responsive calendar has date columns, hourly rows and half-hour grid lines, with day/3-day/Monday-to-Sunday week views. All seven dates fit the screen on mobile; tap a date to expand it to day view. The date header stays visible while scrolling the full 24-hour day. Overlapping entries use side-by-side lanes, overnight entries split across dates, and Now jumps to the current time. Booking payment labels distinguish Paid, Unpaid (payment requested), and Not requested without changing payment records. Select a card for full details below the calendar. Events support meetings, driving tests, training, personal appointments and other activities, with create/edit/cancel actions. Events do not block booking availability or change existing booking workflows.

Creation, edits and cancellations generate private in-page notifications. Optional email notifications go to the event's instructor through the existing encrypted outbox. Dates are stored in UTC and displayed in the browser's timezone; notification message timestamps are explicitly UTC. The page is excluded from search indexing.

Run `php bin/setup.php` when deploying to add the two event tables without replacing existing data. Schedule `php bin/mail-worker.php` every minute: it creates due event reminders and processes queued mail. Reminders are issued once per event revision and only before the event starts; cancelled events are excluded. SMTP must be configured for real email delivery. The notification panel refreshes every 30 seconds; these are in-page alerts, not push notifications when the browser is closed.

Test against a disposable MySQL database on the local root/blank-password server with `python tests/events_mysql.py`. To also check the desktop/mobile UI in headless Edge, set `$env:EVENT_BROWSER_TEST='1'` before running that command. These tests capture emails locally and do not modify `selamdrivingschoolphp`.

## Instructor Business Cards

Open **Portal > Instructor Business Cards** (`/instructor/business-card`). All active instructors get a two-sided template based on the supplied red-and-gold reference cards: road artwork and a booking QR code on the front; school branding and instructor contact details on the back. Instructors can save only their own card details; administrators can choose any active instructor. Saving a card does not change the instructor's account details. Card settings are stored in MySQL, with role/ownership checks, CSRF protection and audit logging.

Each side downloads separately as a **2550 x 1650 PNG** or **85 x 55 mm vector SVG**. These are trim-size RGB exports, not prepress CMYK/bleed files. Confirm your printer's requirements. The logo is a vector recreation, not an exact copy of the original artwork; confirm the branding before printing. SVG text uses local Arial/Georgia fonts rather than outlined type. Ensure the QR link points to the live public website, not the development server, and scan it before ordering cards. Qualification text defaults to "Driving instructor" rather than asserting ADI status for every instructor.

Run `php bin/setup.php` on deployment to add `instructor_business_cards`. Run `$env:CARD_BROWSER_TEST='1'; python tests/events_mysql.py` for isolated MySQL access-control/persistence checks and desktop/mobile download tests. Test previews in `docs/business-card-*-sample.png` contain synthetic instructor data and are not production cards.

## SEO and Answer Engines

PHP renders public text and metadata before JavaScript runs. The app includes canonical URLs, Open Graph metadata, sitemap.xml, robots.txt, genuine 404 responses, private-page noindex directives, business/website/page/breadcrumb/service JSON-LD, and visible booking FAQs matching FAQ structured data. CMS changes feed both rendered pages and metadata.

Set `APP_URL` to the real HTTPS origin before publishing. These features help make the site accessible to search and answer engines; indexing, rankings, rich results and AI citations are not guaranteed. See [Google's guidance](https://developers.google.com/search/docs/appearance/ai-features) and [deployment instructions](docs/DEPLOYMENT.md).

## Verification

```powershell
python tests/integration.py
python tests/import_test.py
python tests/mysql_integration.py
cd frontend
npm run build
node browser-test.mjs
npm audit
cd ..
php bin/composer.phar audit
```

Tests use temporary databases and synthetic users, never send real email, and do not alter the original application. The MySQL test requires MariaDB's Windows binaries (`MYSQL_TEST_BIN`, default `C:/xampp/mysql/bin`); it starts a separate temporary instance on a random loopback port. Browser tests use headless Edge and save desktop/mobile screenshots under `docs/`.

## Booking Safeguards and Audit

Only admins may directly assign instructors or switch a booking to a different package. Signed, single-use assignment links sent to admins retain their existing workflow. Public booking requests must start in the future within two years; lesson durations are 15 minutes to 8 hours. Staff may record historical lessons. Time edits enforce the same duration limit; status-only updates remain possible for legacy bookings.

Run `php bin/setup.php` before deploying the updated code to add nullable `package_price`, `package_hours` and `package_currency` columns. New bookings copy their agreed terms from the server-side package. Catalog edits and resubmitting the same package ID do not change those terms. An explicit admin switch to another package records its current terms and an audit change. Legacy bookings remain NULL (shown as not recorded): today's price must not be presented as a historical agreement.

Portal > Logs shows booking creation, edits, assignments and payment changes with actor, time and before/after values. Pickup and note changes are recorded without copying private text. Audit rows commit in the same transaction as the booking change; rejected/rolled-back changes do not create successful-change entries. These are application audit records, not tamper-proof external logs. Admins see all entries; instructors see only their own actions.

`python tests/events_mysql.py` includes isolated security tests and real concurrent MySQL connections verifying that booking edits and payment updates recheck ownership after acquiring the lock.

## Password Administration and CMS

Admin > User Management lists students, instructors and administrators, with search, role/status filters and pagination. Confirm your own administrator password to queue a one-hour, single-use reset email. Reissuing from this screen invalidates older unused reset tokens. Completing the reset revokes existing sessions. Requests and completions are audited without passwords/tokens. The screen reports queued, not delivered: SMTP and the mail worker are still required. Admin creation and all admin-account edits/status changes require confirmation of the acting administrator password. You cannot freeze/delete yourself or leave no active administrator. Roles and usernames are intentionally not editable. Deletion is reversible and retains booking history. Email changes and account status changes revoke sessions and pending reset tokens. All mutations are transactional and audited.

Admin > CMS > Pages & Sections lists built-in page and section defaults as well as saved custom pages. Selecting an entry loads its existing title, body, metadata and publication status. Editable copy now includes all public page introductions, homepage sections, package showcase introduction, lesson cards, booking explanations, FAQs, login/signup introductions and footer. Public FAQ copy and structured data use the same published source. Section records are excluded from the sitemap. Built-in drafts use default public copy; custom drafts are unavailable publicly. This is a text-content editor, not an arbitrary HTML/layout or application-form editor. Package data, instructor profiles, repeatable cards, contact/social/media settings and reviews remain in their dedicated managers. New custom pages do not automatically add navigation links.

Test with `$env:ADMIN_CMS_BROWSER_TEST='1'; python tests/events_mysql.py`. Accounts, mail captures and content edits are isolated from your real database.

The User Management tab replaces Password Resets. Add/Edit, Freeze/Unfreeze, Delete/Restore and Reset password share a confirmation editor. New student/instructor accounts receive a generated temporary password, shown once to the creating administrator, plus a reset email. Administrator accounts remain email-setup only. Existing Instructor/Student tabs remain available for their specialised workflows.

## Temporary Passwords

Creating students/instructors through User Management or the existing student/instructor tabs generates a random 24-character password. The creation response shows the login username and temporary password once; only its hash is stored. Copy/share the details securely and dismiss the notice (it also clears after ten minutes or page reload). It is not included in user lists, audit records or email. The password expires after 24 hours. First login requires changing it to a different password of at least 12 characters before accessing account APIs. Changing it invalidates other sessions and pending reset tokens. Expired/lost passwords can be replaced through the existing reset-email workflow, which still needs SMTP. Admin accounts do not receive temporary passwords.

Run `php bin/setup.php` before deployment to add the temporary-password flags without changing existing accounts. The MySQL harness tests expiry, access restrictions, first-use change, secret non-disclosure and session revocation; the optional browser suite checks the one-time display and first-login flow.
#   S e l a m - D r i v i n g - s c h o o l  
 