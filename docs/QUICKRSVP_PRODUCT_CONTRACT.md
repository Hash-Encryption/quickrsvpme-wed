# QuickRSVP Product Contract

## Authority and product boundaries

QuickRSVP has two independent products, Wedding and Party, on one shared backend. They may share authentication, Client identity, Events infrastructure, Guests, invitation tokens, RSVP, Scanner, administration, database, and storage. Builders, visual systems, templates, configuration, product policies, Design Drafts, entitlement rules, and renderers remain product-specific. Authority for one product never grants authority for the other.

The browser uses only `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`. Client identity is resolved through the authenticated backend. Platform Admin authority comes only from `platform_admins` and `is_platform_admin()`. Source artwork remains private; only intentional published delivery derivatives may be public.

## Authoritative customer funnel

`Design -> Save Design Draft -> Authenticate -> Preview -> Publish -> Event`

- Design may be anonymous and creates no Event.
- Save persists a Design Draft and creates no Event.
- Authentication claims/transfers the Draft and creates no Event.
- Preview renders the Draft configuration and creates no Event or publication usage.
- Publish is the commercial authority boundary. Only `publish_design_draft(draft_id)` may create the Event.
- Event is the operational product and may expose Guests, Send, Scanner, RSVP, analytics, and lifecycle controls.

A Design Draft is not an Event. Draft and Event lists and counts are separate. Drafts never expose operational Event features.

## Configuration ownership

Wedding anonymous state remains in the existing IndexedDB workspace. Wedding Drafts and Events reuse the existing Wedding configuration, layout, artwork, and motion renderer. Party Drafts reuse the current Party engine and local storage model. Application locale defaults to Arabic and remains independent from invitation locale.

Anonymous transfer preserves the complete product configuration and a stable anonymous-workspace marker. The frontend coalesces transfer, checks for an already-owned Draft with that marker before creating one, and retires the transferred anonymous record. Backend RLS remains the ownership boundary.

Draft artwork is reserved as a Draft-owned private source asset, uploaded to the backend-selected private bucket, and associated using `set_design_draft_artwork`. Publication and public delivery remain backend responsibilities.

## Publication authority

`get_design_draft_publish_access(draft_id)` supplies displayable authority status. `publish_design_draft(draft_id)` is authoritative and must validate Client, ownership, product, product availability, entitlement status and dates, configured publication authority, usage, and idempotency atomically. The frontend does not infer publication access from an active entitlement and contains no product allowance constants.

Failed publication leaves the Draft editable. Repeated publication returns the same Event and must not create another Event or consume another allowance.

## Phase 1 traceability matrix

| Requirement | Current implementation at baseline | Database support | Frontend support | Live verification status | Gap | Target phase |
|---|---|---|---|---|---|---|
| Anonymous Wedding design and refresh | Existing IndexedDB Wedding workspace and renderer | Not required | Existing | Pending validation | None expected | Phase 1 |
| Wedding auth transfer creates Draft, not Event | Transfer created Event first | `create_design_draft`, Draft RLS | Phase 1 integration | Pending validation | Remove Event-first transfer | Phase 1 |
| Exact Wedding configuration transfer | Existing full Wedding event model | Draft JSON configuration and template snapshot | Phase 1 integration | Pending validation | Transfer full configuration, not appearance subset | Phase 1 |
| Draft-owned private artwork | Event-owned upload only | `artwork_asset_id`, asset reservation, `set_design_draft_artwork` | Phase 1 integration | Pending validation | Add Draft owner upload path | Phase 1 |
| Authenticated Draft preview | Event route required | Draft owner read | Phase 1 Draft route | Pending validation | Render Draft without operational shell | Phase 1 |
| Backend-authoritative Publish | No frontend integration | `get_design_draft_publish_access`, `publish_design_draft`, `event_publications`, `events.source_draft_id` | Phase 1 integration | Manual authenticated verification required | Add typed wrappers and contextual UI | Phase 1 |
| Idempotent Publish | No frontend integration | Authoritative publish RPC and publication ledger | Single publish action with retry | Manual authenticated verification required | Verify same Event and one usage row | Phase 1 |
| Dashboard Draft/Event separation | Event-only creation and list | Separate Draft and Event tables | Phase 1 split list | Pending validation | Remove customer `create_event` path | Phase 1 |
| Anonymous Party design | Authenticated route only | Not required | Phase 1 public Party design route | Pending validation | Add minimum route | Phase 1 |
| Party Draft/auth/preview | Party Event persistence only | Product-scoped Draft RLS | Phase 1 integration using current engine | Pending validation | Transfer and save Draft without Event | Phase 1 |
| Party Publish without entitlement | No Draft publish UI | Publish RPC validates product entitlement | Phase 1 backend-result UI | Manual authenticated verification required | Confirm truthful denial and zero Party Events | Phase 1 |
| Cross-Client and cross-product isolation | Existing RLS foundation | Draft/Event RLS and publish RPC validation | No frontend bypass | Previously verified foundation; new RPC live checks required | Run user-controlled/authenticated verification | Phase 1 |
| Request-storm safety | Bounded/coalesced auth bootstrap | N/A | Existing bootstrap plus single-flight transfers | Pending validation | Ensure Draft loads do not loop | Phase 1 |
| Four locale combinations and responsive widths | Existing independent locale models and responsive builders | N/A | Existing plus Draft route | Pending browser validation | Validate 390, 430, tablet, desktop | Phase 1 |
| Complete dashboard/commercial/Admin UX | Partial operational UI | Existing configurable policy model | Deferred | Not run | Full hierarchy and administration | Phase 2 |
| Party Planner V2 | Current Party model | Not selected | Deferred | Not run | New Party categories and advanced editing | Phase 2 |
| Payments | No processor | No payment-success authority | Intentionally absent | Not applicable | Integrate only when approved | Future phase |

## Applied database boundary

The applied Phase 1-3 migrations and the user-applied Draft/Publish migration are immutable. Remote SQL is user-owned. Any future schema correction must be a new forward-only migration and must stop at the user SQL checkpoint.

## Phase 1 implementation status — 2026-09-02

| Area | Status | Evidence / remaining certification |
|---|---|---|
| Anonymous Wedding editing, local save, refresh, RTL/LTR, responsive layout | VERIFIED | Browser-verified at 390, 430, tablet, and desktop with no horizontal overflow or console errors; verification edit restored. |
| Anonymous Party editing, local save, refresh, RTL/LTR, responsive layout | VERIFIED | Public `/design/party` browser-verified at the same widths with no horizontal overflow or console errors; verification edit restored. |
| Customer Event-first creation removal | IMPLEMENTED | Customer UI and auth transfer contain no `createEvent()` call. The low-level wrapper remains for legacy/internal compatibility only. |
| Dashboard Draft/Event separation | IMPLEMENTED | Dashboard reads `design_drafts` separately from published `events`; Draft cards route only to Draft editing/preview/publish. |
| Wedding anonymous-to-Draft transfer | IMPLEMENTED; MANUAL VERIFICATION REQUIRED | Stable source marker, single-flight transfer, owned Draft lookup, full configuration copy, anonymous record retirement, and no Event call are present. Requires target-project authenticated browser and database observation. |
| Wedding Draft artwork | IMPLEMENTED; MANUAL VERIFICATION REQUIRED | Draft-owned `private_source` reservation/upload plus `set_design_draft_artwork`; no storage policy or bucket weakening. Requires authenticated upload/reload/publish proof. |
| Wedding authenticated preview | IMPLEMENTED; MANUAL VERIFICATION REQUIRED | Draft-only route renders the shared Wedding Studio directly and omits operational Event navigation. Requires target-project authenticated browser proof. |
| Wedding Publish and duplicate Publish | IMPLEMENTED; MANUAL VERIFICATION REQUIRED | Access and Publish use the deployed backend RPCs only. Event/ledger/source-Draft/configuration outcomes require target-project live verification. |
| Party transfer, Draft preview, autosave | IMPLEMENTED; MANUAL VERIFICATION REQUIRED | Current Party model is preserved; transfer and Draft saves use product-scoped Draft RPCs with no Event call. Requires target-project authenticated browser proof. |
| Party Publish denial without entitlement | IMPLEMENTED; MANUAL VERIFICATION REQUIRED | UI displays backend access result and disables denied publication. Requires live confirmation of zero Party Event rows. |
| Cross-Client / cross-product / usage-ledger security | MANUAL VERIFICATION REQUIRED | Frontend exposes no bypass and existing RLS remains unchanged; new deployed RPC behavior was not remotely executed by Codex. |
| Auth redirect | IMPLEMENTED; MANUAL VERIFICATION REQUIRED | Email confirmation returns to the current application origin plus `/auth`, never a hard-coded localhost. Production provider allow-list/host remains an operator check. |
| Request-storm safety | VERIFIED STATICALLY | Existing bounded account bootstrap is preserved; transfers are single-flight; Draft route loads once per Draft ID. |
| Automated checks | VERIFIED | 103/103 tests, TypeScript, production build, project-reference scan, secret scan, and diff check pass. |
| Complete dashboard/commercial/Admin UX and Party V2 | DEFERRED PHASE 2 | Not started. |
