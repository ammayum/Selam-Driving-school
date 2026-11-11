# Verification Results

Verified locally on 2026-09-22 using PHP 8.2.12, Node.js 24.11.0 and headless Microsoft Edge.

- PHP syntax validation passed for application, configuration, entry points and CLI scripts.
- Frontend TypeScript checking and production build passed.
- 46 HTTP integration checks passed in an isolated SQLite database. They cover authorization, CSRF, legacy passwords, booking conflicts/idempotency, the original payment precondition, progress, notification scope, SMTP failure retries, calendar attachments, token replay, reviews, private settings, uploads, SEO and session invalidation.
- Browser verification passed for desktop home, admin login, package creation, SMTP settings and mobile guest booking. No JavaScript exceptions or horizontal overflow occurred in those flows. Screenshots: `desktop.png`, `admin-settings.png`, `mobile-booking.png`.
- Legacy import verification passed for old schemas, normalized enums, missing usernames, secret exclusion, unchanged source data, empty-target safeguards and copied photos.
- An isolated temporary MariaDB instance passed connection save/test, SQLite migration, database apply, session continuity and subsequent MySQL reads/writes. The installed database was not used or modified.
- npm and Composer audits reported no known dependency vulnerabilities at verification time.
- Source route inventory contains 64 original API routes. The two GET mutation routes are intentionally replaced with safer POST workflows, as described in `FEATURES.md`.

Email tests used a local capture transport and deliberately missing SMTP settings to test retries. They did not send external messages or verify inbox delivery through the user's SMTP provider. Production HTTPS/web-server configuration and the live database were not deployed or tested. SMS/WhatsApp retain the original queue-only scope.

Automated checks provide evidence for these scenarios, not a guarantee that all security issues or production edge cases have been eliminated.
