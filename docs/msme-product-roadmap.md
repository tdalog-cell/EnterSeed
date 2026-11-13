# Enterseed MSME product roadmap

Prepared November 13, 2026. Status: proposed plan; features below are not yet implemented.

## Objective and capacity

Help South Cotabato and nearby SOCCSKSARGEN MSMEs take useful business actions each week, while keeping support and content maintenance manageable for a small team.

The user confirmed a small team. Planning assumption: one primary developer, a product lead, and a content/support owner, with part-time design/QA support. People may hold multiple roles. The 12-week schedule is a planning estimate from kickoff, not a delivery commitment; revise it after the first two weeks based on actual availability.

Primary outcome: number of distinct MSMEs completing a useful action each week, such as updating business records, completing a preparation task, or recording a supplier inquiry outcome.

## What the project already contains

Reviewed README.md, the existing interface review, dashboard, onboarding, finance, marketing, registration, staff views, and backend routes/schema. This is a code-informed product plan, not a new live usability test or legal-content review.

- Financial checkup, cash ledger with CSV import/export, debt records with due-date fields, tax checklist, equipment comparison, and financial summaries.
- Marketing drafts, document creation and saved documents, Boss Narra assistance.
- Supplier directory/map, applications, inquiries, messages, and reviews.
- Registration preparation, program/lender searches, staff review, language preferences, account export/deletion.
- Dashboard next steps currently use three fixed activities; onboarding primarily handles language selection.
- Existing interface-review notes identify remaining English fallback text and a need for maintained program references and reminders.

Improve these connected workflows before introducing additional standalone modules.

## Prioritized additions

| ID | Priority | Addition | MSME benefit | Small first release | Ongoing work |
| --- | --- | --- | --- | --- | --- |
| E01 | P1 | Business profile and personalized action plan | Owners know what to do next for their stage and goals | Save sector, stage, main goal and municipality; show three editable next actions with explanations; reuse existing account fields | Product lead reviews task templates monthly |
| E02 | P1 | Task calendar and reminders | Owners can track renewals, repayments and follow-ups | User-entered due dates, upcoming/overdue list, complete/snooze actions, in-app reminders; link to existing debt records | Support handles date questions; developer monitors reminder failures |
| E03 | P1 | Maintained opportunities catalog | Owners can find relevant support and understand the next step | Upgrade existing searches with official sources, review dates, locations, eligibility notes, closing dates where verified, and saved opportunities | Content owner reviews published entries weekly |
| E04 | P1 | Staff follow-up desk | Users get a visible response and the team avoids missed requests | Extend current inquiry queues with assignee, status, next follow-up date, internal notes and owner-visible updates | Support checks queue every workday |
| E05 | P2 | Product costing and pricing worksheet | Sellers can see what remains after production and selling costs | Materials, packaging, labor, allocated overhead, selling fees, batch yield, price, margin and markup; save scenarios | Product owner checks terminology and examples |
| E06 | P2 | Supplier quotation comparison | Buyers can compare the real cost of sourcing | Manual comparison of up to three quotes including delivery, minimum order, lead time and payment terms; link to existing suppliers | Support maintains directory quality; suppliers need not adopt new software |
| E07 | P2 | Learning linked to tasks | Beginners can learn while completing real work | Five short guides attached to finance, pricing, registration and supplier tasks; local examples and translated core flows | Content owner reviews one guide per week |
| E08 | Later | Lightweight inventory | Retail/production users can spot shortages | Pilot only after interviews establish demand; products, stock movements, reorder level and export | Additional reconciliation and support workload |
| E09 | Later | Customer/order tracker | Sellers can follow up on inquiries and orders | Pilot only after repeat demand; contact, order status, next action and consent-aware contact handling | Additional customer-data maintenance |

P1 is the first release commitment to scope; P2 is conditional backlog. Do not promise all nine in 12 weeks.

## Important product decisions

1. Start personalization with transparent rules. For example, an owner choosing “improve cash flow” sees “record this week's transactions,” “review upcoming repayments,” and “compare product costs.” Let owners edit or dismiss these suggestions.
2. Treat saved preparation and actual completion separately. A saved registration draft must not mean a permit was issued. A saved opportunity must not mean an application was submitted or approved.
3. Start reminders in-app. Email requires an opted-in address, delivery handling, unsubscribe/preferences, retries and duplicate prevention. Add it after the core task flow works. Leave SMS out of the first release to limit recurring costs.
4. Keep owner-entered dates distinct from official deadlines. Official templates require a source, jurisdiction, applicability notes and a review owner; never apply one date universally to all MSMEs.
5. Upgrade current program matching before expanding it. Current source contains hard-coded program descriptions, terms and match scores. Replace unsupported approval-like percentages with explainable relevance reasons. Recheck live terms with the issuing organization before publication.
6. A link check is not a content verification. Keep “last link checked,” “last content reviewed,” and “application closing date” distinct. Expired items should leave active results; stale entries need a visible review state.
7. Let Boss Narra suggest an action that the owner reviews and saves. Start with the same task templates and reviewed sources used by the rest of the app.
8. Keep new owner records account-scoped and include them in existing export/deletion flows. Staff access should follow the support role; internal notes must stay separate from user-visible updates.
9. Translate the new complete journeys, including errors and empty states, with a fluent reviewer for each supported language. Test phone use and interrupted connections. Full offline synchronization is a later project.

## Twelve-week delivery plan

| Period | Deliverable | Lead | Checkpoint before moving on |
| --- | --- | --- | --- |
| Weeks 1–2 | Interview 8–12 local MSMEs; observe current tasks; establish baseline metrics; draft profile/action templates; inventory existing program claims | Product + content | Choose the two most frequent actionable needs; agree first-release scope and owner for every backlog item |
| Weeks 3–4 | E01 profile and editable next actions; basic task storage; event measurement; first core translations | Developer + QA | Five pilot users can choose a goal and save/complete an action without coaching; data survives reload |
| Weeks 5–6 | E02 due dates and in-app reminders; E04 basic assignee/status/follow-up queue | Developer + support | Date changes/completion update reminders correctly; staff can assign and close a request; owners can see permitted status updates |
| Weeks 7–8 | E03 reviewed opportunity catalog; staff publishing controls; saved opportunities linked to action lists | Content + developer | Every published entry has an official source, reviewer and review date; expired entries leave active results |
| Weeks 9–10 | Pilot with roughly 15–20 MSMEs; resolve usability/data issues; finish core translations; choose one P2 addition only if capacity permits | Product + QA | Pilot users repeat the core tasks; support queue is manageable; unresolved data-loss or access issues block expansion |
| Weeks 11–12 | Release the improved core; publish short guides; review outcomes and next quarter's scope | Whole team | Release checks pass, backup recovery is exercised, content/support ownership is active and metrics are available |

If P1 work slips, move P2 work to the next cycle. If interviews show product costing is the dominant need, the product lead may swap it into scope explicitly rather than adding it on top.

## Team responsibilities

| Role | Accountable for | Weekly output |
| --- | --- | --- |
| Product lead / you | Priorities, scope, interviews, partnerships and release decisions | Updated board, pilot feedback and a short decision log |
| Developer | Implementation, data changes, deployments, operational monitoring | One small reviewable increment and relevant checks |
| Content and support owner | Official reference checks, supplier review, responses and user guidance | Reviewed content list and resolved/assigned support cases |
| Design/QA contributor | Phone usability, accessibility, language quality and workflow verification | Tested acceptance criteria and reproducible issues |

## Board and management routine

Use your existing task tool or a shared board with these columns:

Backlog → Ready → In progress → Review/test → Pilot → Done

Every item needs an ID, problem statement, owner, priority, acceptance criteria, dependency, estimate, target week and evidence of completion. Keep no more than two development items in progress across this assumed team. Limit each developer to one primary feature at a time.

- Monday, 30 minutes: review user evidence, support backlog and capacity; select the week's deliverable.
- Each workday, 10–15 minutes: assign new support requests, identify blockers and check overdue follow-ups.
- Midweek, 30 minutes: review official-content changes and upcoming expiry dates.
- Friday, 45 minutes: demonstrate the increment, review metrics, capture feedback and update priorities.
- Every two weeks: release a small increment after acceptance checks; re-estimate the next two weeks.
- Monthly: review spending, feature use, translation coverage, content freshness and a sample of support outcomes.

Suggested capacity allocation: 60% planned product work, 25% maintenance/support, 15% discovery/content/measurement. Adjust after observing the team's first two weeks.

## First backlog items and acceptance criteria

| ID | First actionable ticket | Acceptance criteria | Dependency |
| --- | --- | --- | --- |
| E00 | Pilot discovery and measurement baseline | 8–12 interviews summarized; repeated problems ranked; events and metric definitions agreed | None |
| E01a | Save business stage and goal | Owner can skip, save and edit; existing profile details reused; inaccessible to another account; included in export/deletion | E00 |
| E01b | Show three next actions | Suggestions explain their reason; owner can edit/dismiss; completion persists; no duplicate task creation on reload | E01a |
| E02a | Add due dates and in-app reminders | Upcoming, due-today and overdue are correct in Asia/Manila; rescheduling and completion remove obsolete reminders; debts are linked without duplicate entry | E01b |
| E04a | Assign and follow up on inquiries | Staff can assign/status/date a case; changes are recorded; owner-visible updates exclude internal notes; closed cases leave active queue | Existing inquiry flow |
| E03a | Publish reviewed opportunities | Source/reviewer/review date required; jurisdiction and status shown; expiration removes active recommendation; edits are recorded | Content inventory |
| E03b | Save opportunity as a next action | Owner can save, unsave and create a linked preparation task; stale/closed opportunity status remains visible | E03a + E01b |
| E05a | Cost one product or batch | Correct margin versus markup labels; batch yield and percentage selling fees handled; zero-yield and invalid-price inputs explained; scenarios save and reload | Pilot demand and available capacity |

## Measures and proposed pilot targets

These are starting hypotheses, not industry benchmarks or observed results. Establish actual baselines in weeks 1–2 and review targets with the pilot cohort. Always show counts alongside percentages for a small sample.

| Measure | Definition | Proposed target |
| --- | --- | --- |
| Activation | New pilot accounts completing one useful action within seven days / eligible new pilot accounts | At least 60% |
| Week-four return | Activated accounts performing a useful action in days 22–28 / activated accounts old enough to measure | At least 40% |
| Task usefulness | Users rating a completed suggested task useful / users answering the question | At least 70%; show response count |
| Support responsiveness | Cases receiving a first human response within two business days / new cases | At least 90% |
| Opportunity traceability | Published opportunities with source, reviewer and review date / published opportunities | 100% |
| Supplier inquiry outcome | Closed pilot inquiries with owner-reported outcome recorded / closed pilot inquiries | Track baseline first; do not count inquiries as completed purchases |

Suggested events: profile_saved, action_created, action_completed, finance_workspace_saved, opportunity_saved, supplier_inquiry_created, inquiry_outcome_recorded. Keep financial values, message bodies and document contents out of analytics payloads.

## Release checks and operating costs

- Verify each ticket's acceptance criteria, account boundaries, persistence and export/deletion behavior for new data.
- Run the project's documented lint, unit, build and browser checks for implementation releases. Exercise any new core journey on a phone-sized viewport and keyboard.
- Review applicable official content and translations before publishing it.
- Confirm backups can be restored before data-changing releases; use a migration/rollback plan appropriate to each change.
- Track hosting/storage, AI requests, future email/SMS, and support/content hours monthly. Set actual spending limits after reviewing current bills; no cost figures were available for this plan.
- Start with existing React/Express/SQLite architecture. The proposed task, program and case workflows do not by themselves justify a platform rewrite. Revisit infrastructure against measured usage and operational requirements.

## Later decisions

Inventory, customer/order tracking, online payments, a broad marketplace, community discussion and automated external submissions need separate validation and operating capacity. Review them after the core pilot demonstrates recurring use.

The best next implementation is E01: an editable business profile and three practical next actions. It gives the reminder, opportunity and staff-support work a common foundation.

## External context

The Philippine MSME Development Plan emphasizes digitalization, business capabilities and market access. That supports the broad direction; the specific feature ordering above is a project recommendation to validate with local users.

- [MSME Development Plan 2023–2028, DTI-hosted document](https://dtiwebfiles.s3-ap-southeast-1.amazonaws.com/BSMED/MSMED%20Plan%202023-2028/MSMED%20Plan%202023-2028_approved%2007Nov2024.v2.pdf)
- [DTI Negosyo Center counseling](https://negosyocenter.dti.gov.ph/counseling): a potential official human-support referral destination; verify local availability before promising an appointment or partnership.

Research date: November 13, 2026. These references establish context, not verification of the program amounts, eligibility rules or deadlines currently stored in Enterseed.
