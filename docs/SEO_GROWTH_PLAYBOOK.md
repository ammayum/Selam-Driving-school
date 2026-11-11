# Sheffield SEO + AEO growth playbook

## Objective

Increase **qualified Sheffield learner enquiries and bookings**, rather than unqualified visits. SEO improvements cannot guarantee Google rankings, AI citations, traffic volumes or sales. Measure growth against a verified baseline.

## Implemented in this branch

- Two substantial service pages: `/manual-driving-lessons-sheffield` and `/automatic-driving-lessons-sheffield`.
- Distinct page titles, descriptions and H1s, educational sections, honest learner FAQs and internal links to pricing and booking.
- Server-rendered content for crawlers and matching React views.
- Valid Schema.org `LocalBusiness` and `EducationalOrganization` types rather than the unsupported `DrivingSchool` type, plus `Service` and visible `FAQPage` markup.
- Existing sitemap and canonical logic automatically include both service pages.
- Booking form recognises `?lesson_type=manual` and `?lesson_type=automatic` to preselect an appropriate filter.
- Homepage, Lessons page and footer link to the new pages. Original booking and payment routes are unchanged.

## Release gate: verify production before investing in promotion

1. Confirm `https://selamdrivingschool.co.uk/`, `/lessons`, `/manual-driving-lessons-sheffield`, `/automatic-driving-lessons-sheffield`, `/robots.txt` and `/sitemap.xml` return HTTP 200 on the intended HTTPS host.
2. Confirm canonical URLs consistently use the chosen `https://selamdrivingschool.co.uk` origin; configure non-canonical host redirects in IONOS web hosting when its actual setup is known.
3. Verify `APP_INDEXING=true` in production **only** after the correct website is live. A UAT environment should remain noindexed.
4. Inspect page-source (before JavaScript) to verify each H1, page description, canonical, FAQ/service JSON-LD and local contact details. Confirm no fabricated opening hours, pass rates, instructor certifications or reviews.
5. Use Google Search Console URL Inspection to check index eligibility, submit `/sitemap.xml`, monitor excluded URLs, and connect Bing Webmaster Tools. Do not claim indexed until verified.
6. Run the pull request CI: PHP lint, `python3 tests/seo_aeo.py`, `cd frontend && npm ci && npm run build`. Perform an end-to-end booking smoke test on staging.
7. Back up code, database, encrypted config and uploads together. Reconcile with separate review/blog photo PR #2 before merging both feature sets.

## Search intent → intended page

| Search intent | Primary page |
| --- | --- |
| driving lessons Sheffield | / |
| manual driving lessons Sheffield | /manual-driving-lessons-sheffield |
| automatic driving lessons Sheffield | /automatic-driving-lessons-sheffield |
| driving instructor Sheffield | /instructors |
| driving lesson prices Sheffield | /prices |
| book driving lessons Sheffield | /book |
| local learner advice | /blog (after original, reviewed content exists) |

Avoid publishing dozens of doorway pages with only a different neighbourhood name. Local pages require proof of actual coverage and distinctive information.

## Four-week traffic acquisition sequence

### Week 1 — Local trust, crawlability and measurement
- Verify and fully complete the **correct** Selam Sheffield Google Business Profile, linking to the canonical website. If there is no staffed storefront, use a service-area profile and follow Google's address rules.
- Check business name, contact number, hours and serviced areas for consistency across the website and profile. Do not invent an office address.
- Verify domain and sitemap in Search Console; establish baseline organic impressions, clicks, CTR and top queries **before** changing marketing budgets.
- Set up consent-aware analytics and booking-submission/click-to-call conversion events. Avoid unnecessary advertising cookies before consent.

### Week 2 — Better answers and evidence
- Confirm lesson package prices and current instructor availability are accurate in the admin CMS.
- Replace thin generic pages with genuine instructor biographies, relevant qualifications (only after verification), real tuition vehicle photos and true student testimonials with permission.
- Publish one carefully reviewed practical article: e.g. 'Manual vs automatic driving lessons: what Sheffield learners should consider'. Link to both lesson pages and pricing.
- Add contextual internal links between lessons, packages, FAQ answers and booking.

### Week 3 — Local discovery
- Invite recent genuine customers to leave reviews through a neutral request; never pay for or fabricate reviews.
- Add consistent directory/citation listings on genuinely relevant UK and Sheffield platforms.
- Share a real instructor-led short video explaining first-lesson expectations, plus a link to the useful landing page.
- Check Search Console for new service-page impressions and indexing issues.

### Week 4 — Conversion and iteration
- Review landing-page search queries, clicks, enquiry form starts and completed requests.
- Improve unclear CTAs, mobile page layout, authentic image sizes, loading performance and booking friction.
- Update snippets and copy using **actual** search-query data. Keep prices and offers factually correct.
- Consider a controlled Google Search Ads pilot for high-intent Sheffield phrases if budget is available; track submitted booking enquiries, not only clicks.

## Ongoing AEO and authority

- Publish genuinely helpful, reviewed answers in ordinary HTML, not thin AI-generated batches.
- Use real lesson details, current prices from the database, clearly attributed professional guidance and credible source links (especially GOV.UK/DVSA for legal requirements).
- Add genuine high-quality, permissioned photos with descriptive alt text. Existing review/blog photo PR #2 is designed to help with this.
- Keep structured data limited to visible, supported facts; no self-serving review-star tricks, fake offers or invented accreditations.
- Recheck site accessibility and indexing at least monthly and after releases.

## Reporting dashboard

Weekly: Search Console organic clicks, impressions, CTR, indexed pages, enquiries through site, and enquiry conversion rate. Monthly: map-profile actions, actual bookings attributed to organic search, cost per lead from any ads, and which content produces leads.

An increase in raw visits without Sheffield-qualified booking requests is not the right success metric.

## Sources

- Google's 2026 AI Search guidance: https://developers.google.com/search/docs/fundamentals/ai-optimization-guide
- Google SEO starter guide: https://developers.google.com/search/docs/fundamentals/seo-starter-guide
- Google's image SEO guidance: https://developers.google.com/search/docs/appearance/google-images
- GOV.UK automatic-to-manual licence rules: https://www.gov.uk/automatic-driving-licence-to-manual
