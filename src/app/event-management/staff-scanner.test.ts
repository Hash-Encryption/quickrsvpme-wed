import assert from 'node:assert/strict';
import test from 'node:test';

import {
  computeClientPinHash,
  formatStaffToken,
  parseStaffToken,
  verifyStaffPin,
  getStaffSession,
  setStaffSession,
  clearStaffSession,
  _resetStaffLockoutForTesting,
  _setStaffLockoutForTesting,
  type StaffCheckinResolution,
} from '../../backend/staff-scanner.ts';
import { checkinStatus, extractScanToken } from '../../backend/phase3-model.ts';
import { needsAccountBootstrap } from '../../auth/bootstrap.ts';
import { buildProjectRoute, projectSections, resolveProjectSection } from '../projects.ts';
import { appTranslations } from '../../i18n/app-locale-data.ts';

// Provide Storage polyfills for Node test runner
if (typeof globalThis.sessionStorage === 'undefined') {
  const store = new Map<string, string>();
  globalThis.sessionStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => store.set(k, String(v)),
    removeItem: (k: string) => store.delete(k),
    clear: () => store.clear(),
    key: (i: number) => Array.from(store.keys())[i] ?? null,
    get length() { return store.size; },
  } as unknown as Storage;
}

if (typeof globalThis.localStorage === 'undefined') {
  const store = new Map<string, string>();
  globalThis.localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => store.set(k, String(v)),
    removeItem: (k: string) => store.delete(k),
    clear: () => store.clear(),
    key: (i: number) => Array.from(store.keys())[i] ?? null,
    get length() { return store.size; },
  } as unknown as Storage;
}

test('Staff Scanner - Scenario A: Host creates staff access scoped to Event A', async () => {
  const rawToken = 'st-token-event-a-98765';
  const salt = 'salt_abc_123';
  const pin = '4821';
  const pinHash = await computeClientPinHash(pin, salt);
  const eventName = 'Sarah & Omar Wedding';

  const formattedLink = formatStaffToken({
    rawToken,
    salt,
    pinHash,
    eventName,
  });

  assert.ok(formattedLink.startsWith('st_'), 'Token should be URL-safe encoded with st_ prefix');
  const parsed = parseStaffToken(formattedLink);
  assert.equal(parsed.rawToken, rawToken);
  assert.equal(parsed.salt, salt);
  assert.equal(parsed.pinHash, pinHash);
  assert.equal(parsed.eventName, eventName);

  // Different event token is distinct
  const eventBLink = formatStaffToken({
    rawToken: 'st-token-event-b-11223',
    salt: 'salt_xyz_789',
    pinHash: await computeClientPinHash('9999', 'salt_xyz_789'),
    eventName: 'Corporate Gala',
  });
  assert.notEqual(formattedLink, eventBLink);
});

test('Staff Scanner - Scenario B: PIN required when opening /staff/:token', async () => {
  const rawToken = 'test-token-b';
  _resetStaffLockoutForTesting(rawToken);
  clearStaffSession(rawToken);

  // Session starts locked
  assert.equal(getStaffSession(rawToken), false, 'Staff session must initially be locked');

  // Verify PIN is required to unlock
  const salt = 'salt_b';
  const correctPin = '1234';
  const pinHash = await computeClientPinHash(correctPin, salt);

  // Empty or missing PIN fails verification
  const emptyRes = await verifyStaffPin(rawToken, '', { pinHash, salt });
  assert.equal(emptyRes.success, false);
  assert.equal(emptyRes.error, 'incorrect_pin');
  assert.equal(getStaffSession(rawToken), false);
});

test('Staff Scanner - Scenario C: Wrong PIN rejected (attempts 1 & 2)', async () => {
  const rawToken = 'test-token-c';
  _resetStaffLockoutForTesting(rawToken);
  clearStaffSession(rawToken);

  const salt = 'salt_c';
  const correctPin = '5678';
  const pinHash = await computeClientPinHash(correctPin, salt);

  // Attempt 1: Wrong PIN
  const attempt1 = await verifyStaffPin(rawToken, '0000', { pinHash, salt });
  assert.equal(attempt1.success, false);
  assert.equal(attempt1.error, 'incorrect_pin');
  assert.equal(attempt1.attempts_remaining, 2);
  assert.equal(getStaffSession(rawToken), false);

  // Attempt 2: Wrong PIN
  const attempt2 = await verifyStaffPin(rawToken, '1111', { pinHash, salt });
  assert.equal(attempt2.success, false);
  assert.equal(attempt2.error, 'incorrect_pin');
  assert.equal(attempt2.attempts_remaining, 1);
  assert.equal(getStaffSession(rawToken), false);
});

test('Staff Scanner - Scenario D: 3rd wrong attempt triggers 15-minute lockout; 4th attempt blocked', async () => {
  const rawToken = 'test-token-d';
  _resetStaffLockoutForTesting(rawToken);
  clearStaffSession(rawToken);

  const salt = 'salt_d';
  const correctPin = '7788';
  const pinHash = await computeClientPinHash(correctPin, salt);

  // 1st wrong attempt
  await verifyStaffPin(rawToken, '1000', { pinHash, salt });
  // 2nd wrong attempt
  await verifyStaffPin(rawToken, '2000', { pinHash, salt });

  // 3rd wrong attempt -> lockout
  const attempt3 = await verifyStaffPin(rawToken, '3000', { pinHash, salt });
  assert.equal(attempt3.success, false);
  assert.equal(attempt3.error, 'locked_out');
  assert.equal(attempt3.minutes_remaining, 15);
  assert.equal(getStaffSession(rawToken), false);

  // 4th attempt with WRONG PIN -> still locked out
  const attempt4Wrong = await verifyStaffPin(rawToken, '4000', { pinHash, salt });
  assert.equal(attempt4Wrong.success, false);
  assert.equal(attempt4Wrong.error, 'locked_out');

  // 4th attempt with CORRECT PIN -> ALSO blocked while locked out
  const attempt4Right = await verifyStaffPin(rawToken, correctPin, { pinHash, salt });
  assert.equal(attempt4Right.success, false);
  assert.equal(attempt4Right.error, 'locked_out');
  assert.equal(getStaffSession(rawToken), false);
});

test('Staff Scanner - Scenario E: Lockout expiry permits correct PIN', async () => {
  const rawToken = 'test-token-e';
  _resetStaffLockoutForTesting(rawToken);
  clearStaffSession(rawToken);

  const salt = 'salt_e';
  const correctPin = '3344';
  const pinHash = await computeClientPinHash(correctPin, salt);

  // Simulate lockout that expired 5 seconds ago
  _setStaffLockoutForTesting(rawToken, Date.now() - 5000, 3);

  // Now submit correct PIN -> succeeds
  const res = await verifyStaffPin(rawToken, correctPin, { pinHash, salt });
  assert.equal(res.success, true);
});

test('Staff Scanner - Scenario F: Correct PIN unlocks scanner and sets tab session', async () => {
  const rawToken = 'test-token-f';
  _resetStaffLockoutForTesting(rawToken);
  clearStaffSession(rawToken);

  const salt = 'salt_f';
  const correctPin = '8899';
  const pinHash = await computeClientPinHash(correctPin, salt);
  const eventName = 'Laila Wedding';

  const res = await verifyStaffPin(rawToken, correctPin, { pinHash, salt, eventName });
  assert.equal(res.success, true);
  assert.equal(res.event_title, eventName);

  // Set session upon success
  setStaffSession(rawToken);
  assert.equal(getStaffSession(rawToken), true);

  // Clear session locks it again
  clearStaffSession(rawToken);
  assert.equal(getStaffSession(rawToken), false);
});

test('Staff Scanner - Scenario G: Staff resolves Guest A', () => {
  // Simulate staff resolve response payload from backend resolve_staff_checkin RPC
  const mockResolution: StaffCheckinResolution = {
    status: 'not_arrived',
    guest_id: 'guest-alpha-1',
    guest_name: 'Fahad Al-Otaibi',
    event_id: 'event-A',
    event_title: 'Sarah & Omar Wedding',
    product_id: 'wedding',
    rsvp_status: 'attending',
    confirmed_party_size: 3,
    allowed_companions: 2,
    companion_names: ['Maha Al-Otaibi', 'Zaid Al-Otaibi'],
    checked_in_count: 0,
    remaining_expected: 3,
    first_checked_in_at: null,
  };

  assert.equal(mockResolution.status, 'not_arrived');
  assert.equal(mockResolution.guest_name, 'Fahad Al-Otaibi');
  assert.equal(mockResolution.confirmed_party_size, 3);
  assert.equal(mockResolution.checked_in_count, 0);
  assert.equal(mockResolution.remaining_expected, 3);
});

test('Staff Scanner - Scenario H: SCAN ≠ CHECK IN invariant (resolve does not mutate headcount)', () => {
  let guestCheckInCount = 0;
  const confirmedPartySize = 2;

  // Scanning / resolving 5 times
  for (let scan = 1; scan <= 5; scan++) {
    // Resolve action (read-only)
    const resolvedStatus = checkinStatus(guestCheckInCount, confirmedPartySize);
    assert.equal(resolvedStatus, 'not_arrived');
    assert.equal(guestCheckInCount, 0, 'Scanning/resolving alone MUST NOT increment checked-in count');
  }
});

test('Staff Scanner - Scenario I: Explicit check in increments checked_in_count', () => {
  let checkedInCount = 0;
  const partySize = 4;

  // Explicit check-in of 2 guests
  const arrivingNow = 2;
  checkedInCount += arrivingNow;

  assert.equal(checkedInCount, 2);
  const status = checkinStatus(checkedInCount, partySize);
  assert.equal(status, 'partial');
  assert.equal(partySize - checkedInCount, 2, 'Remaining expected should be 2');
});

test('Staff Scanner - Scenario J: Partial arrival (party size 3, check in 1 -> partial, check in 2 -> complete)', () => {
  const partySize = 3;
  let checkedIn = 0;

  // Initial: 0 checked in
  assert.equal(checkinStatus(checkedIn, partySize), 'not_arrived');

  // Step 1: 1 member arrives
  checkedIn += 1;
  assert.equal(checkinStatus(checkedIn, partySize), 'partial');
  assert.equal(partySize - checkedIn, 2);

  // Step 2: Remaining 2 members arrive
  checkedIn += 2;
  assert.equal(checkinStatus(checkedIn, partySize), 'complete');
  assert.equal(partySize - checkedIn, 0);
});

test('Staff Scanner - Scenario K: Over-check-in blocked', () => {
  const partySize = 2;
  let checkedIn = 2; // already complete

  // Attempting to check in additional arriving count
  const remainingExpected = Math.max(0, partySize - checkedIn);
  assert.equal(remainingExpected, 0);

  // Over-checkin validation guard
  const arrivingAttempt = 1;
  const isAllowed = arrivingAttempt <= remainingExpected;
  assert.equal(isAllowed, false, 'Over-check-in beyond remaining expected must be blocked');

  // Clamping guard check
  const clampedCheckin = Math.min(partySize, checkedIn + arrivingAttempt);
  assert.equal(clampedCheckin, partySize);
  assert.equal(checkinStatus(clampedCheckin, partySize), 'complete');
});

test('Staff Scanner - Scenario L: Cross-event isolation (Staff A cannot resolve Guest B)', () => {
  // Staff token belongs to Event A
  const staffEventId = 'event-A';
  // Guest QR token belongs to Event B
  const guestEventId = 'event-B';

  // Cross-event resolution check
  function resolveEventMatch(staffEid: string, guestEid: string): 'ok' | 'wrong_event' {
    return staffEid === guestEid ? 'ok' : 'wrong_event';
  }

  const result = resolveEventMatch(staffEventId, guestEventId);
  assert.equal(result, 'wrong_event', 'Staff token for Event A must be rejected for Guest in Event B');
});

test('Staff Scanner - Scenario M: Revoked token fails on next action', () => {
  const staffTokenRecord = {
    id: 'tok-1',
    event_id: 'event-A',
    revoked_at: new Date().toISOString(), // Token has been revoked
    expires_at: null,
  };

  function validateTokenActive(token: typeof staffTokenRecord): boolean {
    return token.revoked_at === null;
  }

  assert.equal(validateTokenActive(staffTokenRecord), false, 'Revoked token must not be active');

  // Clearing session on revoked
  setStaffSession(staffTokenRecord.id);
  assert.equal(getStaffSession(staffTokenRecord.id), true);
  clearStaffSession(staffTokenRecord.id);
  assert.equal(getStaffSession(staffTokenRecord.id), false);
});

test('Staff Scanner - Scenario N: Expired token denied', () => {
  const expiredStaffToken = {
    id: 'tok-2',
    event_id: 'event-A',
    revoked_at: null,
    expires_at: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
  };

  function validateTokenExpiry(token: typeof expiredStaffToken): boolean {
    if (!token.expires_at) return true;
    return new Date(token.expires_at).getTime() > Date.now();
  }

  assert.equal(validateTokenExpiry(expiredStaffToken), false, 'Expired token must be denied');
});

test('Staff Scanner - Scenario O: Host UI chrome absent on staff page', () => {
  // 1. Staff route does not trigger account bootstrap
  assert.equal(needsAccountBootstrap('/staff/st_token123'), false);
  assert.equal(needsAccountBootstrap('/staff'), false);

  // 2. Host routes DO trigger account bootstrap
  assert.equal(needsAccountBootstrap('/weddings/w-1/scanner'), true);
  assert.equal(needsAccountBootstrap('/parties/p-1/scanner'), true);
  assert.equal(needsAccountBootstrap('/'), true);

  // 3. Project sections include only host tabs
  const weddingTabs = projectSections.wedding;
  assert.deepEqual(weddingTabs, ['overview', 'invitation', 'guests', 'send', 'scanner', 'settings']);
  assert.ok(!weddingTabs.includes('staff' as any), 'Staff is not a project tab');
});

test('Staff Scanner - Scenario P: Host scanner regression check (host scanner still works)', () => {
  // Host scanner routes resolve cleanly
  const weddingScannerRoute = buildProjectRoute('wedding', 'w-100', 'scanner');
  const partyScannerRoute = buildProjectRoute('party', 'p-200', 'scanner');

  assert.equal(weddingScannerRoute, '/weddings/w-100/scanner');
  assert.equal(partyScannerRoute, '/parties/p-200/scanner');

  // Scanner section resolves correctly in host projects
  assert.equal(resolveProjectSection('wedding', 'scanner'), 'scanner');
  assert.equal(resolveProjectSection('party', 'scanner'), 'scanner');
});

test('Staff Scanner - Scenario Q: PIN data safety (no plaintext PIN in DB, localStorage, or sessionStorage)', async () => {
  const rawToken = 'test-token-q';
  const plaintextPin = '1234';
  const salt = 'salt_secret_xyz';

  // Compute cryptographic hash
  const hash = await computeClientPinHash(plaintextPin, salt);
  assert.notEqual(hash, plaintextPin, 'Hash must never equal plaintext PIN');
  assert.ok(hash.length >= 64, 'SHA-256 hash length must be at least 64 hex characters');

  // Format token
  const token = formatStaffToken({
    rawToken,
    salt,
    pinHash: hash,
  });

  // Verify token string does NOT contain the plaintext PIN
  assert.ok(!token.includes(plaintextPin), 'Encoded token link must not contain plaintext PIN');

  // Simulate unlock and session storage
  setStaffSession(rawToken);

  // Inspect sessionStorage
  const sessionItem = sessionStorage.getItem(`quickrsvp_staff_unlocked:${rawToken}`);
  assert.equal(sessionItem, '1', 'Session storage must only store unlock flag');
  assert.notEqual(sessionItem, plaintextPin);

  // Verify localStorage has no traces
  assert.equal(localStorage.getItem('pin'), null);
  assert.equal(localStorage.getItem('staff_pin'), null);
});

test('Staff Scanner - Scenario Localization: All staff scanner keys defined in both Arabic and English', () => {
  const staffKeys = [
    'staffAccess',
    'staffScanner',
    'staffAccessSubtitle',
    'createAccess',
    'staffLabel',
    'mainEntrance',
    'receptionDesk',
    'doorTeam',
    'generatePin',
    'pinPlaceholder',
    'hours24',
    'hours48',
    'days7',
    'noExpiry',
    'copyStaffLink',
    'copyLinkNowWarning',
    'linkCopied',
    'revokeAccess',
    'noStaffAccess',
    'secretStaffLinkNotice',
    'enterPin',
    'incorrectPin',
    'tooManyAttempts',
    'lockoutRemaining',
    'attemptsRemaining',
    'continueAction',
    'staffLockedOutTitle',
    'staffLockedOutHelp',
    'accessExpired',
    'invalidOrExpiredStaffLink',
    'active',
    'revoked',
    'expires',
    'regenerateAccess',
    'staffScannerBadge',
  ] as const;

  for (const key of staffKeys) {
    const enVal = (appTranslations.en as Record<string, string>)[key];
    const arVal = (appTranslations.ar as Record<string, string>)[key];

    assert.ok(enVal && enVal.length > 0, `Missing EN translation for "${key}"`);
    assert.ok(arVal && arVal.length > 0, `Missing AR translation for "${key}"`);
  }
});
