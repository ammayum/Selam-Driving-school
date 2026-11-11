# UAT Acceptance Checklist

Record tester, browser/device, date, release archive/hash, actual result and evidence for each item. Use synthetic data only. Mark Pass, Fail or Blocked; an automated pass is not a business acceptance sign-off.

## Entry Criteria
- [ ] Dedicated HTTPS UAT host and access restrictions; document root is `public/`.
- [ ] Separate MySQL database/account, fresh application key and no production/student data.
- [ ] `php bin/check-uat.php` passes; SMTP uses a sandbox and worker is scheduled.
- [ ] Backups and restore drill complete; named tester and defect owner assigned.
- [ ] `/robots.txt` disallows crawling, pages send noindex, `/sitemap.xml` returns 404.
- [ ] `.env`, config files, uploads directory listing and parent project files are inaccessible.

## Accounts and Security
- [ ] Admin creates student and instructor; unique temporary password shown once and copy/dismiss works.
- [ ] Temporary login requires a new password; account APIs cannot be used beforehand.
- [ ] New password works; temporary password and other previous sessions stop working.
- [ ] Expired temporary password cannot log in; reset email provides recovery.
- [ ] Admin account creation/edit requires acting admin password; admin setup remains email-only.
- [ ] Search/filter/paginate, edit contact details, freeze/unfreeze, delete/restore all work.
- [ ] Self-delete/self-freeze is blocked; deleted/frozen users cannot sign in.
- [ ] Student/instructor/admin resets reach test inboxes, tokens work once, passwords never appear in logs/lists.
- [ ] Users cannot read/edit another instructor's bookings, events or business cards.
- [ ] Audit log shows actor, action, time and relevant changes, without passwords or private notes.

## Booking and Instructor Workflows
- [ ] Create Manual and Automatic packages with fractional total hours and correct prices.
- [ ] Homepage showcase filters active packages; selected package carries into booking.
- [ ] Guest booking completes with matching transmission type; duplicate submission is handled safely.
- [ ] Public requests cannot assign instructors, use past dates or reserve excessively long ranges.
- [ ] Assign instructor, reschedule start/end, reject overlaps, record attendance/progress and cancel.
- [ ] Agreed price/hours stay unchanged after package catalog edits; legacy values show not recorded.
- [ ] Complete lesson, request payment, mark paid; invalid payment transitions are rejected.
- [ ] Confirmation/assignment/rescheduling/payment emails and calendar attachments reach the sandbox.
- [ ] Timeline fits day/3-day/week screens; overlaps, overnight events and UK daylight-saving dates display correctly.
- [ ] Event creation/edit/cancel, reminder worker, unread/read notifications behave correctly.
- [ ] Business cards save per instructor; download both sides and scan the UAT QR link.

## CMS and Public Pages
- [ ] Select existing page/section: saved title/body/metadata load correctly.
- [ ] Publish home sections, package introduction, lessons, booking, FAQs, login/signup and footer copy.
- [ ] Published edits appear in browser and initial HTML; FAQ structured data matches visible answers.
- [ ] Draft overrides do not leak publicly; built-in sections show defaults, custom drafts are unavailable.
- [ ] Custom published page opens at its slug; internal section slugs are not standalone public pages.
- [ ] Repeatable cards, reviews/moderation, instructor profiles, contact details and media work in their dedicated editors.
- [ ] No internal errors, credentials, dummy production claims or broken navigation appear publicly.

## Devices and Operations
- [ ] Desktop Chrome/Edge, Android Chrome and iOS Safari tested on real devices.
- [ ] Forms, dialogs, keyboard focus, copy behaviour, uploads and responsive user-management controls work.
- [ ] No browser exceptions; TLS/cookies/security headers checked on the deployed HTTPS host.
- [ ] Worker/scheduler restarts cleanly; failures/retries are observable; no real recipients receive UAT mail.
- [ ] Backup/restore and code rollback demonstrated. Load and concurrent-user behaviour are acceptable for the agreed UAT scale.

## Sign-Off
Release/hash: __________________  UAT URL: __________________

Tester: __________________  Business owner: __________________

Open critical/high defects: __________________

Decision (Accepted / Rejected / Conditional): __________________

Conditions and date: __________________

Do not promote with unresolved access-control, data-loss, booking-integrity or email-delivery blockers. Mobile Capacitor builds/App Store deployment are outside this PHP release's acceptance scope.
