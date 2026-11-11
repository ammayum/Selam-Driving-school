# Deployment

1. Use a patched PHP 8.2+ installation with PDO MySQL, mbstring, fileinfo and OpenSSL. Install locked Composer dependencies with `composer install --no-dev --prefer-dist`.
2. Deploy this folder separately from the existing Python website. Set the site's document root to `selamapp-php/public`. Do not expose the project root through an alias.
3. Run `php bin/setup.php`, set `APP_ENV=production` and `APP_URL=https://your-domain.example`, and create an admin using `php bin/create-admin.php`. Alternatively import into an empty database before creating accounts.
4. Configure HTTPS at the web server. The app uses Secure/HttpOnly/SameSite cookies in HTTPS mode, CSRF tokens, CSP, nosniff, frame restrictions and production HSTS.
5. Give the PHP service account access to `storage/` and write access to `config/` for encrypted admin settings. Keep `.env` readable only by the deployment/PHP account. On Linux use directories 0700/0750 and private files 0600/0640 as appropriate; on Windows restrict ACLs to the service and administrator accounts.
6. Configure SMTP, schedule `php /absolute/path/selamapp-php/bin/mail-worker.php` every minute, and send a controlled test booking using an address you own.
7. Set real contact details, publish CMS content and add packages/instructors. Verify `/sitemap.xml` and submit it to your search-engine webmaster tools. Confirm the canonical origin is the production domain.
8. Back up the database, `.env`, encrypted settings and uploads together. Use a separate database user with only this application's database privileges.

The PHP built-in server is for local testing. The included `.htaccess` requires Apache rewrite support and `AllowOverride All` for the public directory. A parent deny rule protects accidental exposure of the project root.

Apache virtual host example (adapt certificate directives to your deployment):

```apache
<VirtualHost *:443>
    ServerName driving.example
    DocumentRoot "C:/sites/selamapp-php/public"
    SSLEngine on
    SSLCertificateFile "C:/certs/site.crt"
    SSLCertificateKeyFile "C:/certs/site.key"
    <Directory "C:/sites/selamapp-php/public">
        AllowOverride All
        Require all granted
        Options -Indexes
    </Directory>
</VirtualHost>
```

Nginx/PHP-FPM location example (inside your HTTPS server block):

```nginx
root /srv/selamapp-php/public;
index index.php;
client_max_body_size 6m;
location ~ /\. { deny all; }
location ~ ^/build/assets/[a-zA-Z0-9_.-]+\.(js|css|woff2?|png|jpg|svg)$ {
    try_files $uri =404;
    expires 1y;
    add_header X-Content-Type-Options nosniff always;
}
location / { rewrite ^ /index.php last; }
location = /index.php {
    include fastcgi_params;
    fastcgi_param SCRIPT_FILENAME $document_root/index.php;
    fastcgi_pass unix:/run/php/php-fpm.sock;
}
location ~ \.php$ { return 404; }
```

Use a dedicated PHP session directory (the app defaults to its private storage directory). This implementation assumes one application instance with local sessions and filesystem rate limits; use shared session/rate-limit infrastructure before running multiple application nodes. Configure trusted-proxy/IP handling at your web server; the app does not trust arbitrary forwarded headers.

Database migration/application should happen during a maintenance window, with other writers and the email worker paused. The migration tool refuses populated destinations and the apply operation checks for changes since migration. Keep the source database until production behavior and backups are verified.

Application error logs intentionally omit raw SMTP exception details to avoid credential leakage. Check the provider's connection/authentication logs if delivery fails. The Notifications screen and outbox track retries separately from successful booking creation.

Reference: [PHP session security](https://www.php.net/manual/en/session.security.ini.php).
