# Enterseed interface review

Audience: South Cotabato business owners and staff reviewers, equally prioritized.
Reference: https://ui.shadcn.com/create

## Design direction

Preset: [`b1x9M8ZeJW`](https://ui.shadcn.com/create?preset=b1x9M8ZeJW).
The official generated source uses Maia, taupe base/theme, amber charts, Raleway
headings, Outfit body text, HugeIcons, medium radius (0.625rem), subtle menu accents,
and translucent menus. Its exact OKLCH light/dark tokens are preserved in
`src/preset.css`; approximate light palette swatches: white #FFFFFF, canvas tint
#FAF9F7, secondary #F3F1F1, border #E7E4E2, primary #2A211F, text #191715.
Amber is reserved for chart series and the checkup prompt. Success/error colors
remain semantic. Headings use 24–32px, sections 16px, body 14–15px, metadata 12px.

The brief review replaces our earlier plum/orange proposal with the user's exact
preset. Maia's pill controls and soft panels fit the requested reference; the
business task layout remains specific to Enterseed instead of copying a demo page.

The chosen layout keeps left-aligned navigation, a quiet toolbar, and a broad work area:

```
Workspace       | Search / language / account
----------------+-------------------------------------
Overview        | Greeting              Primary action
Finance         | Business snapshot
Marketing       | Next steps           Business help
Suppliers       | Saved work / status / open
Registration    | Everyday tools
Documents       |
Staff review    | Queue tabs / search / sort / records
```

An alternative large promotional hero would push tasks below the fold. The selected
layout spends its emphasis on the amber rule at the financial checkup prompt and
uses compact records for saved work. This revises the generic repeated-card pattern
into a task-oriented workspace specific to business preparation and staff review.
Sentence-case labels, restrained motion, visible focus, and mobile wrapping apply
throughout. Existing account permissions and real/demo distinctions remain in place.

## Preset integration

- Exact official light/dark CSS values from
  https://ui.shadcn.com/init/v0?preset=b1x9M8ZeJW&base=base are in `src/preset.css`.
  The CLI `shadcn preset decode b1x9M8ZeJW --json` independently confirmed all settings.
- Existing React components retain their behavior and use Maia's pill controls,
  rounded panels, medium radius scale, and translucent menus with subtle selections.
  Control heights remain 36–44px for the existing mobile workflows.
- Raleway headings and Outfit body text load through Google Fonts. HugeIcons replaces
  Lucide throughout the app; per-icon imports keep unused icons out of the bundle.
- Cash-flow charts use amber series with revenue/expense labels. Existing semantic
  success and error tones remain distinct in both themes.
- Existing workspace token names map to the preset; `muted` and `accent` retain
  shadcn's meanings. Enterseed's small amber emphasis uses a separate `highlight` token.

## Implemented improvements

- Shared buttons, headings, surfaces, sidebar, and mobile sign-in spacing follow
  the reference's quieter visual hierarchy while retaining Enterseed's branding.
- Finance tools use compact navigation. Staff supplier tables become stacked records
  on phones, keeping withdrawal and deletion actions visible.
- Dashboard progress now reads the actual registration draft and document library.
  A five-item saved-work list filters by document/registration and reopens a selected document.
- Workspace search supports arrow keys and Enter; the skip link focuses content
  without changing the application route.
- Staff use their authenticated account. The obsolete second admin-key gate is removed.
  Queues support search, chronological/name sorting, status filters, and clear filters.
- Staff approval/rejection buttons prevent duplicate submissions and provide feedback.
  Notes and rejection reasons start blank so staff record their own review.
- Language changes persist to the signed-in account across reloads.
- Tax tasks use labeled native checkboxes; review rating controls have accessible names.
- Cash transaction editing preserves decimal amounts. Review averages refresh after posting.
- Program search accepts solo owners with zero employees and surfaces API errors.
- The pricing switch no longer advertises a uniform discount that did not fit every plan.

## Verification — November 12, 2026

Rechecked after applying preset `b1x9M8ZeJW`: `npm run lint` and `npm run build` pass. `npm test` passes 28 tests.
`npm run test:browser` passes 25 workflow checks with zero JavaScript page errors.
The browser suite runs the production build in headless Edge against a new SQLite
database on a randomly selected local port. It creates only fictional test accounts.

| Area | Browser checks |
| --- | --- |
| Accounts | Registration, show/hide password, logout/login, owner/staff route permissions, test-account deletion |
| Dashboard | Saved checkup, calculated snapshot, three progress steps, saved-work filters, selected-document resume |
| Finance | Entry creation, decimal editing, save/reload, CSV import/export, entry deletion, debt creation, tax checkbox, equipment inputs, summaries |
| Marketing | All three formats, generated drafts, persistence after reload |
| Documents | Business plan, feasibility, loan proposal, library save, editing/resaving, PDF download |
| Registration | Draft save/reload, grant search, credit search, official portal links |
| Suppliers | Application, filtering/sorting, saved inquiry, review/rating refresh, map interaction, illustrative shipping calculator |
| Staff | Account access, search/sort, approval checks, rejection reason, publication, status filtering, withdrawal, inquiry deletion, failure/retry |
| Settings | Four language preferences saved to account, dark/light theme persistence |
| Privacy/pricing | Data export, cancel deletion, pricing period controls |
| Accessibility/layout | Keyboard search, skip link, mobile drawer dismissal, all 12 workspace routes at 390px, staff mobile records, light/dark screenshots |

Screenshots and downloads are in `.preview/browser-results/`; `results.json` records
the passing checks. These are ignored review artifacts, not application data.

### Repeat the checks

Install Python Playwright (`python -m pip install playwright`) and have Microsoft Edge
available. The runner also recognizes the project-local `.preview/python` installation
used during this review. Then run:

```
npm run build
npm run test:browser
```

The runner starts Node directly and stops it in `finally`; it avoids shell-child cleanup
problems observed with the generic server helper on Windows. Test fixtures remain under
`.preview/browser-test-*` for inspection. `BROWSER_CHANNEL` can select another installed
Playwright-compatible browser channel.

## Scope and follow-up opportunities

This is broad workflow coverage, not a guarantee for every possible input or browser.
Live Gemini generation and email delivery were not exercised: provider keys are deliberately
blank in the isolated test server. Government sites are links, and Enterseed does not submit
filings. Program criteria, funding amounts, and legal/tax copy were not revalidated against
current official rules during this interface pass. Language selection works, but many existing
view labels still fall back to English.

Useful next projects are a dated, officially maintained program-reference catalog; full
translation of the remaining view labels; and an account-backed due-date/reminder system
for owners with a staff follow-up queue. Those require content ownership and notification
preferences beyond the local interface changes implemented here.
