# QuickRSVP frontend/backend contract freeze

This document freezes the product-facing boundary after frontend Phase 7. It does not select a database, authentication provider, API transport, cloud, or deployment architecture. The existing TypeScript models remain the current type authority.

## Contract rules

- `AppLocale` and each invitation's locale remain independent `"ar" | "en"` values.
- Stable frontend IDs are opaque strings. Consumers must not infer meaning from their format.
- Wedding and Party remain separate products with separate configuration authorities and shared operational concepts.
- Frontend-derived labels, formatted dates, counts, scene frames, and template presentation are not new persisted authorities.
- Current browser token checks and Scanner behavior are demos, not security boundaries.

## User / Account

**CURRENT FRONTEND AUTHORITY:** There is no user/account model. `AppLocaleProvider` owns the application locale in `quickrsvp-app-locale`. The UI reads and writes that preference locally; no ownership or identity claim exists.

**FUTURE BACKEND RESPONSIBILITY:** Supply authenticated identity, account/workspace ownership, and durable preferences while preserving the two-locale contract. Authentication method, account lifecycle, membership rules, and preference synchronization remain unresolved.

## Events / Projects

**CURRENT FRONTEND AUTHORITY:** `WeddingProject.id` identifies Wedding projects. `party-demo` identifies the current Party project. `ProjectType` is `wedding | party`. The UI reads name, mode, date, venue, and configuration; Wedding project CRUD writes through `WeddingWorkspaceProvider`. Dashboard/Admin summaries are derived.

Wedding persists in IndexedDB `quickrsvp-wedding-workspace`; Party persists in localStorage `luxury-rsvp-engine`, with truthful session-only fallback when storage is unavailable.

**FUTURE BACKEND RESPONSIBILITY:** Authoritatively persist event ID, type, ownership, name, dates, venue, configuration relationship, and only product-required status. Ownership rules, lifecycle/status vocabulary, version/conflict behavior, and list pagination remain unresolved.

## Wedding Configuration

**CURRENT FRONTEND AUTHORITY:** `WeddingProject.event`—specifically `activeProject.event` while editing—is the only Wedding content/configuration authority. It includes invitation locale/content, template ID, visual source and artwork placement, style, presentation, optional media URLs, and invitation variant. The renderer derives five canonical scenes and semantic blocks. Saved Designs persist only the explicit appearance allow-list.

**FUTURE BACKEND RESPONSIBILITY:** Store and return the current configuration without redesigning it. Preserve registry IDs, canonical timing, Fit/Fill, focal point, safe zone, and appearance-only Saved Designs. Validation/version migration and concurrent-edit policy remain unresolved.

## Party Configuration

**CURRENT FRONTEND AUTHORITY:** `EngineState` owns Party event content, invitation locale, grouped blocks, order/visibility, meal/song inputs, RSVP compatibility state, and selected `PartyTemplateId`. `mergePartyEvent()` normalizes persisted values. The UI writes through the existing Engine mutation path.

**FUTURE BACKEND RESPONSIBILITY:** Persist the current `EngineState` projection required by Party without reshaping it into a database schema. Block-version migration and collaborative-edit behavior remain unresolved.

## Guests

**CURRENT FRONTEND AUTHORITY:** `OperationalState.guestsByProject` stores project-scoped `OperationalGuest` records. Stable fields read by the UI are guest ID, project key, name, phone, token, companion allowance, invitation variant override, RSVP, attending count, message, and check-in state. CRM totals and exports are derived. Local mutations normalize companion limits and preserve project isolation.

**FUTURE BACKEND RESPONSIBILITY:** Authoritatively relate guest ID to event ID, persist contact and invitation eligibility, enforce companion allowance, and expose only the guest data appropriate to each customer/staff/public context. Guest deduplication, deletion/retention, imports, and phone normalization remain unresolved.

## Invitations / Tokens

**CURRENT FRONTEND AUTHORITY:** Public URLs remain `/i/demo` and `/i/:token`. Current demo mode resolution remains `EngineState.mode`; `isValidGuestToken()` is a local allow-list/current-guest check. Studio/public renderers are shared. Tokens, URLs, IDs, and phone values remain directionally isolated.

**FUTURE BACKEND RESPONSIBILITY:** Resolve a public token securely and narrowly to its event and guest, enforce expiry/revocation where the product requires it, and prevent cross-event disclosure. Token format, issuance, rotation, expiry, and anonymous response-session policy remain unresolved.

## RSVP

**CURRENT FRONTEND AUTHORITY:** Wedding submits `WeddingRsvp` through the shared renderer into the existing Engine path and project-scoped operational mirror. Party uses the existing `setRsvp` mutation path and the guest's `allowedCompanions`. UI reads accepted/declined/pending, companion count, allowance, and message; it writes changed responses locally and clamps counts.

**FUTURE BACKEND RESPONSIBILITY:** Own current RSVP state, validate allowed transitions/counts, perform durable mutations, and return conflict/error results suitable for localized UI. Idempotency, concurrency, audit history, and response cutoff enforcement remain unresolved.

## Scanner / Check-In

**CURRENT FRONTEND AUTHORITY:** `scanProjectGuest()` and `checkInOperationalGuest()` provide manual, local, project-scoped demo behavior for ready, invalid, valid, already-checked-in, and check-in states. This is neither camera scanning nor secure validation.

**FUTURE BACKEND RESPONSIBILITY:** Verify tokens securely, enforce event/staff access, return narrow guest/status data, detect already-used passes, and perform atomic check-in. Offline operation, reversal, audit history, multi-device conflicts, and rate limits remain unresolved.

## Roles / Admin

**CURRENT FRONTEND AUTHORITY:** Admin is a read-only frontend shell derived from local projects, registries, persistence status, and operational counts. No customer identity, project access, staff role, impersonation, billing, logs, or destructive service action exists.

**FUTURE BACKEND RESPONSIBILITY:** Separate customer ownership, project membership, operational staff, and platform administration. Authorization vocabulary, support access, audit policy, and escalation workflows remain unresolved. No RBAC implementation is implied here.

## Templates

**CURRENT FRONTEND AUTHORITY:** `WeddingTemplateRegistry`, Wedding layout/motion registries, and `partyTemplates` own stable renderer-compatible IDs and behavior. Admin template data is derived from these registries.

**FUTURE BACKEND RESPONSIBILITY:** May provide catalog metadata, availability, ordering, or entitlement references keyed to existing frontend IDs. Backend metadata must not redefine renderer behavior. Publishing/version compatibility and entitlement rules remain unresolved.

## Uploaded Assets

**CURRENT FRONTEND AUTHORITY:** Wedding accepts JPEG/PNG/WebP, bounds raw size, decodes locally, resizes to a maximum dimension, encodes bounded WebP data, and persists uploaded-background metadata/data with Wedding configuration. Fit/Fill, zoom, background position, and focal point remain frontend authorities.

**FUTURE BACKEND RESPONSIBILITY:** Store validated assets, return durable delivery references, enforce ownership/access, and define replacement/deletion lifecycle while preserving current placement semantics. Upload protocol, quotas, malware scanning, CDN behavior, retention, and orphan cleanup remain unresolved.

## Explicit security and implementation boundary

The frontend does not provide production authentication, authorization, secure invitation resolution, production QR validation, atomic server check-in, cloud uploads, messaging delivery, billing, payments, subscriptions, or production analytics. This contract does not authorize or specify Supabase tables, SQL, indexes, RLS, API endpoints, providers, or infrastructure.
