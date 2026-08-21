import assert from "node:assert/strict";
import test from "node:test";
import {
  clampGuestCount,
  defaultWeddingEvent,
  getWeddingPrincipalLines,
  mergeWeddingEvent,
} from "./model.ts";

test("wedding variants never assume both names", () => {
  assert.deepEqual(getWeddingPrincipalLines(defaultWeddingEvent), [
    "فيصل",
    "ريم",
  ]);
  assert.deepEqual(getWeddingPrincipalLines(defaultWeddingEvent, "women"), [
    "ريم",
  ]);
  assert.deepEqual(getWeddingPrincipalLines(defaultWeddingEvent, "men"), [
    "فيصل",
  ]);
  assert.deepEqual(
    getWeddingPrincipalLines(
      { ...defaultWeddingEvent, customWording: "دعوة خاصة" },
      "custom",
    ),
    ["دعوة خاصة"],
  );
});

test("guest count is limited by the invitation allowance", () => {
  assert.equal(clampGuestCount(9, 2), 3);
  assert.equal(clampGuestCount(0, 2), 1);
});

test("a second event reuses the template without losing style defaults", () => {
  const event = mergeWeddingEvent({
    brideName: "نورة",
    groomName: "سلمان",
    style: { ...defaultWeddingEvent.style, floralTheme: "sage" },
  });
  assert.deepEqual(getWeddingPrincipalLines(event), ["سلمان", "نورة"]);
  assert.equal(event.templateId, "soft-floral-garden");
  assert.equal(event.style.floralTheme, "sage");
  assert.equal(event.style.backgroundColor, "#F7F1E7");
});
