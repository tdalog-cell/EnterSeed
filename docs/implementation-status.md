# Enterseed implementation record

Updated November 13, 2026. The original product specification remains in `msme-product-roadmap.md`.

## Architecture and baseline

React 19/TypeScript and hash navigation, Vite/Tailwind, Express 5, Node SQLite, Zod validation, existing cookie/bearer account sessions and owner/staff/admin roles are preserved. No new runtime dependencies or account systems were added. Existing shared controls, theme tokens, API client and locale catalogs are reused.

Baseline: type check and production build passed. The sandboxed API tests could not connect to the local server; rerunning with authorized loopback access passed. All execution here uses disposable test databases, not the production database.

## Requirement checklist

Allowed statuses: Not started, In progress, Implemented, Tested, Blocked.

| Milestone | Status | Implementation and evidence |
| --- | --- | --- |
| Repository discovery and baseline | Tested | Existing routes, database initialization, authentication, components, deployment and tests reviewed |
| E01 profile and personalized plan | Tested | Profile editing, three deterministic actions, editable titles/statuses, hide/restore, progress, tool links and preserved history |
| E02 calendar and in-app reminders | Tested | Monthly view, Manila date boundaries, category/status filters, create/edit/reschedule/delete, action/opportunity/debt links, dashboard due indicator |
| E04 staff support | Tested | Owner requests/conversations, staff assignments/status/follow-up dates, public responses, private notes, search/status filters and server-enforced permissions |
| E03 opportunity catalog | Tested | Staff CRUD/publish/unpublish/review fields, HTTPS sources, review-date validation, expired-result exclusion, filtering, saved records and application reminders |
| E05 product costing | Tested | Persistent scenarios, fixed batch costs, percentage fees, margin/markup formulas and invalid-input handling |
| E06 supplier comparison | Tested | Two or three quotes, minimum-order quantities, landed costs, lead times/terms, saved comparisons and cost transfer |
| E07 guides and localization | Implemented | Seven English/Filipino guides and new owner flows in existing catalogs; Filipino profile/reminder browser journey tested; independent fluent-language review pending |
| Dashboard/navigation integration | Tested | Profile overview, actions/progress, reminders, saved-opportunity and support counts; existing tools preserved |
| Analytics | Tested | Staff-only aggregates for useful actions, weekly activity, repeat use, completion and first response time |
| Pilot feedback mechanism | Tested | Support category `pilot_feedback`, usable by owners and staff |
| Real MSME interviews and pilot | Not started | Materials below; no participant findings or outcomes claimed |
| Production release | Not started | Local implementation and verification only; checklist below must be completed against the deployment environment |

## Code and data map

| Area | Files | Storage/API |
| --- | --- | --- |
| Shared rules/validation | `src/domain/guidance.ts` | Profile, dates, costing, comparisons, recommendations |
| Backend | `server/guidance.ts`, registration in `server.ts` | `/api/guidance/*`; migration runs at startup |
| Profile/dashboard | `src/features/guidance/PlanView.tsx`, `DashboardView.tsx`, `AuthContext.tsx` | business_profiles, business_actions |
| Calendar | `CalendarView.tsx` | business_reminders |
| Opportunities | `OpportunitiesView.tsx` | opportunities, saved_opportunities |
| Support | `SupportView.tsx` | support_cases, support_replies |
| Costing/quotes | `WorksheetsView.tsx` | business_worksheets, scoped by kind/owner |
| Guides/metrics | `GuidanceView.tsx` | Guides are version-controlled locale content; useful_events aggregates |
| Reusable forms/API | `shared.tsx` | Loading, retry, save feedback, accessible field labels |
| Navigation | `App.tsx`, `AppShell.tsx`, Finance/Suppliers/Efiling views | Protected routes and contextual tool links |
| Translation | `locales/en.json`, `locales/fil.json` | `messages.guidance`; other languages use existing fallback |
| Verification | `src/domain/guidance.test.ts`, `tests/guidance*.ts`, `tests/guidance_browser.py` | Rules, API/ownership, migration and real browser journeys |

Migration v1 adds tables and indexes only. JSON payloads store validated flexible profile/reminder/worksheet fields; account ownership, action uniqueness, saved-opportunity relationships and support conversations use relational columns and foreign keys. New private records cascade on account deletion. Staff author/reviewer references become null if a staff account is deleted. `guidance_audit` records actor, entity, operation and time without copying message bodies or financial figures.

Existing data exports now include the account's new records. Internal support notes are excluded even from owner exports. Global opportunity content remains after a user deletes their account. The migration does not change or remove legacy records.

## Stage reports

1. **Core plan:** shared rules, migration/API, profile/action UI and dashboard integration implemented. Persistent action keys prevent duplicate creation; goal/stage changes activate the matching set and retain historical progress. Profile changes also refresh the existing account context. No existing finance records changed.
2. **Reminders/support/catalog:** account-scoped APIs and UI added. Staff routes require a real staff/admin session rather than accepting a public client role. The catalog starts empty. Existing legacy program search remains available with unreviewed-example labeling and no approval-like percentage badges.
3. **Costing/comparisons/guides/analytics:** saved calculations, cost handoff, educational content, feedback and aggregate metrics implemented. Calculator results do not write into the cash ledger or silently complete recommendations.
4. **Verification:** unit/API tests and original browser regressions passed; expanded browser journeys A–E and mobile/Filipino checks passed. Browser testing found and fixed disappearing save feedback after component remounts. No browser JavaScript errors were recorded. See the commands and artifacts below for reproducibility.

Final local results: 41 unit/API/migration tests passed; type check and production build passed. The original 25 browser checks and seven new grouped browser checks passed. A snapshot of a disposable browser-test database was created with the backup helper and passed SQLite integrity/foreign-key checks. Production backup restoration remains a release task.

## Test commands and coverage

```powershell
npm run lint
npm test
npm run build
npm run test:browser
npm run test:guidance-browser
```

The browser runner starts/stops Node directly with a fresh `.preview/browser-test-*` database and blank external-provider credentials. Python Playwright and Microsoft Edge are required; the existing `.preview/python` fallback is supported. The test suite may need loopback access outside a network-restricted sandbox.

- Domain tests: deterministic recommendations, goal/stage changes, margin/markup/percentage fees, invalid inputs, MOQ comparisons, leap dates and Manila midnight.
- API tests: authentication, owner/staff boundaries, private notes, persistence, history, publication validation, saved opportunities/reminders, costing/comparisons, metrics and export/deletion.
- Migration test: repeated application preserves existing records and passes SQLite integrity/foreign-key checks.
- Original browser suite: 25 checks preserving finance, documents, marketing, suppliers, staff review, registration, privacy, language, theme and mobile navigation.
- New browser suite: seven grouped checks covering journeys A–E, all ten new mobile routes, Filipino profile/reminder flow and no JavaScript page errors.
- Browser checks exercise labeled form controls and existing keyboard navigation. This is not a full WCAG conformance audit or an assistive-technology study.

Artifacts: `.preview/browser-results/` and `.preview/guidance-browser/` contain screenshots/results; excluded from Git. Mobile plan and Filipino calendar screenshots were visually inspected.

## Metric definitions

All event times are stored in UTC. The reporting window is a rolling seven days; repeat-use calendar dates use Asia/Manila. Owner business metrics exclude staff/admin accounts.

- **MSMEs completing useful actions:** distinct owners with `action_completed`, `costing_saved` or `comparison_saved` in the window. Saved calculations count on creation, not every edit.
- **Weekly active MSMEs:** distinct owners with any recorded guidance event in the window; this measures meaningful feature activity, not visits/logins.
- **Repeat users:** owners with events on at least two distinct Manila dates in the window.
- **Recommendation completion:** completed active recommended actions divided by all active recommended actions, including hidden actions. This is a current snapshot, not a weekly cohort metric.
- **First response time:** average elapsed hours from request creation to first public response by another account with staff access. Internal notes, owner messages and unresponded requests are excluded. Weekends are included; this is not the roadmap's proposed business-day SLA measure.
- Event aggregates also show distinct accounts and event counts. No financial values, profile details or message contents are stored in events.

## Interview and pilot materials

Recruit 8–12 consenting MSME owners across business stages/sectors. Record a participant code rather than unnecessary personal data. Ask: What did you need help with last week? Which tasks or dates were missed? How do you currently track money and supplier offers? Which language/device do you use? Which proposed action would help you now? Observe a real task with permission; separate observation from assumptions.

For the 15–20-person pilot, use scenarios A–E from the browser suite with each participant's own safe sample inputs. Record task completion, time, where help was needed, confusing wording, perceived usefulness and the next requested improvement. Use Support → pilot feedback for participant submissions. Obtain consent before collecting notes or screenshots; avoid capturing sensitive business documents. No interviews or pilot sessions have been conducted by this implementation.

## Release checklist

- [ ] Assign content/support owners and complete fluent Filipino review.
- [ ] Enter real opportunities only after official-source review; no test fixtures are seeded in production.
- [ ] Back up the deployment database using the hosting snapshot facility or the read-only-source helper below; protect backup access.
- [ ] Restore a backup into a separate staging database and run checks with the target Node version. Never test against the production path.
- [ ] Run the five test commands and inspect the pilot journeys against the configured deployment.
- [ ] Confirm persistent disk/DATABASE_PATH, TLS, allowed origins, staff accounts and operational monitoring.
- [ ] Deploy the normal build/start commands. Migration v1 runs before serving the new routes.
- [ ] Confirm owner/staff login, profile save, reminders and support after deployment.
- [ ] Monitor errors, outstanding support and content freshness before widening rollout.

```powershell
python scripts/backup_database.py PATH_TO_SOURCE.sqlite PATH_TO_NEW_SNAPSHOT.sqlite
```

The helper requires Python 3, uses SQLite's consistent backup API, checks integrity and refuses an existing destination. For rollback, prefer restoring the previous application version while retaining the additive tables. Do not restore an older database over newer user activity without an explicit recovery decision and a fresh backup.

Render configuration remains in `render.yaml` (`npm ci && npm run build`, `npm start`, persistent `/var/data`). No hosting changes or production deployment were performed.

## Remaining limitations and next priorities

- Human source verification and real user research remain essential operational tasks. Catalog “reviewed” means a staff member recorded a review; Enterseed does not independently verify providers or submit applications.
- Reminder dates are date-only Manila schedules; in-app indicators update when the workspace loads. There is no background push/email/SMS, recurring schedule engine or full offline synchronization.
- Recommendations use goal and stage rules, while sector/products/challenges provide profile context; there is no learned ranking or eligibility prediction.
- Existing anonymous inquiries remain in the original staff console. New authenticated requests use the follow-up desk; historical anonymous inquiries are not automatically associated with accounts by matching email.
- Opportunity relevance currently uses business stage; sector/location are explicit search filters. Staff review dates and manual needs-review/expired statuses need ongoing maintenance.
- Owner flow text and seven guides have Filipino translations. Older application screens and some detailed validation/administrative metric copy retain English fallback. No independent native-language certification is claimed.
- Guides are source-controlled content, not an additional database CMS. Cost import is an explicit one-time handoff, not live synchronization of quote changes.
- Inventory/customer tracking, external notifications and payment integration remain outside this implementation.

Next product priority: run the real pilot and address observed friction before expanding the feature set.

## Navigation and alignment follow-up — November 13, 2026

- Replaced the long flat sidebar with one-open-at-a-time collapsible categories: Business management, Finance, Markets & suppliers, Help & learning, Account & resources, plus Staff tools for authorized accounts. Dashboard remains directly accessible.
- Desktop and mobile share the grouping. Native buttons expose expanded state and controlled lists; route changes open the containing category. Search still includes all permitted tools. Hidden links are excluded from the mobile focus trap.
- Left-aligned wrapped navigation labels, including Supplier quotation comparison.
- Repaired the supplier header grid: heading and actions share the main column, with the photograph in its own column on wide displays. Actions wrap at narrower widths.
- Aligned dashboard action/summary rows, replaced the unstyled progress bar with a thin themed track, removed the empty 0/0 indicator, and display an overdue warning only when a reminder is due.
- Verification: type check/build passed; all 25 existing browser checks passed. `python tests/run_browser_flows.py tests/navigation_browser.py` passed desktop/keyboard/search checks, populated/empty dashboards, 768px and 390px layouts, mobile dropdown behavior, and staff grouping with no JavaScript errors. Screenshots in `.preview/navigation-browser/` were visually inspected. No database changes.
