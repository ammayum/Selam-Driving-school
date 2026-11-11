# Linux UAT at 217.154.57.145:5173

Prepared URL: `http://217.154.57.145:5173`. Deployment is NOT performed by this package. A read-only request to that address returned HTTP 500 during preparation.

## Before Upload
Identify the Linux distribution, current web server, PHP-FPM service/socket, current port owner and existing application directory. Do not stop a process just because it uses 5173. On the server, useful read-only checks are:

```sh
cat /etc/os-release
sudo ss -ltnp | grep ':5173'
php -v
php -m
ls /run/php/
```

If Apache already serves this application, adapt its existing virtual host rather than installing a competing Nginx listener. `nginx-uat-5173.conf` is an Nginx example, not a claim that your server currently uses Nginx.

## Deploy to a New Directory
Upload the ZIP and checksum, verify with `sha256sum -c <archive>.zip.sha256`, and extract the release to a new directory such as `/var/www/selamapp-php-uat`. It must contain `app/`, `public/`, `vendor/` and `bin/`; avoid an extra nested archive folder in the configured root.

Follow `README.md` to initialize `.env`, configure a separate MySQL database and test SMTP, run setup and create an administrator. Keep application code owned by the deployment account. Grant the PHP service account read access to code and `.env`, and write access only to `storage/` and `config/` as needed. Never use chmod 777. Service account names differ by distribution.

Configure the included Nginx server block with the correct document root and installed PHP-FPM socket. Add your tester's public IP with an `allow` line before `deny all`. Without that change, external requests correctly return 403. Validate using `sudo nginx -t` before an approved reload. Open firewall port 5173 only to the allowed testers; keep MySQL private.

Set the application's `.env` to:

```dotenv
APP_ENV=development
APP_URL=http://217.154.57.145:5173
APP_INDEXING=false
```

These values are already in the UAT template. Development mode is necessary only for this requested HTTP test address; error display still remains off. This is not suitable for real credentials or unrestricted public access. When TLS is available, use the actual HTTPS origin and `APP_ENV=production`. Do not set `VITE_API_BASE_URL` to another host or run Vite on the production/UAT listener: compiled assets and `/api` belong to the same PHP origin.

Schedule this under the PHP service account every minute, using your actual PHP path:

```cron
* * * * * /usr/bin/php /var/www/selamapp-php-uat/bin/mail-worker.php >> /var/www/selamapp-php-uat/storage/worker.log 2>&1
```

Arrange log rotation and check worker failures. Test mail only through the sandbox.

## Diagnose HTTP 500
Read the site's private `storage/error.log` and the relevant Nginx/Apache/PHP-FPM logs. Do not enable public PHP error display or post secrets from logs. Check missing `.env`/APP_KEY, PHP extensions, vendor dependencies, database connectivity/schema, filesystem permissions and the configured document root. Run `php bin/check-uat.php` from the release folder. HTTP/production checks intentionally fail while using this HTTP exception; database/SMTP/dependency failures still require fixing.

## Smoke Test
From an allowed IP: load `/`, `/login`, `/api/health`, then sign in and perform a synthetic booking. Confirm secure CSRF requests use the exact configured IP and port. Verify `/robots.txt` disallows crawling, response headers include noindex, and `/sitemap.xml` returns 404. Test a private path such as `/.env` returns 403/404 with no content. Check frontend assets and `/api` do not return a Vite page or another application's response. Finish the acceptance plan before sign-off.
