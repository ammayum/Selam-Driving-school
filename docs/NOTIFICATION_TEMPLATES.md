# Notification Email Content

Open `/admin/cms/notifications` as an administrator. Select a notification type,
edit its subject and plain-text message, review the sample and save.

Placeholders: `{{subject}}` (original subject), `{{details}}` (original dynamic
message), `{{site_name}}`, and `{{site_url}}` (configured APP_URL).
The message must contain `{{details}}` to preserve booking information, invitation
codes and password-reset instructions. It is not allowed in the subject.
Unknown placeholders and multiline subjects are rejected. Output is HTML-escaped
by the existing mail sender. Preview never sends email and uses synthetic data.

Templates are admin-only configuration, not public CMS pages. Changes are audited
without logging rendered messages or tokens. New emails capture the template at
creation; retries and already queued messages retain their existing payload.
Recipients, attachments, delivery and retry logic are unchanged. This feature
customizes email content, not SMS or instructor in-app event alerts.

Upload together:

```
app/NotificationTemplates.php
app/Mailer.php
app/Config.php
app/Api.php
public/build/ (including .vite/manifest.json)
```

No schema migration is required. Keep existing environment settings and secrets.
