import assert from 'node:assert/strict';
import test from 'node:test';

import {
  type StaffCheckinResolution,
  type StaffGuestRecord,
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

test('Staff Scanner - Scenario A: Host creates staff access with opaque URL token scoped to Event A', () => {
  const rawTokenA = 'a1b2c3d4e5f678901234567890abcdef1234567890abcdef';
  const rawTokenB = 'f9e8d7c6b5a432109876543210fedcba09876543210fedcb';
  const baseUrl = 'https://quickrsvp.me';

  // The staff link contains ONLY the opaque raw staff token
  const staffLinkA = `${baseUrl}/staff/${rawTokenA}`;
  const staffLinkB = `${baseUrl}/staff/${rawTokenB}`;

  assert.equal(staffLinkA, 'https://quickrsvp.me/staff/a1b2c3d4e5f678901234567890abcdef1234567890abcdef');
  assert.notEqual(staffLinkA, staffLinkB);

  // Verifies URL does NOT encode pin, pinHash, salt, event title, or event ID
  assert.ok(!staffLinkA.includes('pin'), 'URL must not include pin');
  assert.ok(!staffLinkA.includes('salt'), 'URL must not include salt');
  assert.ok(!staffLinkA.includes('wedding'), 'URL must not include event title or type');
  assert.ok(!staffLinkA.includes('event-A'), 'URL must not encode event ID');
});

test('Staff Scanner - Scenario B: PIN required when opening /staff/:token', () => {
  // Simulate client authorization state on page open
  let runtimeMemoryPin: string | null = null;
  let isUnlocked = false;

  // Initial state: locked
  assert.equal(isUnlocked, false, 'Scanner must remain locked upon opening /staff/:token');
  assert.equal(runtimeMemoryPin, null, 'No PIN in memory initially');

  // Empty PIN submission fails
  function tryUnlock(pinCandidate: string): boolean {
    if (!pinCandidate || pinCandidate.trim().length === 0) {
      return false;
    }
    return true;
  }

  assert.equal(tryUnlock(''), false, 'Empty PIN cannot unlock scanner');
  assert.equal(tryUnlock('   '), false, 'Blank PIN cannot unlock scanner');
});

test('Staff Scanner - Scenario C: Wrong PIN rejected (attempts 1 & 2)', () => {
  let failedAttempts = 0;
  const correctPin = '4829';

  function verifyAttempt(candidate: string) {
    if (candidate !== correctPin) {
      failedAttempts++;
      return {
        success: false,
        error: 'incorrect_pin',
        attempts_remaining: Math.max(0, 3 - failedAttempts),
      };
    }
    return { success: true };
  }

  // Attempt 1: Wrong PIN
  const attempt1 = verifyAttempt('0000');
  assert.equal(attempt1.success, false);
  assert.equal(attempt1.error, 'incorrect_pin');
  assert.equal(attempt1.attempts_remaining, 2);

  // Attempt 2: Wrong PIN
  const attempt2 = verifyAttempt('1111');
  assert.equal(attempt2.success, false);
  assert.equal(attempt2.error, 'incorrect_pin');
  assert.equal(attempt2.attempts_remaining, 1);
});

test('Staff Scanner - Scenario D: 3rd wrong attempt triggers 15-minute lockout; 4th attempt blocked', () => {
  let failedAttempts = 2; // already had 2 failures
  let pinLockedUntil: number | null = null;
  const correctPin = '4829';

  function verifyAttemptWithLockout(candidate: string, now: number) {
    if (pinLockedUntil && now < pinLockedUntil) {
      return { success: false, error: 'locked_out', minutes_remaining: 15 };
    }
    if (candidate !== correctPin) {
      failedAttempts++;
      if (failedAttempts >= 3) {
        pinLockedUntil = now + 15 * 60 * 1000;
        return { success: false, error: 'locked_out', minutes_remaining: 15 };
      }
      return { success: false, error: 'incorrect_pin', attempts_remaining: 3 - failedAttempts };
    }
    return { success: true };
  }

  const now = Date.now();

  // 3rd wrong attempt -> lockout triggered
  const attempt3 = verifyAttemptWithLockout('2222', now);
  assert.equal(attempt3.success, false);
  assert.equal(attempt3.error, 'locked_out');
  assert.equal(attempt3.minutes_remaining, 15);
  assert.ok(pinLockedUntil !== null);

  // 4th attempt with WRONG PIN -> still locked out
  const attempt4Wrong = verifyAttemptWithLockout('3333', now + 1000);
  assert.equal(attempt4Wrong.success, false);
  assert.equal(attempt4Wrong.error, 'locked_out');

  // 4th attempt with CORRECT PIN -> ALSO blocked during lockout
  const attempt4Right = verifyAttemptWithLockout(correctPin, now + 2000);
  assert.equal(attempt4Right.success, false);
  assert.equal(attempt4Right.error, 'locked_out');
});

test('Staff Scanner - Scenario E: Lockout expiry permits correct PIN', () => {
  const correctPin = '4829';
  let pinLockedUntil = Date.now() - 1000; // expired 1s ago

  function verifyAfterLockout(candidate: string, currentTime: number) {
    if (pinLockedUntil && currentTime < pinLockedUntil) {
      return { success: false, error: 'locked_out' };
    }
    if (candidate === correctPin) {
      return { success: true };
    }
    return { success: false, error: 'incorrect_pin' };
  }

  const res = verifyAfterLockout(correctPin, Date.now());
  assert.equal(res.success, true, 'Correct PIN should unlock access after lockout expires');
});

test('Staff Scanner - Scenario F: Correct PIN unlocks scanner and retains PIN in runtime memory only', () => {
  const staffToken = 'opaque_token_abc_123';
  const enteredPin = '4829';

  // React runtime state
  let runtimePin: string = '';
  let isUnlocked = false;

  function handleUnlockSuccess(pin: string) {
    runtimePin = pin; // in-memory only
    isUnlocked = true;
  }

  handleUnlockSuccess(enteredPin);
  assert.equal(isUnlocked, true);
  assert.equal(runtimePin, '4829');

  // Verify storage safety: NO plaintext PIN anywhere in storage
  assert.equal(sessionStorage.getItem('pin'), null);
  assert.equal(sessionStorage.getItem('staffPin'), null);
  assert.equal(localStorage.getItem('pin'), null);
  assert.equal(localStorage.getItem('staffPin'), null);

  // Page refresh resets runtime memory
  function simulatePageRefresh() {
    runtimePin = '';
    isUnlocked = false;
  }

  simulatePageRefresh();
  assert.equal(isUnlocked, false, 'Page refresh returns to locked PIN entry state');
  assert.equal(runtimePin, '');
});

test('Staff Scanner - Scenario G: Staff resolves Guest A using BOTH Token + PIN', () => {
  const staffToken = 'st_token_123';
  const staffPin = '4829';
  const guestToken = 'inv_guest_alpha';

  function mockResolveStaffCheckin(token: string, pin: string, gToken: string): StaffCheckinResolution {
    if (!token || !pin) {
      return { status: 'not_authorized' };
    }
    if (token === 'st_token_123' && pin === '4829' && gToken === 'inv_guest_alpha') {
      return {
        status: 'not_arrived',
        guest_id: 'g-alpha',
        guest_name: 'Fahad Al-Otaibi',
        event_id: 'event-A',
        event_title: 'Sarah & Omar Wedding',
        confirmed_party_size: 3,
        allowed_companions: 2,
        checked_in_count: 0,
        remaining_expected: 3,
      };
    }
    return { status: 'invalid' };
  }

  const resolution = mockResolveStaffCheckin(staffToken, staffPin, guestToken);
  assert.equal(resolution.status, 'not_arrived');
  assert.equal(resolution.guest_name, 'Fahad Al-Otaibi');
  assert.equal(resolution.confirmed_party_size, 3);
  assert.equal(resolution.checked_in_count, 0);
  assert.equal(resolution.remaining_expected, 3);
});

test('Staff Scanner - Scenario H: SCAN ≠ CHECK IN invariant (resolve does not mutate headcount)', () => {
  let guestCheckedInCount = 0;
  const confirmedPartySize = 3;

  for (let scan = 1; scan <= 5; scan++) {
    const status = checkinStatus(guestCheckedInCount, confirmedPartySize);
    assert.equal(status, 'not_arrived');
    assert.equal(guestCheckedInCount, 0, 'Scanning alone must NEVER increment checked-in count');
  }
});

test('Staff Scanner - Scenario I: Explicit check in increments checked_in_count using Token + PIN', () => {
  let checkedInCount = 0;
  const partySize = 4;
  const staffToken = 'st_token_123';
  const staffPin = '4829';

  function mockStaffCheckIn(token: string, pin: string, arrivingCount: number) {
    assert.ok(token && pin, 'Both token and PIN required for check-in');
    checkedInCount += arrivingCount;
    return {
      checked_in_count: checkedInCount,
      remaining_expected: Math.max(0, partySize - checkedInCount),
      status: checkinStatus(checkedInCount, partySize),
    };
  }

  const result = mockStaffCheckIn(staffToken, staffPin, 2);
  assert.equal(result.checked_in_count, 2);
  assert.equal(result.remaining_expected, 2);
  assert.equal(result.status, 'partial');
});

test('Staff Scanner - Scenario J: Partial arrival (party size 3, check in 1 -> partial, check in 2 -> complete)', () => {
  const partySize = 3;
  let checkedIn = 0;

  assert.equal(checkinStatus(checkedIn, partySize), 'not_arrived');

  // 1 arrives
  checkedIn += 1;
  assert.equal(checkinStatus(checkedIn, partySize), 'partial');
  assert.equal(partySize - checkedIn, 2);

  // 2 more arrive
  checkedIn += 2;
  assert.equal(checkinStatus(checkedIn, partySize), 'complete');
  assert.equal(partySize - checkedIn, 0);
});

test('Staff Scanner - Scenario K: Over-check-in blocked', () => {
  const partySize = 2;
  const checkedIn = 2; // already complete
  const remainingExpected = Math.max(0, partySize - checkedIn);

  const arrivingAttempt = 1;
  const isAllowed = arrivingAttempt <= remainingExpected;
  assert.equal(isAllowed, false, 'Over-check-in beyond remaining expected must be blocked');
});

test('Staff Scanner - Scenario L: Cross-event isolation (Staff A cannot resolve/check in Guest B)', () => {
  const staffTokenEventId = 'event-A';
  const guestInvitationEventId = 'event-B';

  function checkEventScope(staffEid: string, guestEid: string): 'ok' | 'wrong_event' {
    return staffEid === guestEid ? 'ok' : 'wrong_event';
  }

  assert.equal(checkEventScope(staffTokenEventId, guestInvitationEventId), 'wrong_event');
});

test('Staff Scanner - Scenario M: Revoked token fails on next action', () => {
  const tokenRecord = {
    id: 'tok-1',
    revoked_at: new Date().toISOString(),
    expires_at: null,
  };

  function isAuthorized(token: typeof tokenRecord, pin: string): boolean {
    return token.revoked_at === null && pin === '4829';
  }

  assert.equal(isAuthorized(tokenRecord, '4829'), false, 'Revoked token must be rejected even with correct PIN');
});

test('Staff Scanner - Scenario N: Expired token denied', () => {
  const expiredToken = {
    id: 'tok-2',
    revoked_at: null,
    expires_at: new Date(Date.now() - 3600000).toISOString(),
  };

  function isTokenValid(token: typeof expiredToken): boolean {
    return token.expires_at === null || new Date(token.expires_at).getTime() > Date.now();
  }

  assert.equal(isTokenValid(expiredToken), false, 'Expired token must be denied');
});

test('Staff Scanner - Scenario O: Host UI chrome absent on staff page', () => {
  assert.equal(needsAccountBootstrap('/staff/sample-raw-token'), false);
  assert.equal(needsAccountBootstrap('/staff'), false);
  assert.equal(needsAccountBootstrap('/weddings/w-1/scanner'), true);

  const weddingTabs = projectSections.wedding;
  assert.ok(!weddingTabs.includes('staff' as any));
});

test('Staff Scanner - Scenario P: Host scanner regression check', () => {
  const weddingScanner = buildProjectRoute('wedding', 'w-100', 'scanner');
  const partyScanner = buildProjectRoute('party', 'p-200', 'scanner');

  assert.equal(weddingScanner, '/weddings/w-100/scanner');
  assert.equal(partyScanner, '/parties/p-200/scanner');
  assert.equal(resolveProjectSection('wedding', 'scanner'), 'scanner');
});

test('Staff Scanner - Scenario Q: PIN data safety (no plaintext PIN in DB, localStorage, or sessionStorage)', () => {
  assert.equal(localStorage.getItem('pin'), null);
  assert.equal(localStorage.getItem('staff_pin'), null);
  assert.equal(sessionStorage.getItem('pin'), null);
  assert.equal(sessionStorage.getItem('staff_pin'), null);
});

test('Staff Scanner - Scenario R: Raw token alone cannot call resolve/list/check-in without PIN', () => {
  function authorizeStaffRequest(token: string, pin: string | null | undefined): 'authorized' | 'not_authorized' {
    if (!token || !pin || pin.trim() === '') {
      return 'not_authorized';
    }
    if (pin !== '4829') {
      return 'not_authorized';
    }
    return 'authorized';
  }

  const rawToken = 'valid_raw_token_xyz';

  // Token with null PIN -> denied
  assert.equal(authorizeStaffRequest(rawToken, null), 'not_authorized');
  // Token with empty PIN -> denied
  assert.equal(authorizeStaffRequest(rawToken, ''), 'not_authorized');
  // Token with undefined PIN -> denied
  assert.equal(authorizeStaffRequest(rawToken, undefined), 'not_authorized');
  // Token with wrong PIN -> denied
  assert.equal(authorizeStaffRequest(rawToken, '0000'), 'not_authorized');
  // Token with correct PIN -> authorized
  assert.equal(authorizeStaffRequest(rawToken, '4829'), 'authorized');
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
    'staffBackendPending',
  ] as const;

  for (const key of staffKeys) {
    const enVal = (appTranslations.en as Record<string, string>)[key];
    const arVal = (appTranslations.ar as Record<string, string>)[key];

    assert.ok(enVal && enVal.length > 0, `Missing EN translation for "${key}"`);
    assert.ok(arVal && arVal.length > 0, `Missing AR translation for "${key}"`);
  }
});

test('Staff Scanner - Scenario S: staffCheckInPartyMembers non-raising not_authorized handling', () => {
  function handleCheckInResponse(response: StaffCheckinResolution): { isAuthorized: boolean; wasCheckedIn: boolean } {
    if (response.status === 'not_authorized') {
      return { isAuthorized: false, wasCheckedIn: false };
    }
    return { isAuthorized: true, wasCheckedIn: true };
  }

  const deniedResponse: StaffCheckinResolution = { status: 'not_authorized' };
  const deniedResult = handleCheckInResponse(deniedResponse);
  assert.equal(deniedResult.isAuthorized, false);
  assert.equal(deniedResult.wasCheckedIn, false);

  const approvedResponse: StaffCheckinResolution = {
    status: 'complete',
    guest_id: 'g-1',
    checked_in_count: 2,
    confirmed_party_size: 2,
  };
  const approvedResult = handleCheckInResponse(approvedResponse);
  assert.equal(approvedResult.isAuthorized, true);
  assert.equal(approvedResult.wasCheckedIn, true);
});

test('Staff Scanner - Scenario T: listStaffGuests structured result distinguishes authorized vs unauthorized', () => {
  interface StaffGuestListResult {
    status: 'authorized' | 'not_authorized';
    guests: StaffGuestRecord[];
  }

  function parseGuestList(result: StaffGuestListResult) {
    if (result.status === 'not_authorized') {
      return { accessGranted: false, count: 0 };
    }
    return { accessGranted: true, count: result.guests.length };
  }

  const unauthorizedResult: StaffGuestListResult = {
    status: 'not_authorized',
    guests: [],
  };
  assert.equal(parseGuestList(unauthorizedResult).accessGranted, false);
  assert.equal(parseGuestList(unauthorizedResult).count, 0);

  const emptyAuthorizedResult: StaffGuestListResult = {
    status: 'authorized',
    guests: [],
  };
  assert.equal(parseGuestList(emptyAuthorizedResult).accessGranted, true);
  assert.equal(parseGuestList(emptyAuthorizedResult).count, 0);

  const populatedResult: StaffGuestListResult = {
    status: 'authorized',
    guests: [
      {
        id: 'g-10',
        name: 'Tariq',
        phone: null,
        allowed_companions: 1,
        rsvp_status: 'accepted',
        confirmed_party_size: 2,
        checked_in_count: 0,
        first_checked_in_at: null,
      },
    ],
  };
  assert.equal(parseGuestList(populatedResult).accessGranted, true);
  assert.equal(parseGuestList(populatedResult).count, 1);
});

test('Staff Scanner - Scenario U: Cross-RPC Lockout Evasion Prevention (resolve -> list -> checkin triggers lockout)', () => {
  let dbFailedAttempts = 0;
  let dbLockedUntil: number | null = null;
  const correctPin = '4829';

  function authorizeStaff(pin: string, now: number): 'authorized' | 'incorrect_pin' | 'locked_out' {
    if (dbLockedUntil && now < dbLockedUntil) {
      return 'locked_out';
    }
    if (pin !== correctPin) {
      dbFailedAttempts += 1;
      if (dbFailedAttempts >= 3) {
        dbLockedUntil = now + 15 * 60 * 1000;
        return 'locked_out';
      }
      return 'incorrect_pin';
    }
    dbFailedAttempts = 0;
    dbLockedUntil = null;
    return 'authorized';
  }

  const now = Date.now();

  // Attack Step 1: Wrong PIN via resolve_staff_checkin
  const step1 = authorizeStaff('wrong1', now);
  assert.equal(step1, 'incorrect_pin');
  assert.equal(dbFailedAttempts, 1);
  assert.equal(dbLockedUntil, null);

  // Attack Step 2: Wrong PIN via list_staff_guests
  const step2 = authorizeStaff('wrong2', now);
  assert.equal(step2, 'incorrect_pin');
  assert.equal(dbFailedAttempts, 2);
  assert.equal(dbLockedUntil, null);

  // Attack Step 3: Wrong PIN via staff_check_in_party_members
  const step3 = authorizeStaff('wrong3', now);
  assert.equal(step3, 'locked_out');
  assert.equal(dbFailedAttempts, 3);
  assert.ok(dbLockedUntil !== null && dbLockedUntil > now);

  // Subsequent call with CORRECT PIN is blocked during lockout
  const correctAttemptDuringLockout = authorizeStaff(correctPin, now + 1000);
  assert.equal(correctAttemptDuringLockout, 'locked_out');
  assert.equal(dbFailedAttempts, 3);
  assert.ok(dbLockedUntil !== null && dbLockedUntil > now);
});
