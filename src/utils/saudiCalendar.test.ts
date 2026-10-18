import assert from 'node:assert/strict';
import test from 'node:test';
import {
  formatDualDateSummary,
  formatFullHijriDate,
  formatGregorianDate,
  getHijriDateParts,
  getOverlappingHijriMonths,
  SAUDI_TIME_ANCHORS,
} from './saudiCalendar.ts';

test('getHijriDateParts computes Umm al-Qura date parts in Arabic', () => {
  const parts = getHijriDateParts('2026-10-28', 'ar');
  assert.equal(parts.weekday, 'الأربعاء');
  assert.equal(parts.day, '١٧');
  assert.equal(parts.month, 'جمادى الأولى');
  assert.equal(parts.year, '١٤٤٨');
  assert.equal(parts.era, 'هـ');
});

test('getHijriDateParts computes Umm al-Qura date parts in English', () => {
  const parts = getHijriDateParts('2026-10-28', 'en');
  assert.equal(parts.weekday, 'Wednesday');
  assert.equal(parts.day, '17');
  assert.ok(parts.month.includes('Jumada'));
  assert.equal(parts.year, '1448');
  assert.equal(parts.era, 'AH');
});

test('formatFullHijriDate formats full dates in AR and EN', () => {
  const fullAr = formatFullHijriDate('2026-10-28', 'ar');
  assert.ok(fullAr.includes('١٧'));
  assert.ok(fullAr.includes('جمادى الأولى'));
  assert.ok(fullAr.includes('١٤٤٨'));
  assert.ok(fullAr.includes('هـ'));

  const fullEn = formatFullHijriDate('2026-10-28', 'en');
  assert.ok(fullEn.includes('17'));
  assert.ok(fullEn.includes('Jumada'));
  assert.ok(fullEn.includes('1448'));
  assert.ok(fullEn.includes('AH'));
  // Ensure no Arabic leaked in English mode
  assert.ok(!/[\u0600-\u06FF]/.test(fullEn));
});

test('formatDualDateSummary includes both Gregorian and Hijri without cross-locale leakage', () => {
  const summaryAr = formatDualDateSummary('2026-10-28', 'ar', true);
  assert.ok(summaryAr.includes('أكتوبر'));
  assert.ok(summaryAr.includes('جمادى الأولى'));

  const summaryEn = formatDualDateSummary('2026-10-28', 'en', true);
  assert.ok(summaryEn.includes('October'));
  assert.ok(summaryEn.includes('Jumada'));
  assert.ok(!/[\u0600-\u06FF]/.test(summaryEn), 'English dual summary should not contain Arabic characters');

  const noHijri = formatDualDateSummary('2026-10-28', 'en', false);
  assert.ok(noHijri.includes('October'));
  assert.ok(!noHijri.includes('Jumada'));
});

test('getOverlappingHijriMonths returns overlapping months for month header', () => {
  const overlappingAr = getOverlappingHijriMonths(2026, 9, 'ar'); // October 2026
  assert.ok(overlappingAr.includes('١٤٤٨'));
  assert.ok(overlappingAr.includes('هـ'));

  const overlappingEn = getOverlappingHijriMonths(2026, 9, 'en');
  assert.ok(overlappingEn.includes('1448'));
  assert.ok(overlappingEn.includes('AH'));
  assert.ok(!/[\u0600-\u06FF]/.test(overlappingEn));
});

test('SAUDI_TIME_ANCHORS contains after-isha, after-maghrib and night timings', () => {
  assert.equal(SAUDI_TIME_ANCHORS.length, 4);
  const ids = SAUDI_TIME_ANCHORS.map((a) => a.id);
  assert.ok(ids.includes('after-isha'));
  assert.ok(ids.includes('after-maghrib'));
  assert.ok(ids.includes('8pm'));
  assert.ok(ids.includes('9pm'));
});
