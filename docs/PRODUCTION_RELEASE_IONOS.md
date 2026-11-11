# Production release: Selam Driving School (IONOS)

> **Preparation complete does not mean deployment has occurred.**
> This repository can produce a tested, secret-free PHP deployment ZIP. The
> webspace, live data and DNS must be inspected and backed up before release.

## Status of this integrated release

- Integrates SEO/AEO PR #1 and review/blog photo PR #2.
- GitHub production release readiness workflow runs isolated PHP tests,
  TypeScript/Vite build, Composer installation and a SHA256-verified ZIP artifact.
- The `bin/preflight-production.php` script performs read-only host checks.
- No production credentials, IONOS webspace or database are bundled.
- The project documentation describes an **older Python site**. Confirm
  whether that application still handles live traffic. If so, plan data
  migration into a **new, empty** PHP/MySQL database before switching DNS.

## 1. Download the tested release candidate

Open **Actions → Production release readiness → latest green run →
Artifacts → selam-production-candidate**. Download the action artifact,
unzip it locally, and locate `selam-production-<sha>.zip` and its companion
`.zip.sha256`.

Check the checksum before deployment:

```bash
sha256sum -c selam-production-<sha>.zip.sha256
```

The inner release ZIP contains `selam-production/app`, `public`,
`vendor`, `config/bootstrap.php` and helper scripts. The compiled
React assets are in `public/build`.

**Never unzip over a live production folder.** Extract to a new, isolated
release directory. Keep the live directory and data untouched.

## 2. Confirm host and back up current website

- In IONOS, find the hosting contract, domain target and current document
  root; verify SFTP/SSH, PHP version and the associated MySQL database.
- Back up the current webroot and the database separately, plus all private
  data, `.env`, encrypted settings and uploaded media.
- Store backups outside the webspace, verify that they can be restored and
  note the exact date and database used.
- Record the previous domain/webroot target so rollback is possible.
- If current production is Python, **do not** point this PHP app at the
  Python database. Follow `docs/MIGRATION.md` to migrate into a new PHP
  database, including customer and booking records, and validate the counts.
- Never use a live database for dry-run or smoke-test submissions.

## 3. Prepare staging and PHP extensions

- PHP **8.2+**, ideally PHP 8.3, with `pdo_mysql`, `mbstring`,
  `fileinfo`, `openssl` and `gd` (JPEG/PNG/WebP).
- Configure `upload_max_filesize=6M` or more, `post_max_size=7M` or
  more, and sufficient `memory_limit`. Account for any IONOS request limits.
- Staging must have a separate HTTPS domain, private MySQL DB, private
  filesystem storage and `APP_INDEXING=false`.
- Document root **must be** `selam-production/public`, never the project
  root. Restrict `.env`, `config` and `storage` to the PHP/service account.
- In staging, validate the combined React app, booking submissions, photo
  uploads, moderation and published blog pages.

## 4. Configure secrets *on the host only*

Example `.env` values; do not use literal placeholders:

```ini
APP_ENV=production
APP_URL=https://selamdrivingschool.co.uk
APP_INDEXING=true
APP_KEY=(retain existing PHP APP_KEY, or generate for a fresh install)
DB_DSN=mysql:host=(mysql-host);port=3306;dbname=(database);charset=utf8mb4
DB_USER=(app-user)
DB_PASSWORD=(app-password)
MAIL_TRANSPORT=smtp
MAIL_SEND_IMMEDIATELY=true
MAIL_AUTO_WORKER=true
UPLOAD_MAX_BYTES=5242880
```

Keep `.env` under the private release directory with limited permissions.
Do **not** overwrite the existing PHP APP_KEY without a reviewed secrets
migration. Review `DB_ALLOWED_HOSTS` if you use the admin DB connection tool.

## 5. Apply additive schema migration

**Only on a backed-up PHP database, during a maintenance window.** With
the new release and production `.env` in place:

```bash
cd /path/to/selam-production
php bin/setup.php
php bin/preflight-production.php
```

The migration creates the `blog_posts` table and adds a nullable review
photo field; it also applies any previously needed schema updates. Check
database schema and business data before routing traffic to the new version.

**For a Python-to-PHP migration:** import into a new empty PHP database per
`docs/MIGRATION.md`; don't run the PHP setup against an old Python schema
as though it were an in-place upgrade.

## 6. Release switch and smoke test

1. Pause or safely drain existing booking writers and outgoing email worker.
2. Reconfirm database, configuration, media and current-release backups.
3. Confirm the domain's HTTPS certificate and set its webroot to the new
   release `public` directory only after staging acceptance.
4. Verify `/api/health`, `/login`, `/book`, `/reviews`,
   `/blog`, `/sitemap.xml`, `/robots.txt`,
   `/manual-driving-lessons-sheffield` and
   `/automatic-driving-lessons-sheffield`.
5. Using authorised test records, verify admin login, a guest booking,
   packages and instructor assignment, queued email, review-photo approval,
   Blog image upload, media rendering and that drafts stay private.
6. Remove test data, validate actual booking records, ensure the scheduled
   email worker runs and inspect private PHP logs.
7. Submit sitemap through Google Search Console only after verifying the
   intended canonical host and indexable response.

## 7. Rollback

If failures occur, stop incoming booking writes, document any new bookings
made after the switch, point the domain back to the previous *working*
webroot, and reinstate its compatible application configuration.

Do not blindly restore an older database snapshot after new bookings were
accepted. Reconcile all transactions written after the backup. MySQL schema
downgrades may need a separate restoration plan: an application-file rollback
alone does not reverse schema migrations.

## Remaining launch gates

- [ ] Current IONOS domain destination and hosting type confirmed
- [ ] Existing production application stack confirmed (PHP vs Python)
- [ ] Recoverable code + database + secrets + uploads backups confirmed
- [ ] Staging database migration completed and records checked
- [ ] Staging booking/payment/auth/email and photo/blog tests completed
- [ ] IONOS PHP extensions, limits and permissions checked by preflight
- [ ] Canonical hostname/SSL/APP_INDEXING checked
- [ ] Rollback plan rehearsed and previous release retained

**Do not mark the site as deployed until IONOS has been changed and the
live checks have passed.**
