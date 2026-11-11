# Admin Pages and Website Content

Administrators visiting `/portal` are redirected to `/admin/overview`.
Each administration section has its own URL, supports refresh and browser Back,
and is marked noindex. Student and instructor portals are unchanged.

## Content Editing

Open `/admin/cms/home` and choose a page from the directory. Select a heading,
section or label, edit it, enable Published, and save. Public visitors only receive
published overrides; drafts fall back to built-in content. Copy is plain text,
not executable HTML. The public content endpoint never returns unpublished rows.

- Home: hero, sections, FAQs, package showcase copy, buttons, repeatable cards.
- About: page copy, social links and videos.
- Lessons, prices, instructors, reviews, booking, contact, blog, login and signup:
  existing page copy plus connected labels and buttons.
- Reviews: testimonials and moderation.
- Contact: public contact details.
- Header & Footer: shared copy, menu labels, social links, contact and side video.
- Custom: additional plain-text pages. Links are not added to navigation automatically.
- Packages and instructor profiles retain their dedicated managers, linked from CMS.

The CMS does not alter validation rules, security messages, booking logic or page
layout. Dynamic values such as prices, availability and instructor details come
from their existing records. Empty saved repeatable lists stay empty.

## Deployment

Upload these backend files together:

```
app/Content.php
app/Config.php
app/Seo.php
app/PublicCopy.php
```

Upload the freshly built `public/build/` directory including its hidden
`.vite/manifest.json`. Do not replace `.env`, `config/secrets.json`, storage or
the database. No database migration is required for this change.

Build: `npm --prefix frontend run build`.
Regression checks: `python tests/admin_pages.py` (local MySQL and Edge required;
creates and removes a separate test database, with no real email sending).
