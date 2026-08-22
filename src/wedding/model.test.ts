import assert from "node:assert/strict";
import test from "node:test";
import {
  clampGuestCount,
  defaultWeddingEvent,
  defaultWeddingGuest,
  getWeddingPrincipalLines,
  getWhatsAppShareUrl,
  isValidGuestToken,
  mergeWeddingEvent,
  resolveInvitationTitle,
  type EventMode,
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
      { ...defaultWeddingEvent, familyNames: "آل سعود وآل ناصر" },
      "family",
    ),
    ["آل سعود وآل ناصر"],
  );
  assert.deepEqual(
    getWeddingPrincipalLines(
      { ...defaultWeddingEvent, familyNames: "", hostNames: "أسرتا آل سالم وآل ناصر" },
      "family",
    ),
    ["أسرتا آل سالم وآل ناصر"],
  );
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
  assert.equal(clampGuestCount(1, 0), 1);
  assert.equal(clampGuestCount(5, 0), 1);
  assert.equal(clampGuestCount(-2, 3), 1);
  assert.equal(clampGuestCount(2.7, 3), 3);
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

test("event mode separation preserves distinct configurations", () => {
  const standardMode: EventMode = "standard";
  const weddingMode: EventMode = "wedding";
  assert.notEqual(standardMode, weddingMode);
  assert.equal(defaultWeddingEvent.eventType, "wedding");
});

test("guest tokens validate correctly for demo, shared tokens, and custom passes", () => {
  assert.equal(isValidGuestToken("demo"), true);
  assert.equal(isValidGuestToken("DEMO"), true);
  assert.equal(isValidGuestToken("k82f9x"), true);
  assert.equal(isValidGuestToken("K82F9X"), true);
  assert.equal(isValidGuestToken("HA-001", "HA-001"), true);
  assert.equal(isValidGuestToken("ha-001", "HA-001"), true);
  assert.equal(isValidGuestToken("unknown", "HA-001"), false);
  assert.equal(isValidGuestToken(""), false);
  assert.equal(isValidGuestToken(undefined), false);
});

test("whatsapp sharing formats correctly for both standard and wedding modes", () => {
  const weddingUrl = getWhatsAppShareUrl(
    "wedding",
    "فيصل و ريم",
    "0555555555",
    "https://quickrsvp.me/i/k82f9x",
  );
  assert.ok(weddingUrl.startsWith("https://wa.me/0555555555?text="));
  assert.ok(decodeURIComponent(weddingUrl).includes("حفل الزواج"));
  assert.ok(decodeURIComponent(weddingUrl).includes("فيصل و ريم"));
  assert.ok(decodeURIComponent(weddingUrl).includes("https://quickrsvp.me/i/k82f9x"));

  const standardUrl = getWhatsAppShareUrl(
    "standard",
    "Maya & Liam",
    "+966 55 555 5555",
    "https://quickrsvp.me/i/demo",
  );
  assert.ok(standardUrl.startsWith("https://wa.me/966555555555?text="));
  assert.ok(decodeURIComponent(standardUrl).includes("Maya & Liam"));
  assert.ok(decodeURIComponent(standardUrl).includes("celebrate with you"));
  assert.ok(decodeURIComponent(standardUrl).includes("https://quickrsvp.me/i/demo"));
});

test("invitation title resolves per event mode", () => {
  assert.equal(resolveInvitationTitle("wedding", defaultWeddingEvent), "فيصل و ريم");
  assert.equal(resolveInvitationTitle("standard", defaultWeddingEvent), "Maya & Liam");
  assert.equal(
    resolveInvitationTitle("wedding", {
      ...defaultWeddingEvent,
      brideName: "",
      groomName: "",
    }),
    "دعوة زفاف",
  );
});
