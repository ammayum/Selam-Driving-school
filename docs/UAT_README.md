# Selam PHP - UAT Release

This is a clean runtime package, not a database backup. It includes PHP code, locked vendor dependencies and compiled frontend assets. It intentionally excludes existing credentials, database files, uploads, sessions, logs, screenshots, test fixtures, Node dependencies and reference photos. The working application is not changed by packaging.

## Requested Test Address

The included template targets `http://217.154.57.145:5173` using development mode because production mode requires HTTPS. This HTTP exception is for access-restricted synthetic testing only: passwords and cookies are unencrypted. Do not use real learner/admin credentials or public unrestricted access. The preflight intentionally reports HTTPS/production-mode failures until TLS is configured. The address responded with HTTP 500 during preparation; this package has not been deployed there and does not claim to fix the running server.

Use the steps below with your web server listening on port 5173, serving PHP through Apache/PHP-FPM. Port 5173 is not a requirement to run Vite. The compiled frontend must be served by the same PHP origin as `/api`. Check for an existing service before binding that port; do not stop/replace it without confirming what it hosts.

## Setup
1. Extract into a NEW location. Do not overwrite the working app or point at its database.
2. Use PHP 8.2+ with PDO MySQL, OpenSSL, mbstring, fileinfo and sessions. Serve only `public/` through the web server (HTTPS recommended; restricted HTTP exception above); do not use PHP's development server for shared UAT.
3. Run `php bin/init-uat.php`. This creates a unique application key without displaying it. Keep `.env` private.
4. Have the hosting administrator create `selamdrivingschool_uat` and a dedicated password-protected account restricted to that database. Allow the schema privileges needed by setup, then reduce runtime privileges where possible. Do not use root/blank or the working database.
5. Edit `.env`: retain the requested UAT URL or set the final HTTPS URL, then replace the database password/connection and SMTP settings. Keep `APP_INDEXING=false`. Set `APP_ENV=production` only after configuring HTTPS. Use a mail sandbox/catch-all so messages cannot reach real learners.
6. Run `php bin/setup.php`, then `php bin/create-admin.php`. No default account or password ships in this package. Use fictitious users and test addresses only.
7. Schedule `php /absolute/path/bin/mail-worker.php` every minute under the same environment and service account. Monitor errors and the portal notification queue.
8. Run `php bin/check-uat.php`; resolve all false checks; HTTPS/production checks intentionally remain false during the restricted HTTP test exception. It never prints configuration secrets and does not send email.
9. Restrict the entire UAT site through a VPN/IP allowlist or equivalent server-level access control. Noindex/robots directives are NOT access controls. With HTTP Basic authentication, test whether the app's Authorization header interferes; VPN/IP restrictions avoid that conflict.
10. Follow `docs/UAT_PLAN.md` and record acceptance. Confirm storage/config permissions, actual HTTPS behaviour, email delivery and backups on the target host.

All setup commands above must run from this extracted release directory. `public/` is the document root, not the ZIP or project folder.

## Package Integrity
`MANIFEST.sha256.json` lists file hashes excluding itself. The adjacent `.zip.sha256` file records the archive hash. Keep the validated archive and the environment/database/uploads backup together for traceability, but never put secrets into the ZIP.

## Promotion / Rollback
This release is prepared for UAT, not signed off for production. Target infrastructure and external email are unverified. Before any upgrade, back up the UAT database, uploads, `.env` and encrypted settings together and prove restoration into another isolated location. Use a new release directory for deployment. Pause workers during migration; switch the web root only after smoke tests. On failure, restore the previous matching code/data/config set; do not improvise destructive schema rollbacks. Production promotion requires explicit approval and a separately reviewed configuration, including indexing policy.
