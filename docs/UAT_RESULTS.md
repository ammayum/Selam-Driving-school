# UAT Preparation Results - 2026-09-25

Status: local release candidate prepared. Remote deployment and business acceptance are NOT complete.

## Automated Verification
- Production frontend build: passed.
- PHP source syntax checks: zero failures.
- Integration suite: 46 checks passed using isolated data.
- MySQL regression suite: passed booking validation/concurrency, package terms/migrations, user CRUD/audits, temporary passwords, reset flows, CMS, events and business-card permissions.
- CMS/user-management browser suite: passed editing, creation/status changes, reset forms and first-login temporary-password change.
- Instructor calendar, business-card downloads/QR and package-booking browser suites: passed desktop/mobile checks.
- UAT indexing smoke checks: passed robots disallow, sitemap 404, HTTP noindex and metadata noindex.
- Legacy import and isolated MariaDB migration/apply tests: passed.
- Calendar layout tests: 4 passed, including DST and overlapping/overnight entries.
- Dependency audits: npm and Composer reported no known advisories at preparation time. This is not a penetration-test certification.

Tests use temporary databases and synthetic accounts. No real emails were sent. Screenshots and captured test messages are excluded from the runtime release.

## Remote / Manual Gates
- Requested target is Linux at `http://217.154.57.145:5173`.
- A read-only HTTP request returned 500. Remote logs/configuration were not accessible, so the cause is unverified.
- UAT template is configured for that address, development mode and disabled indexing. HTTP is an explicit restricted-test exception, not a production-ready transport.
- SSH/deployment access, actual web server/PHP socket, MySQL credentials and mail sandbox configuration remain required.
- TLS, firewall/IP restrictions, deployed cookie/CSRF behaviour, real-device testing, inbox delivery, scheduler, load and restore/rollback drills remain pending.
- Existing local `.env`, database, encrypted settings, uploads and working app data were not cleaned or replaced. The separate release excludes them.

## Acceptance
Use `UAT_PLAN.md` to record human acceptance. Do not mark this release accepted or deploy production data until the unresolved gates are addressed.
