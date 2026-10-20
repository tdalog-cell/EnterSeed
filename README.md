# Enterseed Platform

Enterseed is a multi-page MSME support website focused on South Cotabato and nearby SOCCSKSARGEN communities. The site combines a source-aware registration assistant, local-only document drafts, a reviewed supplier directory, a server-backed readiness assessment, and a human support route.

This is a small Node/Express deployment, not a static-only site. The server stores submissions in SQLite and serves the HTML pages and API from one origin. Payment processing, government filing, supplier identity checks, and professional legal or financial advice are not provided.

## Architecture

```text
enterseed-platform/
├── css/
│   ├── main.css
│   ├── components.css
│   └── responsive.css
├── js/
│   ├── app.js
│   ├── chatbot.js
│   ├── supplier-hub.js
│   ├── pricing.js
│   ├── form-handler.js
│   └── admin.js
├── logos/                   # User-provided brand marks
├── server/
│   ├── data/                # Runtime SQLite file; ignored by Git
│   └── index.js             # Same-origin API, validation, retention, review gates
├── index.html
├── efiling.html
├── suppliers.html
├── pricing.html
├── about.html
├── onboarding.html
├── admin.html               # Noindex staff review console
├── .env.example
└── README.md
```

## Run locally

Requirements: Node.js 22.13+ (Node 24 recommended) and npm.

```powershell
cd enterseed-platform
npm install
Copy-Item .env.example .env
```

Set a fresh `ADMIN_API_KEY` value in `.env` before using the staff review console. Generate one locally with:

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"
```

Then start the API and website:

```powershell
npm start
```

Open `http://127.0.0.1:5173`. `npm run dev` starts Node watch mode. The previous Python static server cannot support API submissions; use this Express server instead. Do not commit `.env`, `server/data/*.sqlite`, or API credentials.

## Environment settings

Copy `.env.example` to `.env` and set:

- `ADMIN_API_KEY`: unique high-entropy secret required by `/admin.html` and `/api/admin/*`.
- `GEMINI_API_KEY`: optional server-only Google AI Studio key. Leave empty to use the offline source-aware fallback.
- `GEMINI_MODEL`: optional model override; defaults to `gemini-2.5-flash`.
- `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `SUPPORT_EMAIL`: optional Resend email notification settings. Without these, inquiries still enter the staff queue and the UI says email notification is not configured.
- `NOMINATIM_USER_AGENT`: identify your deployed app and include a real contact route as required by Nominatim’s usage policy.
- `HOST`, `PORT`, `DATABASE_PATH`: server binding and SQLite path. The local default binds to `127.0.0.1`; configure a trusted host and HTTPS reverse proxy for deployment.
- `TRUST_PROXY=true`: enable only when the app is actually behind a correctly configured trusted reverse proxy.

The admin key and AI/email keys are secrets. Never paste them into chat, commit them, or put them in browser JavaScript. Use your hosting provider’s secret manager for deployment.

## Supplier opt-in and review

The public API returns only records with `status=active`, a recorded `verified_at`, and an unexpired annual review. New applications are private and pending. They are not “verified” merely because someone submitted a form.

Staff open `/admin.html`, enter `ADMIN_API_KEY`, then review the pending queue. Approval requires checking all five controls:

1. Applicant identity.
2. Business evidence.
3. Contact details.
4. Municipality/location.
5. Explicit permission to publish the listing.

Enter meaningful review notes before approving. Follow up with the applicant through their private email to request supporting documents through an appropriate secure channel; the public form does not accept identity-document uploads. Approved listings show the review date and expire from the public directory after 12 months unless reviewed again. Withdrawal clears contact details and removes the listing from public search. Keep this review process assigned to a real staff owner before accepting public applications.

Public contact details are optional and require a separate checkbox. Otherwise visitors can ask Enterseed to make an introduction. Supplier and map data are not seeded with fictional companies or addresses.

## Privacy and retention

- Readiness assessment: collects stage, chosen needs, municipality, and consent only; it does not ask for name, email, phone, or account. Data is stored server-side for up to 30 days. A random deletion token is held in `sessionStorage` for the current browser session so the visitor can request immediate deletion. The token is not the assessment data.
- Contact inquiries: requires consent and is retained for up to 180 days. `/admin.html` provides authorized support staff a queue, reply link, and delete action. Configure Resend if email alerts are needed; otherwise staff must check the queue.
- Pending supplier applications: private contact and listing details are retained up to 90 days. Rejected applications are retained for up to 30 days after decision. Approved private contact information is retained while the listing is active and cleared when the listing is withdrawn or annual review expires. Public listings are unpublished after one year unless approved again.
- SQLite is stored under `server/data/` and excluded from Git. This does not by itself provide production-grade encryption at rest, backups, or data-subject workflows. For deployment, use encrypted storage, restricted host access, protected backups, HTTPS, a privacy notice reviewed for applicable Philippine data-protection requirements, and a named data controller. Staff must honor deletion requests and keep access credentials private.

## Contact and email

The browser posts contact forms to `/api/inquiries`; it does not call Formspree directly. To enable notification, create a [Resend](https://resend.com/) account, verify a sending domain, and set the three Resend environment variables. The API stores the inquiry before attempting notification and reports whether email was delivered. For a small pilot, check the staff inquiry queue regularly even if Resend is configured.

Supplier applications similarly enter the private queue and notify the support mailbox if configured. Supplier introduction requests are sent only for active, reviewed listings. The visitor explicitly agrees before their message is forwarded.

## AI and source review

The browser calls `/api/assistant`; the Gemini key stays on the server. Configure `GEMINI_API_KEY` using Google AI Studio and review the provider’s current model availability, free-tier quota, privacy, and terms. If the key is unset or the request fails, the server returns conservative local fallback guidance.

Each answer includes relevant source links and a **last link checked** date. Link-check date does not mean the source’s policy content was fully reviewed. As of 2026-10-19, the official South Cotabato and Koronadal sites were reachable. DTI’s BNRS portal rate-limited automated access, and the DTI FAQ content could not be independently fetched; those limitations are shown in the UI. Recheck source content periodically and update the date and review note only after a person verifies it. The fallback is a prompt/reference snippet, not a full searchable legal knowledge base or production RAG system.

## Maps

Leaflet 1.9.4 and OpenStreetMap tiles are loaded from public endpoints; attribution is displayed. Nominatim requests are proxied by the server, use `NOMINATIM_USER_AGENT`, are limited to one request per IP per second, and are cached for 30 days. Lookups are user-initiated and municipality-level; the app does not geocode applicants in bulk. Configure the user-agent with your real app identity and contact route before deployment. Follow the [Nominatim usage policy](https://operations.osmfoundation.org/policies/nominatim/). Public services can rate-limit or change; use a compliant provider or host your own service as traffic grows.

## API route summary

- `GET /api/health`
- `GET /api/suppliers`
- `GET /api/places/search?q=...`
- `POST /api/assistant`
- `POST /api/readiness` and `DELETE /api/readiness/:deleteToken`
- `POST /api/inquiries`
- `POST /api/supplier-applications`
- `POST /api/suppliers/:id/contact`
- Authenticated `GET /api/admin/supplier-applications`, `POST /api/admin/supplier-applications/:id/approve`, `POST /api/admin/supplier-applications/:id/reject`, `GET /api/admin/suppliers`, `POST /api/admin/suppliers/:id/withdraw`, `DELETE /api/admin/suppliers/:id`, `GET /api/admin/inquiries`, and `DELETE /api/admin/inquiries/:id`.

All JSON input is validated with Zod, public submissions are rate-limited, security headers are enabled, and the admin API uses bearer authentication. Review the implementation and deployment environment before handling real personal or business records.
