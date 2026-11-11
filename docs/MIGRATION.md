# Importing Existing Data

Import into a new, empty PHP database. Do not run the PHP app against the original database. Take a source backup and use a read-only source database account.

`bin/import.php` connects to the source in read-only mode. Without `--apply`, it only prints table counts. It imports public content, users, bookings, packages, preferences, review submissions, invitations, notifications and activity history. It normalizes Python enum values and supports the original PBKDF2 password hashes, upgrading hashes after successful login.

It deliberately excludes old access/refresh sessions, password-reset/assignment tokens, SMTP/SMS/database secrets and pending delivery tasks. Re-enter secrets through the PHP admin portal. Imported notification history is retained without resending old messages. Existing pending invitation codes are hashed and continue to work. Incomplete old users without usernames receive `imported_ID`; users without a password hash must use password recovery or have an administrator arrange access.

PowerShell example using a database backup:

```powershell
$env:IMPORT_DSN = 'sqlite:C:/backups/selam_v2.db'
php bin/import.php
php bin/import.php --apply
php bin/import-media.php 'C:/backups/uploads'
Remove-Item Env:IMPORT_DSN
```

For MySQL, set `IMPORT_DSN=mysql:host=...;port=3306;dbname=...;charset=utf8mb4`, `IMPORT_USER` and `IMPORT_PASSWORD` privately in your shell. Use a SELECT-only source account. Avoid putting credentials directly in command arguments or documentation.

Use a fresh `.env` database target when importing. The supplied working-copy database already contains a public snapshot; import refuses to overwrite any populated target table. Create a separate empty MySQL database and set its MySQL DSN in `DB_DSN` before running setup/import. Normal application execution requires MySQL; SQLite is only allowed as an import source or an isolated automated test fixture.

`bin/import-media.php` copies approved JPEG/PNG/WebP files referenced by imported users, assigns random filenames and updates only the new database's URLs. It does not delete or alter source files. External image URLs without a matching local source file are retained.

The portal also supports migration from the new PHP app's SQLite database into an empty MySQL database: save the connection, test, migrate, then apply. Add the destination host to `DB_ALLOWED_HOSTS` in `.env`. The original server database is not used as a migration destination. Pause writers during migration and retain the SQLite backup.

The original `.env` references a MySQL server, while the available local SQLite file has an older and incomplete schema. The small local public snapshot is not a copy of the full live website's data.
