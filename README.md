# Enterseed Platform (React + Vite + Express)

Enterseed is a modern MSME support platform focused on South Cotabato and nearby SOCCSKSARGEN communities, rewritten as a full-featured React single-page application with a TypeScript Express backend and SQLite database.

## Features

- **Boss Narra AI Advisor**: Grounded informational guidance on finance, marketing, and official regulatory filing steps for Philippine MSMEs, backed by verified government signposts (DTI, BIR, DOST, South Cotabato, Koronadal).
- **Financial Checkup & Practice Sets**: Private account-scoped monthly assessment calculating operating profit, cash runway buffer in months, estimated balance sheets, and debt servicing ratios with actionable recommendations.
- **Marketing Workspace & 4Ps Framework**: Guidance tailored for Region 12 enterprises, including an interactive shipping and freight subsidy calculator.
- **Reviewed Supplier Directory & Interactive Map**: Leaflet map centered on South Cotabato, filtering verified local suppliers in packaging, raw materials, logistics, and media. Includes application opt-ins and introduction workflows.
- **Document & Feasibility Generator**: Draft structured business plan outlines and feasibility studies locally with download (HTML) and printing options.
- **Government E-Filing & Readiness**: Anonymous 30-day readiness assessments with instant self-service deletion, alongside direct links to DTI BNRS, BIR ORUS, SSS, PhilHealth, and Pag-IBIG portals.
- **Staff Review Console**: Secure administrative desk with 5-point compliance checks (identity, business proof, contact, location, publication consent) to approve or reject supplier applications, withdraw active listings, and manage inquiries.
- **Trilingual Support**: English, Filipino (Tagalog), and Hiligaynon (Ilonggo) translations with dynamic catalog fallbacks.

## Tech Stack

- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS, Lucide icons, Leaflet.
- **Backend**: Node.js 22, Express 5, `node:sqlite` (DatabaseSync), Zod schema validation, Helmet security headers.
- **Port**: Listens on port 3000 (`0.0.0.0`).

## Development

```bash
npm install
npm run dev
```

Build for production:

```bash
npm run build
npm start
```

## Verification

Run `npm run lint`, `npm test`, and `npm run build` for type, regression, and production checks.
With Python Playwright and Microsoft Edge installed, `npm run test:browser` exercises owner
and staff workflows against a fresh local test database. Build first. See
[the interface review](docs/interface-review.md) for coverage, screenshots, and limitations.
