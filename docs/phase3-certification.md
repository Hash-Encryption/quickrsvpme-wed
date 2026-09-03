# QuickRSVP Phase 3 certification

Date: 2026-09-04
Repository: `C:\codexprojects\quickrsvpme-wed`

## Status

`PHASE_3_BLOCKED`

The authoritative production backend, Draft-first Wedding funnel, publication idempotency, operational Event flow, Admin visibility, lifecycle restrictions, localization, responsive browser checks, and old-project retirement readiness were exercised successfully. Full certification is blocked because the requested general-invitation approval model is not present: the current general link asks only for a name and creates an accepted Event Guest immediately. Live cross-client, normal-client Admin denial, Party-positive, physical-device, and several destructive/direct-backend negative cases also remain unavailable or intentionally not run.

## Repository

- Required starting branch: `main`
- Required starting SHA: `43b4efe5644101e09450db52e711885406f5be9a`
- Baseline verified before changes: clean worktree, `HEAD == origin/main`, divergence `0/0`
- Force push: prohibited and not used

## Environment

- Authoritative Supabase project: `dfmfdlfamjgzfztupngm` — `PASS`
- Retired Supabase project: `xigikltphqzcjxxmqywk` — absent from `.env.local`, tracked application source, and rebuilt `dist` output
- Browser variables: only `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` — `PASS`
- Publishable key present; no key value is recorded in this document
- Privileged/service-role/database browser credential markers — `0`
- Live browser console warnings/errors after the final browser matrix — `0`

## Certification summary

| Area | Status | Evidence |
| --- | --- | --- |
| Authentication | PASS | Sign-in, sign-out, protected-route redirect, authenticated route reload, and session restore exercised against the authoritative backend. Credentials were entered only by the user. |
| Party negative entitlement | PASS | Anonymous Party Design and Draft transfer succeeded; configuration survived authentication and reload; authenticated autosave survived reload; publication returned `entitlement_missing`; Publish remained disabled; Party Event count remained `0`. Wedding entitlement did not authorize Party. |
| Party positive flow | BLOCKED | The test Client has no legitimate Party entitlement. None was granted merely to force a positive result. |
| Wedding Draft-first funnel | PASS | Anonymous design persistence, authentication transfer, backend Draft reload, custom artwork association/reload, Preview, access check, Publish, and Event navigation completed. No Event existed before Publish. |
| Draft/Event separation | PASS | Before Publish: Wedding Drafts `1`, Party Drafts `1`, Events `0`. After Publish: Wedding Drafts `1`, Party Drafts `1`, Wedding Events `1`, Party Events `0`. |
| Publication idempotency | PASS | First Publish created Event `b296c895-5238-463b-bb56-6659f0ccf40c`. A retry of the same Draft returned that exact Event ID; Event count stayed `1`. Runtime event data exposed the source-Draft association used by the retry control. |
| Client dashboard | PASS | Overall, Wedding, Party, recent Draft, active Event, historical Event, access, and Account/Profile surfaces loaded from backend data. The dashboard optional-data race was repaired. |
| Guests | PASS WITH NOTES | Created a personal Guest with two companions, accepted RSVP for party size `3`, recorded a custom message, added tag `phase3`, and created a general-link Guest. Guest tags now survive reload without crashing. Cross-client isolation remains live-unverified. |
| Personal invitation | PASS WITH NOTES | Token resolved the intended Guest/Event, rendered the published Wedding configuration and artwork, accepted RSVP, enforced the UI companion maximum, and persisted the response after reload. Open-count proof must be repeated on a fresh active Event after the scheduling hardening described below. Revocation was not run. |
| General invitation | FAIL | The current flow collects only a name and immediately creates an accepted Guest. It has no phone field and no awaiting/approved/rejected host-approval lifecycle required by the Phase 3 brief. This is a product/backend scope gap, not a safe certification-only patch. |
| RSVP / companions | PASS WITH NOTES | Personal maximum was `1 + 2 = 3`; general maximum was `1`; accepted statuses and custom messages persisted. Direct RPC rejection of excessive values, deadline enforcement, and RSVP-change policy were not independently exercised. |
| Scanner / check-in | PASS WITH NOTES | Authenticated Event-specific manual token resolution did not auto-check-in. Observed `NOT ARRIVED -> PARTIAL (2/3) -> COMPLETE (3/3)`, invalid-token rejection, confirmed correction `3 -> 2`, and restoration `2 -> 3`. Camera hardware, wrong-Event, and a second unauthenticated identity were unavailable. |
| Analytics | PASS | Live totals reconciled: Guest records `2`, confirmed people `4`, arrived `3`, remaining `1`, accepted `2`, custom messages `2`. Admin Usage reported the same primary totals. |
| Lifecycle | PASS WITH NOTES | Exercised `Planning -> Active -> Ended -> Archived`. At Ended, Guests, Send, Invitation, and Scanner rendered read-only boundaries; public invitation reload was unavailable. Archived became terminal and moved to Event history. Cancelled and soft-delete were not run. |
| Super Admin | PASS WITH NOTES | Backend-authorized Admin loaded Clients, Events, Drafts, Entitlements/history, Templates, Policies, Assets, Usage, and Support. A normal non-Admin identity was unavailable for live denial proof; backend policy remains `platform_admins` / `is_platform_admin()`. |
| Cross-client security | MANUAL_VERIFICATION_REQUIRED | A second safe Client identity was unavailable. Static RLS/SECURITY DEFINER boundaries remain intact; no live cross-client claim is made. |
| Cross-product security | PASS WITH NOTES | Live Wedding-entitlement-to-Party denial passed. Product-specific routes, Drafts, Event counts, configurations, and template registries remained separate. Reverse Party-to-Wedding denial requires legitimate Party authority. |
| Storage | PASS WITH NOTES | Private source artwork was uploaded through `invitation-assets-private`, associated with the Wedding Draft, survived reload, and produced intentional published rendering after Publish. Admin showed two uploaded private-source assets: one unattached asset from the failed pre-repair attempt and the successful attached source. Neither was retired or exposed publicly. Live cross-client and terminal storage mutation attempts were not run. |
| Arabic / English | PASS | Exercised AR app + EN invitation, AR + AR, EN + AR, and EN + EN. Invitation locale survived save/reload and was restored to English. Application and invitation locale remained independent. |
| Responsive browser | PASS WITH NOTES | Real browser viewport checks at 390, 430, 768, and 1280 widths showed `scrollWidth == clientWidth` on Dashboard, Wedding Draft, Guests, Scanner, Admin Support, and Event Overview. Physical-device checks remain manual. |
| Performance / request safety | PASS WITH NOTES | Auth bootstrap tests passed; dashboard loading was bounded after the race fix; Draft transfer and Event publication stayed singular; all Admin sections settled without console errors or request-loop symptoms. No network waterfall profiler was available. |
| Security review | PASS WITH NOTES | No service-role/database secrets or unsafe HTML sinks in browser code; token use stayed opaque and backend-resolved; Scanner required authentication; Admin authority remained backend-driven; private/public storage intent remained distinct. Live cross-client and normal-client Admin denial remain manual. |

## Live records created for certification

- Wedding Draft: `e1384536-e8db-4a50-8b2e-16cbe5065990`
- Party negative-entitlement Draft: `4dd01072-52d0-40d7-a377-2045e9e87f64`
- Wedding Event: `b296c895-5238-463b-bb56-6659f0ccf40c`
- Final Wedding Event lifecycle: `archived`
- Personal and general invitation tokens are intentionally omitted
- Test records were retained; no destructive cleanup was authorized

## Defects fixed

1. Dashboard optional-data race
   - Symptom: authenticated Draft and commercial data could render as empty after initial account bootstrap.
   - Cause: Dashboard requests ran while optional Auth bootstrap requests were still active, failed, and silently settled to empty state.
   - Fix: wait for `auth.dataLoading` to finish and rerun the existing loaders. No new request layer was introduced.

2. Draft artwork RPC schema mismatch
   - Symptom: storage upload succeeded but PostgREST could not find `set_design_draft_artwork(p_artwork_asset_id, p_draft_id)`.
   - Cause: the deployed function used legacy parameter name `p_asset_id`; PostgREST resolves RPC overloads by argument names.
   - Fix: forward-only migration renames the legacy function, revokes its direct execution, and adds an authenticated-only wrapper with the required `p_artwork_asset_id` contract.

3. Published-Draft retry control
   - Symptom: after first publication, `publication_allowance_used` disabled Publish before the backend idempotency path could be retried.
   - Fix: permit retry only when authenticated Event data proves an Event with the same `source_draft_id` already exists (or the access RPC supplies `event_id`). Unpublished denied Drafts remain blocked.

4. Guest tag relation rendering
   - Symptom: adding the first tag caused the Guest page error boundary.
   - Cause: the Supabase many-to-one nested relation returned an object while the UI assumed an array.
   - Fix: accept the actual object form while retaining array/null compatibility. The tagged Guest rendered successfully after reload.

5. Invitation-open scheduling
   - Symptom: opening a public invitation in a background tab did not produce observable open-count evidence.
   - Cause: the RPC was unnecessarily deferred behind `requestAnimationFrame`, which can be suspended for background tabs.
   - Fix: invoke the existing `record_invitation_open` RPC immediately. No new tracking state or authority was added. A fresh active Event is required for final live open-count confirmation because the certification Event is now terminal.

## Database

- Remote SQL ownership remained with the user.
- No privileged database credential was requested or used by Codex.
- The first user-run function definition failed atomically with PostgreSQL `42723` because the same `(uuid, uuid)` signature already existed.
- Read-only catalog evidence identified deployed arguments `p_draft_id, p_asset_id`, return type `design_drafts`, `SECURITY DEFINER`, authenticated execute, and no anonymous execute.
- Forward migration: `supabase/migrations/20260903000200_phase3_draft_artwork_rpc.sql`
- Read-only verification: `supabase/tests/phase3_draft_artwork_verification.sql`
- User-confirmed remote result: every verification column `true` — `PASS`
- Browser proof after migration: artwork association succeeded and survived Draft reload — `PASS`
- All six local migration files have balanced transaction/dollar-quote structure — `PASS`
- Verification mutation statement count: `0` — `PASS`

## Old Supabase retirement readiness

Classification: `READY_FOR_RETIREMENT`

- `.env.local` points to the authoritative project and not the retired project.
- Tracked retired-project references: `0`
- Rebuilt `dist` retired-project references: `0`
- Rebuilt `dist` authoritative-project references: present
- Live Auth, Draft, Event, storage, RPC, RSVP, check-in, lifecycle, and Admin traffic succeeded against the authoritative project.
- No application dependency on the retired project was observed.
- Actual deletion/retirement of the old Supabase project is an external destructive action and was not performed.

## Responsive/browser matrix

| Width | Surface | Result |
| ---: | --- | --- |
| 390 | Overall Dashboard | PASS — no horizontal overflow |
| 430 | Wedding Draft editor | PASS — no horizontal overflow |
| 390 | Guests | PASS — no horizontal overflow |
| 430 | Scanner | PASS — no horizontal overflow |
| 768 | Super Admin Support | PASS — no horizontal overflow |
| 1280 | Event Overview | PASS — no horizontal overflow |
| Physical devices | Major authenticated/public surfaces | MANUAL_VERIFICATION_REQUIRED |

## Validation

- `npm.cmd run test` — `PASS`, 109/109
- `npm.cmd run typecheck` — `PASS`
- `npm.cmd run build` — `PASS`
- Production build note — informational chunk-size warning only
- SQL structural checks — `PASS`
- Phase 3 SQL verification read-only check — `PASS`
- Authoritative/retired runtime bundle scan — `PASS`
- Browser privileged-secret pattern scan — `PASS`
- Unsafe HTML sink scan — `PASS`
- Browser console errors/warnings in final matrix — `0`
- `git diff --check` — `PASS`
- Lint — `NOT_RUN — no lint script exists`

## Remaining manual actions

1. Decide and implement the general-invitation request/phone/host-approval product model in a separately authorized backend + UI change; then certify awaiting, approved, and rejected states.
2. Use a second safe Client identity to exercise cross-client RLS, normal-client Admin denial, unauthorized Scanner, and private-asset isolation.
3. Use legitimate Party entitlement authority to run the complete Party-positive flow; do not borrow Wedding authority.
4. On a fresh active Event, confirm personal invitation `open_count` increments after the immediate-call hardening, repeat opens, and revocation.
5. Exercise direct backend rejection for excessive RSVP party size, deadline/change-policy enforcement, wrong-Event Scanner, terminal table/storage mutation, and invalid product/template combinations.
6. Run the full physical-device matrix, including camera QR scanning, keyboards/focus, bottom sheets, dialogs, drag/reorder, and RTL/LTR.
7. Decide whether to retire the unattached private-source asset left by the failed pre-repair artwork attempt.
8. If desired, run destructive soft-delete certification on a disposable Event.

## Commit and push

- Commit message: `fix: certify and harden Phase 3 flows`
- Commit SHA: recorded in the release handoff because including a commit's own final SHA in its contents is circular
- Push: pending explicit authorization
- Push policy: normal push only; no force push
