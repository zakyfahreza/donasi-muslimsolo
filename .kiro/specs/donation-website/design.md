# Design Document

## Overview

The Donation Website is a static crowdfunding site for muslimsolo.id backed by a Google
Apps Script (GAS) web app and a Google Spreadsheet. The frontend is plain HTML/CSS/JS hosted
on GitHub Pages at `donasi.muslimsolo.id`. All data access flows through a single GAS web app
that reads and writes the spreadsheet and stores payment proofs in Google Drive.

This document describes the system architecture, the public/admin API contract, the data
models, the donation and verification flows, the visual/UX design direction (inspired by
modern Indonesian crowdfunding platforms such as kitabisa.com and kotakinfaq.com), and the
error handling, security, and testing strategies. It maps each design decision back to the
requirements in `requirements.md`.

### Goals

- Fast, mobile-first donor experience completed in no more than five steps (Req 11).
- Collected amounts computed only from verified donations (Req 8.4).
- Write operations protected by a shared token, server-side validation, and rate limiting (Req 5).
- Secure admin authentication with hashed passwords and expiring sessions (Req 6).
- A clean, trustworthy, modern crowdfunding look that encourages giving.

### Non-Goals

- No real-time payment gateway integration; QRIS is a static image and bank transfer is manual.
- No automatic reconciliation of bank statements; verification is manual by an administrator.
- No multi-currency support; all amounts are Indonesian Rupiah (IDR).

## Architecture

```
                 ┌─────────────────────────────────────────────┐
                 │              Browser (Donor/Admin)            │
                 │   index / detail / donasi / admin  (static)   │
                 └───────────────┬───────────────────────────────┘
                                 │  fetch (GET read, POST write)
                                 ▼
                 ┌─────────────────────────────────────────────┐
                 │      Google Apps Script Web App (Code.gs)     │
                 │  doGet  → campaigns | campaign | payment      │
                 │  doPost → donate | login | adminData |        │
                 │           verify | reject                     │
                 │  cache · validation · auth · rate limit       │
                 └───────┬───────────────────────────┬───────────┘
                         │                           │
                         ▼                           ▼
        ┌──────────────────────────┐   ┌────────────────────────────┐
        │   Google Spreadsheet      │   │        Google Drive         │
        │ campaigns · donations ·   │   │  proof images (anyone w/    │
        │ payment · admin           │   │  link, view only)           │
        └──────────────────────────┘   └────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility |
|-----------|----------------|
| **Frontend pages** | Render public/admin UI, validate inputs client-side, call API, present results. |
| **`config.js`** | Hold `API_URL`, `WRITE_TOKEN`, display constants, and upload limits. |
| **`api.js`** | Single fetch wrapper; injects `writeToken` + persistent `clientId` on writes; normalizes errors with `code`. |
| **`utils.js`** | Rupiah/date formatting, progress math, HTML escaping, base64 file reading, header rendering. |
| **Apps Script** | All data access, auth, validation, caching, totals recomputation, status lifecycle, notifications. |
| **Spreadsheet** | System of record for campaigns, donations, payment info, admin accounts. |
| **Drive** | Stores uploaded payment proof images, served as shareable links. |

### Why this architecture

- **Static frontend + GAS + Sheets** is zero-cost, low-maintenance, and adequate for the
  expected small-to-medium traffic. It satisfies the deployment constraint (GitHub Pages) and
  avoids server operations.
- **Single web app entry point** keeps the API surface small and the CORS handling simple.
- **CacheService** mitigates Apps Script quota limits for public reads (Req 10).

### CORS handling

Apps Script does not respond to CORS preflight (`OPTIONS`). To avoid preflight, write requests
are sent as `Content-Type: text/plain;charset=utf-8` with a JSON string body (a "simple
request"). The server parses `e.postData.contents`. GET reads use query parameters. Responses
are `application/json` via `ContentService`.

## Data Models

### Sheet `campaigns`

| Column | Type | Notes |
|--------|------|-------|
| `id` | string/number | Unique campaign id. |
| `title` | string | Campaign title. |
| `slug` | string | URL-friendly identifier (reserved for future routing). |
| `description` | string | Need description, multi-line. |
| `target_amount` | number | Funding target in IDR. |
| `current_amount` | number | Recomputed from VERIFIED donations; auto-written. |
| `deadline` | date | Campaign end date. |
| `status` | enum | `ACTIVE` \| `COMPLETED` \| `CLOSED`. |
| `image` | string (URL) | Banner image. |
| `fund_usage` | string | Optional fund usage explanation (Req 2). |

### Sheet `donations`

| Column | Type | Notes |
|--------|------|-------|
| `id` | string | `DON-<timestamp>-<rand>`. |
| `campaign_id` | string | FK to `campaigns.id`. |
| `name` | string | Donor full name. |
| `amount` | number | Donation amount in IDR. |
| `payment_method` | enum | `Transfer` \| `QRIS`. |
| `proof_image` | string (URL) | Drive link to uploaded proof. |
| `status` | enum | `PENDING` \| `VERIFIED` \| `REJECTED`. |
| `created_at` | datetime | Server timestamp. |
| `note` | string | Optional donor note. |

### Sheet `payment` (single data row)

| Column | Type |
|--------|------|
| `bank_name` | string |
| `account_number` | string |
| `account_name` | string |
| `qris_image` | string (URL) |

### Sheet `admin`

| Column | Type | Notes |
|--------|------|-------|
| `username` | string | Case-insensitive match. |
| `password` | string | `salt:sha256hex` (Req 6.2). Never plaintext. |

### Derived values

- **Collected_Amount(campaign)** = Σ `amount` of its donations where `status == VERIFIED`.
- **Progress_Percentage** = round(Collected_Amount / target_amount × 100), capped at 100 for the bar.

## API Contract

Base URL: the deployed `/exec` web app URL. All responses share the envelope:

```json
{ "ok": true,  "data": <payload> }
{ "ok": false, "error": "<message>", "code": "<CODE>" }
```

Error codes: `BAD_ACTION`, `FORBIDDEN`, `VALIDATION`, `NOT_FOUND`, `CLOSED`, `AUTH`,
`CONFLICT`, `RATE_LIMIT`, `SERVER_ERROR`.

### GET endpoints (public, cached ≤ 5 min)

| Action | Params | Returns |
|--------|--------|---------|
| `campaigns` | – | Array of ACTIVE campaigns with recomputed totals (Req 1). |
| `campaign` | `id` | Single campaign object, or `NOT_FOUND` (Req 2). |
| `payment` | – | Payment info object (Req 3). |

### POST endpoints (require `writeToken`)

| Action | Body (besides `action`, `writeToken`, `clientId`) | Returns |
|--------|---------------------------------------------------|---------|
| `donate` | `campaign_id, name, amount, payment_method, note, proof_filename, proof_mime, proof_base64` | `{ id }` (Req 4). |
| `login` | `username, password` | `{ session }` (Req 6). |
| `adminData` | `session` | `{ stats, pending[] }` (Req 7, 8.1). |
| `verify` | `session, id` | `{ id, status, campaign_id }` (Req 8.2). |
| `reject` | `session, id` | `{ id, status, campaign_id }` (Req 8.3). |

`writeToken` is validated for every POST (Req 5.1). Unknown payload fields are ignored because
writes are mapped by sheet header (Req 5.4).

## Key Flows

### Donation submission (Req 4, 9.4, 11)

```
Donor → donasi.html
  1. Enter nominal + pick method (Transfer/QRIS) → see instructions
  2. "Konfirmasi Donasi" → form (name, amount, method, proof, note)
  3. Submit → api.submitDonation (file → base64)
        → Apps Script: token check → rate limit → field validation
          → campaign ACTIVE check → proof size/type check
          → save proof to Drive → append donation (PENDING)
          → notify admin (best-effort)
  4. Success screen ("menunggu verifikasi")
```

Client-side validation gives immediate feedback; the server re-validates authoritatively
(Req 4.7, 4.8). On failure the entered data is retained (Req 4.9).

### Verification (Req 8, 9.2, 10.2)

```
Admin → login → session token (≤ 6h, satisfies ≤ 12h)
  → adminData (stats + pending list)
  → "Terima"/"Tolak" a PENDING donation
        → status set VERIFIED/REJECTED (reject if not PENDING → CONFLICT)
        → refreshCampaignTotals() recomputes current_amount + status
        → invalidate public cache
  → dashboard reloads
```

### Campaign status lifecycle (Req 9)

`refreshCampaignTotals()` runs on every public read and after each verification. For each
campaign it recomputes `current_amount` and applies `computeCampaignStatus()`:

```
if status == CLOSED                         → CLOSED
else if target > 0 and collected >= target  → COMPLETED
else if now > endOfDay(deadline) and ACTIVE → CLOSED
else                                        → existing status (default ACTIVE)
```

Changes are written back to the sheet so the public list and admin stay consistent.

## UI / UX Design

The visual direction follows modern Indonesian crowdfunding platforms (kitabisa.com,
kotakinfaq.com): clean white surfaces, a single trustworthy green/teal accent, generous
spacing, rounded cards with soft shadows, bold collected-amount typography, thin progress bars,
and a persistent primary donate action. The typeface is Plus Jakarta Sans (with a system
fallback), which is widely used by Indonesian product UIs.

### Design tokens

| Token | Value | Use |
|-------|-------|-----|
| Primary | `#0E9F6E` (emerald) | Buttons, progress, accents. |
| Primary dark | `#057A55` | Hover, emphasis. |
| Primary soft | `#E3F4EC` | Progress track, badges, tints. |
| Ink | `#0F1B2D` | Headings/body. |
| Muted | `#64748B` | Secondary text. |
| Surface | `#FFFFFF` / bg `#F4F6F9` | Cards / page. |
| Radius | 18px cards, 14px inputs, 999px pills. |
| Shadow | soft, low-opacity, large blur. |

### Page-level design

- **Header**: white, sticky, brand logo + lightweight nav. Subtle bottom border.
- **Landing**: a warm hero band (gradient) with headline and a trust strip (e.g. total
  tersalurkan / jumlah program). Optional category chips. A responsive grid of campaign cards.
- **Campaign card**: cover image with a floating percentage pill, status badge, 2-line title,
  thin progress bar, bold collected amount with muted target, a meta row (percentage · sisa
  hari), and a full-width primary CTA. Matches Req 1.2–1.4.
- **Detail page**: large cover, title, status, a stats strip (Terkumpul · Donatur · Sisa hari),
  progress bar, description and fund-usage cards, and a **sticky bottom bar** holding the
  primary "Donasi Sekarang" CTA so it is reachable without scrolling (Req 11.3, 2.4).
- **Donation flow**: a step indicator (Nominal → Konfirmasi → Selesai). Nominal input with
  quick-amount chips; payment method as selectable cards; Transfer shows bank details with a
  copy button; QRIS shows the QR image. Confirmation form with inline validation. A celebratory
  success state. All within ≤ 5 steps (Req 11.1).
- **Admin**: simple login card; dashboard with a 4-up stat grid and a list of pending donation
  cards each showing donor, amount, method, date, proof thumbnail (click to enlarge), and
  Terima/Tolak actions (Req 7, 8.1).

### Responsive & accessibility

- Single-column layout from 360px; two-column card grid from 640px (Req 11.2).
- Tap targets ≥ 44px; primary CTAs are full width on mobile.
- Sufficient color contrast for text and buttons; status conveyed by label text in addition to
  color (badges include words, not color alone).
- Images use `alt` text; form fields have associated `<label>`s; loading and error states are
  textual, not spinner-only.

## Error Handling

| Situation | Handling |
|-----------|----------|
| API not configured | `api.js` throws a clear message; pages show it instead of a blank screen. |
| Network/API failure on read | Page shows an error notice plus a Retry control (Req 1.7, 2). |
| Validation failure on write | Server returns `VALIDATION` with a field-specific message; form keeps input (Req 4.9). |
| Proof too large / wrong type | Client and server both reject with a constraint message (Req 4.8). |
| Closed/completed campaign | Server returns `CLOSED`; donate UI hidden/disabled (Req 9.4, 9.5). |
| Acting on non-PENDING donation | Server returns `CONFLICT`; row action re-enabled (Req 8.6). |
| Expired/invalid session | Server returns `AUTH`; admin returned to login (Req 6.5). |
| Rate limit exceeded | Server returns `RATE_LIMIT`; user asked to retry shortly (Req 5.2). |
| Notification send failure | Logged; donation still recorded (Req 12.2). |

## Security Considerations

- **Admin passwords** stored as `salt:sha256(salt+password)`; created via `setupAdmin()` so no
  plaintext is persisted (Req 6.2).
- **Sessions** are random UUIDs stored in CacheService with a 6-hour TTL (≤ 12h, Req 6.3);
  required for every admin write (Req 6.5).
- **Write token** gates all writes (Req 5.1). It is visible in the static client, so it only
  deters casual abuse; rate limiting and server validation are the real protections and the
  admin session is the meaningful credential. This trade-off is documented in the README.
- **Rate limiting** keyed by a persistent client id: 5 submissions / 60s (Req 5.2).
- **Proof files** are stored "anyone with link, view only"; links are unguessable Drive ids.
- **Input validation** is enforced server-side regardless of client checks (Req 5.3).

## Testing Strategy

- **Unit (Apps Script)**: test `computeCampaignStatus` (active/completed/closed by target and
  deadline), `hashPassword` determinism, `refreshCampaignTotals` summing only VERIFIED, and
  `appendByHeader` ignoring unknown fields.
- **Integration (manual against a test deployment)**: full donate → PENDING → verify → totals
  update → cache invalidation; reject path; closed-campaign rejection; rate-limit trip; invalid
  token; expired session.
- **Frontend**: validation messages for empty name / invalid amount / missing or oversized
  proof; error + retry on simulated API failure; success screen on submit; method switching
  shows correct payment details; responsive layout at 360px and ≥ 640px.
- **Accessibility spot-check**: keyboard navigation of forms, label associations, contrast of
  primary button and badges. (Full WCAG validation requires manual assistive-technology
  testing and expert review.)
