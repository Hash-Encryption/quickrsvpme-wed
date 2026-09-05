# QuickRSVP Phase 3 certification

Date: 2026-09-05
Repository: `C:\codexprojects\quickrsvpme-wed`

## Status

`PHASE_3_COMPLETE — PASS WITH DOCUMENTED MANUAL GAPS`

The Phase 3 production path is certified for the current Client against Supabase project `dfmfdlfamjgzfztupngm`. Wedding and Party remain independent, Draft-first publishing works, the Party entitlement and one-Event allowance remain backend-authoritative, General Invitation approval/rejection works through the real public and host flows, and the database retry/request storm has not returned after the runtime and RLS scaling hardening.

The remaining items are explicitly listed manual/provider checks; none is represented as completed evidence. Wedding V2 has not started.

## Repository and environment

- Required branch: `main`
- Closure baseline: `afaa4204990045352e6bd5eb6adb79c558c65d77`
- Baseline verified before closure work: `HEAD == origin/main`, divergence `0/0`
- Authoritative Supabase project: `dfmfdlfamjgzfztupngm` — `PASS`
- Retired project `xigikltphqzcjxxmqywk`: absent from `.env.local`, tracked application source, and rebuilt output — `PASS`
- Browser configuration uses only `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`
- Privileged/service-role/database browser credentials: `0`
- `.env.local` and secrets are not tracked
- Push policy: normal push only; no force push

## Certification summary

| Area | Status | Evidence |
| --- | --- | --- |
| Authentication | PASS | Sign-in, sign-out, protected-route redirect, authenticated reload, and session restore were exercised. Public `/i/:token` no longer starts authenticated account bootstrap. |
| Party negative entitlement | PASS | Before the Super Admin grant, anonymous Party Design and Draft transfer succeeded, authenticated persistence survived reload, publication returned `entitlement_missing`, Party Event count remained `0`, and Wedding authority did not authorize Party. This evidence is retained and was not altered by the later positive test. |
| Party positive entitlement | PASS | The current Client received a permanent, no-expiry Party override through the existing Super Admin/backend authority with publication allowance exactly `1`. Wedding entitlement and allowance were unchanged. Party Event `844812ad-98b1-4f12-899d-16e8e2f3fd08` was published from Party Draft `4dd01072-52d0-40d7-a377-2045e9e87f64`. |
| Party templates and persistence | PASS | Corporate, Birthday, Baby Shower, and Custom celebration were each selected in the real Party Draft UI, allowed through the 2-second autosave window, and verified after reload. Corporate was restored and reverified as the final state. Draft title and embedded configuration also persisted together after the Draft/Event hydration-race repair. |
| Party structured blocks | PASS WITH NOTES | Existing Party V2 structured block controls and shared preview remained operational during Draft testing. The previously exercised block-operation evidence was preserved; destructive block changes were not repeated or retained during this final closure pass. |
| Wedding Draft-first funnel | PASS | Anonymous design persistence, authenticated transfer, backend Draft reload, custom artwork association/reload, Preview, access check, Publish, Event navigation, and duplicate-publish idempotency passed. |
| Draft/Event and product isolation | PASS | Drafts and Events remain separate records and routes. Wedding and Party use independent entitlements, allowances, configurations, templates, renderers, and Event records. The Party grant did not modify Wedding. |
| Client dashboard | PASS | Overall, product-specific, Draft, Event, access, and Account/Profile surfaces loaded from backend data. Draft loading was reduced from two product queries to one bounded query. |
| Personal invitation | PASS WITH NOTES | Token resolution, published configuration/artwork, RSVP, party-size UI maximum, response reload persistence, and Scanner-safe token use passed. Open-count proof still requires a fresh active Event; revocation was not run. |
| General Invitation approval | PASS | Synthetic request `Phase 3 Approved Guest` / `+966550000001` was reviewed through the authenticated host Guests UI and approved. Approval persisted after reload and connected exactly one pending operational Guest. No duplicate request or Guest appeared. |
| General Invitation rejection | PASS | Synthetic request `PHASE 3 REJECTION TEST ONLY` / `+966550000099` was submitted on Event `844812ad-98b1-4f12-899d-16e8e2f3fd08`, rejected through the host UI, and remained `REJECTED` after reload. Awaiting count became `0`; Guest count stayed `2`; no Guest was created. The terminal row exposed no second approve/reject action and no duplicate request or Guest appeared. |
| General Invitation authority | PASS | The public page resolved only the token-scoped Event and exposed the request form, not Admin, Scanner, or host controls. Approval/rejection remained authenticated host operations. Both synthetic requests remained scoped to Event `844812ad-98b1-4f12-899d-16e8e2f3fd08`. |
| Guests and RSVP | PASS WITH NOTES | Personal Guest/companions, accepted RSVP, custom message, tag reload, and General Invitation conversion passed. Direct RPC excess/deadline/change-policy negatives remain manual. |
| Scanner / check-in | PASS WITH NOTES | Event-scoped resolution did not auto-check-in. Observed `NOT ARRIVED -> PARTIAL (2/3) -> COMPLETE (3/3)`, invalid-token rejection, correction `3 -> 2`, and restoration `2 -> 3`. Camera hardware, wrong-Event, and second-identity checks remain manual. |
| Analytics | PASS | Live totals reconciled across Event operations and Admin Usage during the primary Wedding certification. |
| Lifecycle | PASS WITH NOTES | `Planning -> Active -> Ended -> Archived` passed, including read-only terminal UI boundaries. Cancelled and destructive soft-delete were not run. |
| Super Admin | PASS WITH NOTES | Backend-authorized Admin surfaces and entitlement history loaded. Party was granted through the normal entitlement system and remains active until changed by Super Admin or future billing authority. Normal-user Admin denial still needs a second safe identity. |
| Storage | PASS WITH NOTES | Private source artwork upload, Draft association, reload, and intentional published rendering passed. Cross-client and terminal storage mutation attempts remain manual. |
| Arabic / English | PASS | AR/EN application and invitation combinations were exercised independently and persisted. |
| Responsive browser | PASS WITH NOTES | Widths 390, 430, 768, and 1280 showed no horizontal overflow on the recorded core surfaces. Physical-device checks remain manual. |
| Runtime scaling | PASS | Initial incident reached CPU `100%`, RAM `60%`, disk `16%`, connections `15/60`. After the forward migrations and client request hardening, the user observed idle CPU `3%`, RAM `53%`, disk `16%`, connections `9/60`. Idle route observation showed no repeating bootstrap/autosave sequence; active Party edits produced one settled autosave per change and survived reload; the retry/request storm did not return. No exact requests/second profiler capture is claimed. |
| Security | PASS WITH NOTES | RLS remained enabled; policy predicates and storage lifecycle/ownership guards were preserved; public request authority stayed narrow; Admin remained `platform_admins` / `is_platform_admin()`. Cross-client and normal-user denial require a second identity. |

## Live certification records

- Wedding Draft: `e1384536-e8db-4a50-8b2e-16cbe5065990`
- Wedding Event: `b296c895-5238-463b-bb56-6659f0ccf40c` (final lifecycle `archived`)
- Party Draft: `4dd01072-52d0-40d7-a377-2045e9e87f64`
- Party Event: `844812ad-98b1-4f12-899d-16e8e2f3fd08`
- General Invitation approval test: `Phase 3 Approved Guest` / `+966550000001` — `APPROVED`, exactly one pending Guest
- General Invitation rejection test: `PHASE 3 REJECTION TEST ONLY` / `+966550000099` — `REJECTED`, no Guest
- Invitation tokens are intentionally omitted
- Synthetic request records are retained and clearly labeled because removing them would weaken reload/audit evidence

## Hardening completed

1. Dashboard optional-data race: authenticated loaders now wait for bootstrap completion and rerun through the existing path.
2. Draft artwork RPC contract: a forward-only authenticated wrapper matches the PostgREST argument contract without exposing anonymous execution.
3. Published-Draft retry: retry is available only when backend Event data proves the same `source_draft_id` already published.
4. Guest tag rendering: nested relation object/array/null shapes are handled safely.
5. Invitation-open scheduling: the existing RPC is invoked immediately instead of through a background-tab-sensitive animation frame.
6. Version-conflict retry amplification: `20260905000200_nonretryable_version_conflicts.sql` changes application version conflicts from retryable SQLSTATE `40001` to non-retryable `PT409` for Wedding config, Party config, and Design Draft saves.
7. RLS resource usage: `20260905000300_reduce_rls_resource_usage.sql` adds only missing leading-`client_id` indexes and caches row-independent RLS helpers through `(select ...)`; authorization semantics are unchanged.
8. Client request bounds: account bootstrap is skipped for public invitation routes; optional account requests cannot block essential identity; Dashboard Draft loading is one query; exact no-op Draft saves are skipped.
9. Autosave bounds: Party/Wedding saves run only on relevant routes, wait for settled edits, skip unchanged signatures, serialize writes, and fail closed after a backend conflict instead of retrying indefinitely.
10. Party Draft persistence race: published-Event hydration no longer runs on `/drafts/party/:id`, preventing Event state from overwriting Draft state before autosave.

## Database verification

- Remote SQL remained user-owned; Codex did not run remote SQL or use privileged credentials.
- The user applied `supabase/migrations/20260905000200_nonretryable_version_conflicts.sql` to `dfmfdlfamjgzfztupngm`.
- The user applied `supabase/migrations/20260905000300_reduce_rls_resource_usage.sql` to the same project.
- The read-only `supabase/tests/reduce_rls_resource_usage_verification.sql` completed successfully; all checks passed.
- The verifier covers replacement policies, `TO authenticated`, ownership/Admin predicates, storage lifecycle/ownership guards, exactly one intended leading index, and RLS enabled on affected tables.
- Static pre-deployment comparison found all 32 replaced policies semantically identical except for the intended helper caching; five proposed indexes were catalog-checked and the migration skips differently named equivalents.
- Backend Phase 2 security expectations were updated to require non-retryable `PT409` conflicts.

## Performance observations

- Before repair: Supabase Query Performance showed extreme PostgREST transaction setup activity relative to actual save calls, consistent with `40001` retry amplification.
- Recovery observation: CPU `3%`, RAM `53%`, disk `16%`, connections `9/60`.
- Idle account/Event route changes produced only their expected bounded reads; no repeating account bootstrap, Draft load, or autosave sequence was observed.
- Guests route observation produced the expected Guest read plus General Invitation request listing; Send route produced its expected Guest read.
- Party Draft template changes were debounced to the existing 2-second idle window, each persisted after reload, and did not continue saving while idle.
- This is live behavioral and provider-metric evidence, not an exact continuous request-rate trace.

## Validation

- `npm.cmd run check` — `PASS`
- Unit/integration tests — `PASS`, 112/112
- TypeScript — `PASS`
- Production build — `PASS`; the existing chunk-size warning is informational
- SQL structural/security checks — included in the test gate
- `git diff --check` — `PASS`
- Lint — `NOT_RUN`: no lint script exists

## Remaining manual/provider checks

1. Use a second safe Client identity for live cross-client RLS, normal-client Admin denial, unauthorized Scanner, and private-asset isolation.
2. On a fresh active Event, verify personal invitation `open_count`, repeated opens, and revocation.
3. Exercise direct backend rejection for excess RSVP party size, deadline/change policy, wrong-Event Scanner, terminal table/storage mutation, and invalid product/template combinations.
4. Run the physical-device matrix, including camera QR scanning, keyboards/focus, sheets/dialogs, block reordering, and RTL/LTR.
5. Decide whether to retire the unattached private-source asset left by the earlier failed artwork attempt.
6. If desired, run destructive soft-delete certification on a disposable Event.

## Release

- Commit message: `fix: close Phase 3 runtime hardening`
- Commit SHA: reported after commit because a commit cannot contain its own final SHA
- Push: authorized normal push to `main`; no force push
- Wedding V2: not started
