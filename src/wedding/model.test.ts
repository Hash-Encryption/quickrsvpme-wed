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
  WeddingTemplateRegistry,
  type EventMode,
} from "./model.ts";
import {
  getWeddingRemainingDelay,
  getWeddingSceneIndex,
  resolveWeddingScenes,
  weddingSceneIds,
} from "./scene-engine.ts";
import {
  canonicalWeddingSceneTimings,
  WeddingLayoutPresets,
  WeddingMotionPresets,
  resolveWeddingMotionTarget,
} from "./presentation.ts";
import {
  isValidWeddingBackgroundMetadata,
  resolveWeddingVisualSelection,
  type WeddingVisualSelection,
} from "./upload.ts";

const timings = WeddingTemplateRegistry["soft-floral-garden"].scenes;
const uploadedBackground = {
  dataUrl: "data:image/webp;base64,QUJD",
  fileName: "wedding.webp",
  mimeType: "image/webp",
};

test("ready visual-template registry contains exactly the Phase 4 designs", () => {
  assert.deepEqual(Object.keys(WeddingTemplateRegistry), [
    "soft-floral-garden",
    "pearl-arch",
    "midnight-gold",
  ]);
});

test("starter presentation registries contain exactly three presets each", () => {
  assert.deepEqual(Object.keys(WeddingLayoutPresets), [
    "centered-elegance",
    "editorial-offset",
    "cinematic-focus",
  ]);
  assert.deepEqual(Object.keys(WeddingMotionPresets), [
    "soft-dissolve",
    "cinematic-rise",
    "editorial-glide",
  ]);
});

test("every layout defines semantic rules for all five wedding scenes", () => {
  for (const layout of Object.values(WeddingLayoutPresets)) {
    assert.deepEqual(Object.keys(layout.scenes), [...weddingSceneIds]);
    for (const sceneId of weddingSceneIds) {
      assert.ok(["top", "center", "bottom"].includes(layout.scenes[sceneId].vertical));
      assert.ok(["start", "center", "end"].includes(layout.scenes[sceneId].horizontal));
      assert.ok(["compact", "medium", "wide"].includes(layout.scenes[sceneId].width));
    }
  }
});

test("template presentation defaults and supported IDs reference real presets", () => {
  for (const template of Object.values(WeddingTemplateRegistry)) {
    assert.ok(WeddingLayoutPresets[template.presentation.defaultLayoutPresetId]);
    assert.ok(WeddingMotionPresets[template.presentation.defaultMotionPresetId]);
    for (const id of template.presentation.supportedLayoutPresetIds) {
      assert.ok(WeddingLayoutPresets[id]);
    }
    for (const id of template.presentation.supportedMotionPresetIds) {
      assert.ok(WeddingMotionPresets[id]);
    }
  }
});

test("every ready visual resolves the one canonical five-scene timeline", () => {
  assert.deepEqual(
    canonicalWeddingSceneTimings.map(({ id, startsAt }) => ({ id, startsAt })),
    [
      { id: "opening", startsAt: 0 },
      { id: "hosts", startsAt: 3000 },
      { id: "names", startsAt: 6000 },
      { id: "details", startsAt: 10000 },
      { id: "rsvp", startsAt: 14000 },
    ],
  );
  for (const template of Object.values(WeddingTemplateRegistry)) {
    assert.strictEqual(template.scenes, canonicalWeddingSceneTimings);
  }
});

test("Phase 2 events without presentation data migrate to template defaults", () => {
  const { presentation: _presentation, ...phase2Event } = defaultWeddingEvent;
  assert.deepEqual(mergeWeddingEvent(phase2Event).presentation, {
    layoutPresetId: "centered-elegance",
    motionPresetId: "soft-dissolve",
  });
});

test("legacy Phase 3 events without visual data migrate to ready-template mode", () => {
  const { visual: _visual, ...phase3Event } = defaultWeddingEvent;
  assert.deepEqual(mergeWeddingEvent(phase3Event).visual, {
    source: "template",
  });
});

test("legacy Wedding data defaults invitation locale to Arabic and preserves English", () => {
  assert.equal(mergeWeddingEvent({ invitationLocale: undefined }).invitationLocale, "ar");
  assert.equal(mergeWeddingEvent({ invitationLocale: "en" }).invitationLocale, "en");
  assert.equal(mergeWeddingEvent({ invitationLocale: "invalid" as "ar" }).invitationLocale, "ar");
});

test("invalid persisted visual data falls back safely", () => {
  for (const visual of [
    { source: "missing" },
    { source: "uploaded-background" },
    {
      source: "uploaded-background",
      uploadedBackground: {
        dataUrl: "blob:https://quickrsvp.me/temporary",
        fileName: "temporary.png",
        mimeType: "image/png",
      },
    },
  ]) {
    assert.deepEqual(
      mergeWeddingEvent({
        visual: visual as unknown as WeddingVisualSelection,
      }).visual,
      { source: "template" },
    );
  }
  assert.deepEqual(resolveWeddingVisualSelection(undefined), {
    source: "template",
  });
});

test("an invalid persisted layout ID resolves safely", () => {
  const invalid = mergeWeddingEvent({
    presentation: {
      layoutPresetId: "missing-layout",
      motionPresetId: "editorial-glide",
    } as unknown as typeof defaultWeddingEvent.presentation,
  });
  assert.deepEqual(invalid.presentation, {
    layoutPresetId: "centered-elegance",
    motionPresetId: "editorial-glide",
  });
});

test("an invalid persisted motion ID resolves safely", () => {
  const invalid = mergeWeddingEvent({
    presentation: {
      layoutPresetId: "cinematic-focus",
      motionPresetId: "missing-motion",
    } as unknown as typeof defaultWeddingEvent.presentation,
  });
  assert.deepEqual(invalid.presentation, {
    layoutPresetId: "cinematic-focus",
    motionPresetId: "soft-dissolve",
  });
});

test("layout selection does not change resolved wedding content", () => {
  const baseline = resolveWeddingScenes(defaultWeddingEvent, defaultWeddingGuest);
  for (const layoutPresetId of Object.keys(WeddingLayoutPresets)) {
    const event = mergeWeddingEvent({
      presentation: {
        ...defaultWeddingEvent.presentation,
        layoutPresetId: layoutPresetId as keyof typeof WeddingLayoutPresets,
      },
    });
    assert.deepEqual(resolveWeddingScenes(event, defaultWeddingGuest), baseline);
  }
});

test("motion selection does not change resolved wedding content", () => {
  const baseline = resolveWeddingScenes(defaultWeddingEvent, defaultWeddingGuest);
  for (const motionPresetId of Object.keys(WeddingMotionPresets)) {
    const event = mergeWeddingEvent({
      presentation: {
        ...defaultWeddingEvent.presentation,
        motionPresetId: motionPresetId as keyof typeof WeddingMotionPresets,
      },
    });
    assert.deepEqual(resolveWeddingScenes(event, defaultWeddingGuest), baseline);
  }
});

test("ready-template and custom-background selection preserve scene content", () => {
  const baseline = resolveWeddingScenes(defaultWeddingEvent, defaultWeddingGuest);
  for (const templateId of Object.keys(WeddingTemplateRegistry)) {
    const event = mergeWeddingEvent({ templateId });
    assert.deepEqual(resolveWeddingScenes(event, defaultWeddingGuest), baseline);
  }
  const custom = mergeWeddingEvent({
    visual: { source: "uploaded-background", uploadedBackground },
  });
  assert.deepEqual(resolveWeddingScenes(custom, defaultWeddingGuest), baseline);
});

test("valid layout and motion choices survive every visual change", () => {
  const presentation = {
    layoutPresetId: "cinematic-focus" as const,
    motionPresetId: "editorial-glide" as const,
  };
  for (const templateId of Object.keys(WeddingTemplateRegistry)) {
    assert.deepEqual(
      mergeWeddingEvent({ templateId, presentation }).presentation,
      presentation,
    );
  }
  assert.deepEqual(
    mergeWeddingEvent({
      presentation,
      visual: { source: "uploaded-background", uploadedBackground },
    }).presentation,
    presentation,
  );
});

test("all 36 visual and presentation combinations are deterministic", () => {
  const baseline = resolveWeddingScenes(defaultWeddingEvent, defaultWeddingGuest);
  let combinations = 0;
  for (const templateId of Object.keys(WeddingTemplateRegistry)) {
    for (const layoutPresetId of Object.keys(WeddingLayoutPresets)) {
      for (const motionPresetId of Object.keys(WeddingMotionPresets)) {
        const event = mergeWeddingEvent({
          templateId,
          presentation: {
            layoutPresetId: layoutPresetId as keyof typeof WeddingLayoutPresets,
            motionPresetId: motionPresetId as keyof typeof WeddingMotionPresets,
          },
        });
        assert.deepEqual(resolveWeddingScenes(event, defaultWeddingGuest), baseline);
        assert.strictEqual(
          WeddingTemplateRegistry[event.templateId as keyof typeof WeddingTemplateRegistry].scenes,
          canonicalWeddingSceneTimings,
        );
        combinations += 1;
      }
    }
  }
  for (const layoutPresetId of Object.keys(WeddingLayoutPresets)) {
    for (const motionPresetId of Object.keys(WeddingMotionPresets)) {
      const event = mergeWeddingEvent({
        visual: { source: "uploaded-background", uploadedBackground },
        presentation: {
          layoutPresetId: layoutPresetId as keyof typeof WeddingLayoutPresets,
          motionPresetId: motionPresetId as keyof typeof WeddingMotionPresets,
        },
      });
      assert.deepEqual(resolveWeddingScenes(event, defaultWeddingGuest), baseline);
      assert.strictEqual(
        WeddingTemplateRegistry[event.templateId as keyof typeof WeddingTemplateRegistry].scenes,
        canonicalWeddingSceneTimings,
      );
      combinations += 1;
    }
  }
  assert.equal(combinations, 36);
});

test("uploaded-background metadata accepts supported image types only", () => {
  for (const mimeType of ["image/jpeg", "image/png", "image/webp"]) {
    assert.equal(
      isValidWeddingBackgroundMetadata({
        dataUrl: `data:${mimeType};base64,QUJD`,
        fileName: `wedding.${mimeType.split("/")[1]}`,
        mimeType,
      }),
      true,
    );
  }
  assert.equal(
    isValidWeddingBackgroundMetadata({
      dataUrl: "data:image/gif;base64,QUJD",
      fileName: "wedding.gif",
      mimeType: "image/gif",
    }),
    false,
  );
});

test("presentation selection never changes canonical scene timing", () => {
  const baseline = timings.map(({ id, startsAt }) => ({ id, startsAt }));
  for (const layoutPresetId of Object.keys(WeddingLayoutPresets)) {
    for (const motionPresetId of Object.keys(WeddingMotionPresets)) {
      const event = mergeWeddingEvent({
        presentation: {
          layoutPresetId: layoutPresetId as keyof typeof WeddingLayoutPresets,
          motionPresetId: motionPresetId as keyof typeof WeddingMotionPresets,
        },
      });
      assert.deepEqual(
        WeddingTemplateRegistry[event.templateId].scenes,
        baseline,
      );
    }
  }
});

test("reduced motion removes translation, scale, and transition distance", () => {
  for (const preset of Object.values(WeddingMotionPresets)) {
    for (const state of [preset.enter, preset.active, preset.exit]) {
      assert.deepEqual(resolveWeddingMotionTarget(state, "rtl", true), {
        opacity: 1,
        x: 0,
        y: 0,
        scale: 1,
      });
    }
  }
  assert.equal(
    resolveWeddingMotionTarget(
      WeddingMotionPresets["editorial-glide"].enter,
      "ltr",
      false,
    ).x,
    -22,
  );
});

test("wedding data resolves into exactly five ordered scenes", () => {
  const event = mergeWeddingEvent({
    openingWording: "افتتاح خاص",
    hostNames: "أسرة المضيف",
    invitationWording: "تتشرف بدعوتكم",
    brideName: "نورة",
    groomName: "سلمان",
    eventDay: "الخميس",
    gregorianDate: "1 يونيو 2028",
    hijriDate: "7 ذو الحجة 1449 هـ",
    startTime: "8:30 مساءً",
    venue: "قاعة الورد",
    city: "الرياض",
    rsvpDeadline: "يرجى الرد قبل 20 مايو",
  });
  const scenes = resolveWeddingScenes(event, defaultWeddingGuest, "accepted");

  assert.equal(scenes.length, 5);
  assert.deepEqual(
    scenes.map((scene) => scene.id),
    weddingSceneIds,
  );
  assert.deepEqual(scenes[0], { id: "opening", wording: "افتتاح خاص" });
  assert.deepEqual(scenes[1], {
    id: "hosts",
    hostNames: "أسرة المضيف",
    invitationWording: "تتشرف بدعوتكم",
  });
  assert.deepEqual(scenes[2], {
    id: "names",
    lines: ["سلمان", "نورة"],
    fallback: "تتشرف بدعوتكم",
  });
  assert.deepEqual(scenes[3], {
    id: "details",
    eventDay: "الخميس",
    gregorianDate: "1 يونيو 2028",
    hijriDate: "7 ذو الحجة 1449 هـ",
    startTime: "8:30 مساءً",
    receptionTime: defaultWeddingEvent.receptionTime,
    dinnerTime: defaultWeddingEvent.dinnerTime,
    venue: "قاعة الورد",
    city: "الرياض",
    mapUrl: defaultWeddingEvent.mapUrl,
  });
  assert.deepEqual(scenes[4], {
    id: "rsvp",
    deadline: "يرجى الرد قبل 20 مايو",
    guestName: defaultWeddingGuest.name,
    allowedCompanions: defaultWeddingGuest.allowedCompanions,
    status: "accepted",
  });
});

test("timeline boundaries and remaining pause delay use registry timings", () => {
  assert.deepEqual(
    timings.map((scene) => scene.id),
    weddingSceneIds,
  );
  assert.equal(getWeddingSceneIndex(timings, 0), 0);
  assert.equal(getWeddingSceneIndex(timings, 2999), 0);
  assert.equal(getWeddingSceneIndex(timings, 3000), 1);
  assert.equal(getWeddingSceneIndex(timings, 6000), 2);
  assert.equal(getWeddingSceneIndex(timings, 10000), 3);
  assert.equal(getWeddingSceneIndex(timings, 14000), 4);
  assert.equal(getWeddingSceneIndex(timings, 99999), 4);
  assert.equal(getWeddingRemainingDelay(timings, 2000), 1000);
  assert.equal(getWeddingRemainingDelay(timings, 2999), 1);
  assert.equal(getWeddingRemainingDelay(timings, 14000), null);
});

test("scene resolution honors every invitation variant and guest override", () => {
  const expected = {
    both: [defaultWeddingEvent.groomName, defaultWeddingEvent.brideName],
    women: [defaultWeddingEvent.brideName],
    men: [defaultWeddingEvent.groomName],
    family: [defaultWeddingEvent.familyNames],
    custom: ["صياغة مخصصة"],
  } as const;

  for (const [invitationVariant, lines] of Object.entries(expected)) {
    const event = mergeWeddingEvent({
      invitationVariant: invitationVariant as keyof typeof expected,
      customWording: "صياغة مخصصة",
    });
    assert.deepEqual(resolveWeddingScenes(event, defaultWeddingGuest)[2], {
      id: "names",
      lines,
      fallback: event.invitationWording,
    });
  }

  const overriddenGuest = {
    ...defaultWeddingGuest,
    invitationVariantOverride: "women" as const,
  };
  assert.deepEqual(
    resolveWeddingScenes(
      mergeWeddingEvent({ invitationVariant: "men" }),
      overriddenGuest,
    )[2],
    {
      id: "names",
      lines: [defaultWeddingEvent.brideName],
      fallback: defaultWeddingEvent.invitationWording,
    },
  );
});

test("blank optional details are omitted cleanly", () => {
  const details = resolveWeddingScenes(
    mergeWeddingEvent({ mapUrl: " ", receptionTime: "", dinnerTime: "" }),
    defaultWeddingGuest,
  )[3];
  assert.equal(details.id, "details");
  if (details.id !== "details") return;
  assert.equal(details.mapUrl, undefined);
  assert.equal(details.receptionTime, undefined);
  assert.equal(details.dinnerTime, undefined);
});

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
