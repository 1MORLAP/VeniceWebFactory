# WebFactory lead-funnel — conversion hypotheses

This file tracks every hypothesis the lead-funnel skill operates on. We have
ZERO conversion data today (marketplace pre-launch). Every weight in
`conversionLikelihood()` in `report.js` is a prior we'll regress against
real outcomes (`leads.purchased_at`) once the marketplace ships.

When you discover something that seems to predict awful sites OR conversion,
add a row here. Don't change scoring weights without data.

---

## 🚫 Hard exclusions (NOT hypotheses — these are policy decisions)

These groups are PERMANENTLY blocked, regardless of conversion-likelihood
score. They sit in `lead-funnel/filter.js` and `lead-funnel/score.js` and are
checked at multiple stages of the pipeline.

### HX1 — Law firms / attorneys / legal services [LEGAL RISK]

Owners are litigious by training. Cold outreach + hosting a derivative site
under our marketplace = real exposure to:
- Cease-and-desist letters
- Trademark / copyright claims (their site content, their firm name)
- Bar association complaints (in some jurisdictions, advertising rules apply)
- Actual lawsuits

**Detection** (multiple layers, fail-safe):
1. Pre-probe name pattern match — `LAW_NAME_PATTERNS` in filter.js (attorney,
   law firm, law offices, lawyers, esq., personal injury, etc.)
2. Post-score industry blocklist — if Gemma classifies as `industry='law'`,
   reject. `POST_SCORE_BLOCKLIST` in score.js.
3. Cleanup script — `scripts/cleanup-existing.js` retroactively rejects any
   row that matches either layer.

**To add another legally-risky industry**: append to both `LAW_NAME_PATTERNS`
(filter.js) and `POST_SCORE_BLOCKLIST` (score.js). Re-run cleanup script.

### HX2 — Complex tech integrations [SCOPE-FIT]

V1 of /webfactory rebuilds "marketing site with mailto-style contact form".
Sites with backend integrations require us to replicate that backend before
we have a sellable rebuild. Out of scope.

**What we KEEP** (V1-fine — we replace with mailto in the rebuild):
- `<form action="mailto:...">` contact forms ✅
- Plain `<form>` posting to a server-side email handler ✅
- Form-builder integrations: JotForm, Typeform, Wufoo, Formstack,
  Cognito Forms, Gravity Forms, WPForms, Ninja Forms, Google Forms ✅
- Form/CRM platforms used as forms: Weave forms, Formspree ✅
- PDF download links (e.g. "print our patient intake form (PDF)") ✅

**What we DROP** (`COMPLEX_TECH_TOKENS` in filter.js):
- **Booking widgets** — Calendly, Acuity, Vagaro, Mindbody, ZocDoc,
  StyleSeat, Booksy, Setmore, Genbook, YouCanBook.me, Schedulista,
  Square Appointments, Fresha, SimplePractice
- **Restaurant reservations** — OpenTable, Resy, Tock, Yelp Reservations
- **Healthcare practice-management systems-of-record** — Dentrix,
  athenanet (we'd have to integrate as a system-of-record, not just replace a form)

**Detection**: HTML probe scans for vendor domain tokens. ~40 tokens in V1;
add new vendors as we encounter them.

---

## Conversion target (north star)

A lead "converts" when the original-site owner buys their rebuilt site
on the WebFactory marketplace. The funnel stages we track in `leads.db`:

```
identified → rebuilt → published → outreach_sent → email_opened
   → marketplace_visited → purchase_offered → purchased  ← gold
```

Plus terminal: `dead` (no response after N days, bounce, unsubscribe, hard no).

## Status legend

- `untested` — no data yet, prior belief only
- `testing` — we're collecting data, no verdict
- `confirmed` — predicts conversion at a meaningful rate
- `refuted` — does not predict conversion (drop the weight)
- `inverted` — opposite of what we believed (sign-flip the weight)

---

## H1 — High `tech_age_score` predicts conversion

**Belief**: Sites scoring ≥ 8 on the tech-age heuristic (FrontPage / iWeb / no
viewport / jQuery 1.x / etc.) are owned by people who haven't touched their
site in 5+ years. When shown a modern rebuild, they recognize the gap and
are receptive.

**Weight**: `tech_age_score × 1.5` (in `conversionLikelihood`).

**Status**: `untested`. Currently THE primary filter (`MIN_TECH_AGE = 5` default).

**Test**: once 100+ leads have hit `outreach_sent`, compare conversion rate
of `tech_age_score >= 8` vs `tech_age_score < 8` cohorts.

**Risk if wrong**: we could be filtering out modern-but-ugly sites whose
owners ARE shoppable. The `--explore` flag is the escape hatch.

---

## H2 — High `awfulness_score` predicts conversion

**Belief**: Visually bad sites embarrass owners. Showing them a rebuild is
emotionally compelling.

**Weight**: `awfulness_score × 2.0`.

**Status**: `untested`.

**Counter-hypothesis**: maybe owners who don't notice their site is ugly
ALSO won't notice the rebuild. The right segment might be "ugly site +
recent reviews" (active, but unaware of design problem).

---

## H3 — Single-location single-operator businesses convert faster

**Belief**: Decision can be made on the spot. No committee. No franchise
corporate. Quick close.

**Weight**: `single_location_confidence × 8`.

**Status**: `untested`. Implemented as both a filter (multi-location
chains rejected at filter stage) and a scoring weight.

---

## H4 — Trust-dependent industries convert better

**Belief**: Industries where prospects research online before calling
(funeral, law, dental, medical, chiropractic, accounting, real estate)
care more about their site's appearance because it directly affects
business. Owners are more receptive.

**Weight**: `+8` for any industry in `TRUST_DEPENDENT_INDUSTRIES`.

**Status**: `untested`.

**Counter-hypothesis**: those owners might already invest in their site,
so they're LESS likely to have an ugly one we can rebuild. Test on data.

---

## H5 — Active Google Business profile predicts engagement

**Belief**: Owners with ≥10 reviews, photos uploaded, hours listed are
"active maintainers" — more likely to engage with outreach.

**Weight (subset)**:
- `+3` if `google_review_count >= 10`
- `+3` if `google_review_count >= 50`
- `+2` if `google_rating >= 4.0`
- `+2` if `google_rating >= 4.5`
- `+2` if `photo_count >= 5`
- `+1` if `has_open_hours`

**Status**: `untested`. Captured at discover time but never validated.

---

## H6 — Reachable site (mailto / form) converts

**Belief**: If we can find the owner's email or contact form on their site,
outreach is much easier.

**Weight**: `+4` if `site_has_email`, `+2` if `site_has_form`.

**Status**: `untested`. Captured at filter time.

**Note**: a site without contact info can still be reached via Google
Business profile messaging or domain WHOIS — but cost-per-lead goes up.

---

## H7 — Pay tier matters

**Belief**: Premium trades (HVAC, roofing, custom builders), attorneys,
dentists, specialty medical have budget for a $X website. Restaurants,
small retail, hourly trades are price-sensitive.

**Weight**: `high: +15, mid: +8, low: +3`.

**Status**: `untested`. Pay tier is currently a Gemma-judgment call from
the screenshot — could be noisy.

---

## Hypotheses to TEST in future iterations

These aren't yet in the scoring function — adding them requires more data
collection.

### H8 — Domain age (older = more established = bigger budget)

**Plan**: Add WHOIS lookup at filter time. Cache by domain. Weight by years.

### H9 — Recent review velocity (active business)

**Plan**: Places API doesn't return review timestamps in basic fetch.
Would need a separate `places.reviews` call (extra quota). Compare last
review date to today — recent = active.

### H10 — Social media presence (engaged owner)

**Plan**: Detect Facebook / Instagram / LinkedIn URLs in homepage HTML.
Owners running multi-channel marketing might be MORE willing to spend OR
might already have a marketing person and not need us. Test both ways.

### H11 — Geography signals

**Plan**: Bucket `state + city → metro vs small market`. Test whether
small-market businesses convert at higher / lower rate. Maintain a
US-metro list (top 100 MSAs) for fast classification.

### H12 — Language signals

**Plan**:
1. Detect non-native English copy (Gemma can flag this in awfulness reasoning)
2. Detect Spanish / non-English homepage (consider Spanish-language outreach)
3. Test whether non-native owner = higher conversion (they need help) or
   lower (language barrier blocks negotiation).

### H13 — "Best viewed in" / nostalgic markers correlate with old + receptive

**Plan**: Already captured as a tech-age signal (+10). After enough data,
check if the +10 is too high or too low.

### H14 — Vague vs. specific Gemma reasoning

**Plan**: When Gemma's reasoning is generic ("dated template, generic stock
photos"), it's clustering toward 7/10. When it's specific ("table-based
layout, animated GIF banner, 2008 copyright"), the score is more reliable.
Score-the-reasoning meta-signal.

### H15 — Cluster-based conversion patterns

**Plan**: After 100+ sales, cluster sold leads on (industry × tech_age × pay
× geography). Find the dominant clusters. Re-weight the function to favor
matches to those clusters.

---

## How to add a new hypothesis

1. Document it here with belief, proposed weight/source, status, test plan
2. If you want it in the scoring function NOW (pre-data), add it to
   `conversionLikelihood()` in `report.js` with a prior weight
3. Add the test plan as a TODO with an outcome-data dependency
4. NEVER change weights without data once we have data — write a separate
   `weights.json` informed by regression and load it at runtime

## How to retire a hypothesis

If a feature flips to `refuted` or `inverted` after analysis:
1. Update its status here
2. Drop or sign-flip its weight in `conversionLikelihood`
3. Note the regression run that produced the verdict (date, sample size, p-value)
