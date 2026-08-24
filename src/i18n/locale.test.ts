import assert from 'node:assert/strict';
import test from 'node:test';
import { invitationTranslations } from './invitation.ts';
import { partyInvitationT, resolvePartyInvitationLocale } from './party.ts';
import { APP_LOCALE_STORAGE_KEY, localeDirection, normalizeLocale, persistAppLocale, readPersistedAppLocale, type AppLocale, type InvitationLocale } from './locale.ts';

test('AppLocale defaults to Arabic and normalizes persisted values', () => {
  assert.equal(normalizeLocale(undefined), 'ar');
  assert.equal(normalizeLocale('invalid'), 'ar');
  assert.equal(readPersistedAppLocale({ getItem: (key) => key === APP_LOCALE_STORAGE_KEY ? 'en' : null }), 'en');
});

test('AppLocale English switch persists under its independent browser key', () => {
  const values = new Map<string, string>();
  persistAppLocale({ setItem: (key, value) => values.set(key, value) }, 'en');
  assert.equal(values.get(APP_LOCALE_STORAGE_KEY), 'en');
  assert.equal(readPersistedAppLocale({ getItem: (key) => values.get(key) ?? null }), 'en');
});

test('app and invitation locales form four independent direction scopes', () => {
  const matrix: Array<[AppLocale, InvitationLocale, string, string]> = [
    ['ar', 'ar', 'rtl', 'rtl'], ['ar', 'en', 'rtl', 'ltr'],
    ['en', 'ar', 'ltr', 'rtl'], ['en', 'en', 'ltr', 'ltr'],
  ];
  for (const [app, invite, appDir, inviteDir] of matrix) {
    assert.equal(localeDirection(app), appDir);
    assert.equal(localeDirection(invite), inviteDir);
    assert.ok(invitationTranslations[invite].invitation);
  }
});

test('legacy Party state remains readable and invitation locale persists', () => {
  assert.equal(resolvePartyInvitationLocale({}), 'ar');
  assert.equal(resolvePartyInvitationLocale({ invitationLocale: 'en' }), 'en');
  assert.equal(resolvePartyInvitationLocale({ invitationLocale: 'broken' }), 'ar');
});

test('Party invitation system copy follows InvitationLocale independently', () => {
  assert.equal(partyInvitationT('en', 'noAccount'), 'No account required');
  assert.equal(partyInvitationT('ar', 'noAccount'), 'لا يلزم إنشاء حساب');
});
