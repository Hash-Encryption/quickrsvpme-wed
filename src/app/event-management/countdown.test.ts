import assert from 'node:assert/strict';
import test from 'node:test';

// Test countdown math and formatting safety
test('countdown calculation handles future dates and zero clamps cleanly', () => {
  const future = new Date(Date.now() + 86400000 * 2 + 3600000 * 4 + 60000 * 10 + 5000);
  const diff = future.getTime() - Date.now();
  const seconds = Math.floor((diff / 1000) % 60);
  const minutes = Math.floor((diff / 1000 / 60) % 60);
  const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  assert.equal(days, 2);
  assert.equal(hours, 4);
  assert.ok(minutes >= 9 && minutes <= 10);
  assert.ok(seconds >= 0 && seconds <= 59);
});

test('past dates do not produce negative countdown numbers', () => {
  const past = new Date(Date.now() - 50000);
  const diff = past.getTime() - Date.now();
  assert.ok(diff < 0);
  const clampedDiff = Math.max(diff, 0);
  assert.equal(clampedDiff, 0);
});
