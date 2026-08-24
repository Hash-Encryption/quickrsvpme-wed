import {
  canonicalWeddingSceneTimings,
  resolveWeddingPresentation,
  type WeddingPresentation,
  type WeddingSceneId,
  type WeddingTemplatePresentation,
} from "./presentation.ts";
import {
  resolveWeddingVisualSelection,
  type WeddingVisualSelection,
} from "./upload.ts";
import { normalizeLocale, type InvitationLocale } from "../i18n/locale.ts";

export type EventMode = "standard" | "wedding";
export type WeddingVariant = "women" | "men" | "both" | "family" | "custom";
export type FloralTheme =
  "blush" | "dusty-blue" | "lavender" | "champagne" | "sage" | "neutral-ivory";
export type ArabicFont = "amiri" | "reem-kufi" | "ibm-plex-arabic";

export type WeddingStyle = {
  backgroundColor: string;
  accentColor: string;
  floralTheme: FloralTheme;
  displayFont: ArabicFont;
  bodyFont: ArabicFont;
};

export type WeddingEventData = {
  eventType: "wedding";
  invitationLocale: InvitationLocale;
  templateId: string;
  brideName: string;
  groomName: string;
  familyNames: string;
  hostNames: string;
  openingWording: string;
  invitationWording: string;
  gregorianDate: string;
  hijriDate: string;
  eventDay: string;
  startTime: string;
  receptionTime: string;
  dinnerTime: string;
  venue: string;
  city: string;
  mapUrl: string;
  rsvpDeadline: string;
  musicUrl: string;
  backgroundMediaUrl: string;
  invitationVariant: WeddingVariant;
  customWording: string;
  visual: WeddingVisualSelection;
  style: WeddingStyle;
  presentation: WeddingPresentation;
};

export type WeddingGuestData = {
  name: string;
  phone: string;
  token: string;
  allowedCompanions: number;
  invitationVariantOverride?: WeddingVariant;
  qrCode?: string;
  passId?: string;
};

export type WeddingRsvp = {
  status: "accepted" | "declined";
  guestCount: number;
  message: string;
};

export type WeddingTemplateDefinition = {
  id: string;
  name: string;
  nameAr: string;
  aspectRatio: "9:16";
  scenes: ReadonlyArray<{ id: WeddingSceneId; startsAt: number }>;
  allowedCustomization: {
    backgrounds: ReadonlyArray<string>;
    accents: ReadonlyArray<string>;
    floralThemes: ReadonlyArray<FloralTheme>;
    fonts: ReadonlyArray<ArabicFont>;
    media: ReadonlyArray<"static" | "video" | "audio">;
  };
  defaults: WeddingStyle;
  presentation: WeddingTemplatePresentation;
};

export type WeddingVisualTemplateId =
  | "soft-floral-garden"
  | "pearl-arch"
  | "midnight-gold";

export const weddingFonts: Record<ArabicFont, { name: string; css: string }> = {
  amiri: { name: "أميري", css: "'Amiri', serif" },
  "reem-kufi": { name: "ريم كوفي", css: "'Reem Kufi', sans-serif" },
  "ibm-plex-arabic": {
    name: "IBM Plex Arabic",
    css: "'IBM Plex Sans Arabic', sans-serif",
  },
};

export const floralThemes: Record<
  FloralTheme,
  { name: string; petal: string; petalSoft: string; leaf: string }
> = {
  blush: {
    name: "وردي هادئ",
    petal: "#D8AEA9",
    petalSoft: "#F0DCD5",
    leaf: "#8D9A84",
  },
  "dusty-blue": {
    name: "أزرق ضبابي",
    petal: "#8195A4",
    petalSoft: "#D7E0E4",
    leaf: "#8C9885",
  },
  lavender: {
    name: "لافندر",
    petal: "#A99AB5",
    petalSoft: "#E4DCE7",
    leaf: "#8B9784",
  },
  champagne: {
    name: "شامبانيا",
    petal: "#C6A77A",
    petalSoft: "#EEE1CD",
    leaf: "#909980",
  },
  sage: {
    name: "مريمية",
    petal: "#91A18C",
    petalSoft: "#DCE4D8",
    leaf: "#74836D",
  },
  "neutral-ivory": {
    name: "عاجي محايد",
    petal: "#C8B9A6",
    petalSoft: "#EEE8DE",
    leaf: "#899084",
  },
};

const allWeddingPresentation: WeddingTemplatePresentation = {
  defaultLayoutPresetId: "centered-elegance",
  defaultMotionPresetId: "soft-dissolve",
  supportedLayoutPresetIds: [
    "centered-elegance",
    "editorial-offset",
    "cinematic-focus",
  ],
  supportedMotionPresetIds: [
    "soft-dissolve",
    "cinematic-rise",
    "editorial-glide",
  ],
};

export const WeddingTemplateRegistry: Record<
  WeddingVisualTemplateId,
  WeddingTemplateDefinition
> = {
  "soft-floral-garden": {
    id: "soft-floral-garden",
    name: "Soft Floral Garden",
    nameAr: "حديقة الزهور الناعمة",
    aspectRatio: "9:16",
    scenes: canonicalWeddingSceneTimings,
    allowedCustomization: {
      backgrounds: ["#F7F1E7", "#F3EEE7", "#F1F2ED", "#F5EFEF"],
      accents: ["#71808D", "#A98262", "#7D8B72", "#9A849E"],
      floralThemes: [
        "blush",
        "dusty-blue",
        "lavender",
        "champagne",
        "sage",
        "neutral-ivory",
      ],
      fonts: ["amiri", "reem-kufi", "ibm-plex-arabic"],
      media: ["static", "video", "audio"],
    },
    defaults: {
      backgroundColor: "#F7F1E7",
      accentColor: "#71808D",
      floralTheme: "blush",
      displayFont: "amiri",
      bodyFont: "ibm-plex-arabic",
    },
    presentation: allWeddingPresentation,
  },
  "pearl-arch": {
    id: "pearl-arch",
    name: "Pearl Arch",
    nameAr: "قوس اللؤلؤ",
    aspectRatio: "9:16",
    scenes: canonicalWeddingSceneTimings,
    allowedCustomization: {
      backgrounds: ["#F5F0E7", "#F1ECE2", "#FAF7F0", "#EEE8DD"],
      accents: ["#826D50", "#655C50", "#96785F", "#756B61"],
      floralThemes: [],
      fonts: ["amiri", "reem-kufi", "ibm-plex-arabic"],
      media: ["static", "video", "audio"],
    },
    defaults: {
      backgroundColor: "#F5F0E7",
      accentColor: "#826D50",
      floralTheme: "neutral-ivory",
      displayFont: "amiri",
      bodyFont: "ibm-plex-arabic",
    },
    presentation: allWeddingPresentation,
  },
  "midnight-gold": {
    id: "midnight-gold",
    name: "Midnight Gold",
    nameAr: "ذهب منتصف الليل",
    aspectRatio: "9:16",
    scenes: canonicalWeddingSceneTimings,
    allowedCustomization: {
      backgrounds: ["#11151E", "#17181B", "#101820", "#1D1A1A"],
      accents: ["#D6B66F", "#E2C98F", "#C9A45C", "#F0D9A2"],
      floralThemes: [],
      fonts: ["amiri", "reem-kufi", "ibm-plex-arabic"],
      media: ["static", "video", "audio"],
    },
    defaults: {
      backgroundColor: "#11151E",
      accentColor: "#D6B66F",
      floralTheme: "neutral-ivory",
      displayFont: "amiri",
      bodyFont: "ibm-plex-arabic",
    },
    presentation: allWeddingPresentation,
  },
};

export const defaultWeddingEvent: WeddingEventData = {
  eventType: "wedding",
  invitationLocale: "ar",
  templateId: "soft-floral-garden",
  brideName: "ريم",
  groomName: "فيصل",
  familyNames: "عائلتا العروس والعريس",
  hostNames: "أسرتا آل سالم وآل ناصر",
  openingWording: "بسم الله الرحمن الرحيم",
  invitationWording: "يتشرفان بدعوتكم لمشاركتهما فرحة الزواج",
  gregorianDate: "24 مايو 2027",
  hijriDate: "18 ذو الحجة 1448 هـ",
  eventDay: "الاثنين",
  startTime: "8:00 مساءً",
  receptionTime: "8:00 مساءً",
  dinnerTime: "11:00 مساءً",
  venue: "قاعة النخيل",
  city: "جدة",
  mapUrl: "https://maps.google.com",
  rsvpDeadline: "يرجى التأكيد قبل 10 مايو",
  musicUrl: "",
  backgroundMediaUrl: "",
  invitationVariant: "both",
  customWording: "",
  visual: { source: "template" },
  style: WeddingTemplateRegistry["soft-floral-garden"].defaults,
  presentation: {
    layoutPresetId: "centered-elegance",
    motionPresetId: "soft-dissolve",
  },
};

export const defaultWeddingGuest: WeddingGuestData = {
  name: "هاشم النماري",
  phone: "",
  token: "k82f9x",
  allowedCompanions: 2,
  qrCode: "https://quickrsvp.me/i/k82f9x",
  passId: "HA-001",
};

export function mergeWeddingEvent(
  value?: Partial<WeddingEventData>,
): WeddingEventData {
  const template =
    WeddingTemplateRegistry[
      (value?.templateId ?? defaultWeddingEvent.templateId) as WeddingVisualTemplateId
    ] ??
    WeddingTemplateRegistry[
      defaultWeddingEvent.templateId as WeddingVisualTemplateId
    ];
  return {
    ...defaultWeddingEvent,
    ...value,
    invitationLocale: normalizeLocale(value?.invitationLocale),
    templateId: template.id,
    visual: resolveWeddingVisualSelection(value?.visual),
    style: { ...template.defaults, ...value?.style },
    presentation: resolveWeddingPresentation(
      value?.presentation,
      template.presentation,
    ),
  };
}

export function getWeddingPrincipalLines(
  event: WeddingEventData,
  override?: WeddingVariant,
): string[] {
  const variant = override ?? event.invitationVariant;
  if (variant === "women") return [event.brideName].filter(Boolean);
  if (variant === "men") return [event.groomName].filter(Boolean);
  if (variant === "family")
    return [event.familyNames || event.hostNames].filter(Boolean);
  if (variant === "custom") return [event.customWording].filter(Boolean);
  return [event.groomName, event.brideName].filter(Boolean);
}

export function clampGuestCount(
  value: number,
  allowedCompanions: number,
): number {
  return Math.max(
    1,
    Math.min(1 + Math.max(0, allowedCompanions), Math.round(value)),
  );
}

export function isValidGuestToken(
  token?: string,
  customGuestToken?: string,
): boolean {
  if (!token) return false;
  const clean = token.trim().toLowerCase();
  if (clean === "demo" || clean === "k82f9x") return true;
  if (customGuestToken && clean === customGuestToken.trim().toLowerCase()) {
    return true;
  }
  return false;
}

export function getWhatsAppShareUrl(
  mode: EventMode,
  eventName: string,
  phone: string,
  invitationUrl: string,
): string {
  const cleanPhone = phone.replace(/\D/g, "");
  const text =
    mode === "wedding"
      ? `يسر ${eventName} دعوتكم لحضور حفل الزواج. دعوتكم الخاصة: ${invitationUrl}`
      : `${eventName} would love to celebrate with you. Your private invitation: ${invitationUrl}`;
  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`;
}

export function resolveInvitationTitle(
  mode: EventMode,
  weddingEvent: WeddingEventData,
  standardTitle = "Maya & Liam",
): string {
  if (mode === "wedding") {
    return (
      [weddingEvent.groomName, weddingEvent.brideName]
        .filter(Boolean)
        .join(" و ") || "دعوة زفاف"
    );
  }
  return standardTitle;
}
