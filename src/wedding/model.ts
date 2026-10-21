import {
  canonicalWeddingSceneTimings,
  resolveWeddingPresentation,
  type BlockTransform,
  type WeddingPresentation,
  type WeddingSceneId,
  type WeddingTemplatePresentation,
  type WeddingTransform,
} from "./presentation.ts";
export type { BlockTransform, WeddingTransform };
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

export const SAUDI_DAWAH_PRESETS = [
  {
    id: "royal",
    nameAr: "ملكي رسمي",
    nameEn: "Royal Traditional",
    openingAr: "بسم الله الرحمن الرحيم",
    openingEn: "In the Name of God, Most Gracious, Most Merciful",
    invitationAr: "يتشرفان بدعوتكم لحضور حفل الزفاف المبارك وتناول طعام العشاء، وبحضوركم تكتمل الأفراح والمسرات",
    invitationEn: "Cordially invite you to honor us with your presence at the wedding ceremony and dinner",
  },
  {
    id: "poetic",
    nameAr: "شاعري دافئ",
    nameEn: "Warm & Poetic",
    openingAr: "وَمِنْ آيَاتِهِ أَنْ خَلَقَ لَكُم مِّنْ أَنفُسِكُمْ أَزْوَاجًا لِّتَسْكُنُوا إِلَيْهَا",
    openingEn: "And among His signs is that He created for you mates from among yourselves",
    invitationAr: "في ليلة من ليالي الأنس والفرح، نسعد بمشاركتكم لنا بهجة العمر وجميل اللحظات",
    invitationEn: "On a night of joyous harmony, we delight in celebrating with you this blessed union",
  },
  {
    id: "women",
    nameAr: "دعوة خاصة بالسيدات",
    nameEn: "Women's Reception",
    openingAr: "بسم الله الرحمن الرحيم",
    openingEn: "In the Name of God, Most Gracious, Most Merciful",
    invitationAr: "يسرنا دعوتكم لحضور حفل زفاف ابنتنا الغالية، سائلين المولى لهما دوام السعادة والوفاق (دعوة خاصة بالسيدات)",
    invitationEn: "Joyfully invite you to the wedding reception celebrating our beloved bride (Ladies Reception)",
  },
  {
    id: "men",
    nameAr: "دعوة خاصة بالرجال",
    nameEn: "Men's Ceremony",
    openingAr: "بسم الله الرحمن الرحيم",
    openingEn: "In the Name of God, Most Gracious, Most Merciful",
    invitationAr: "يتشرف بدعوتكم لحضور حفل الزفاف وتناول طعام العشاء ومشاركتنا أبهى ليالي العمر (حفل الرجال)",
    invitationEn: "Cordially invites you to the wedding ceremony and dinner (Men's Ceremony)",
  },
  {
    id: "modern",
    nameAr: "عصري مختصر",
    nameEn: "Modern Brief",
    openingAr: "بسم الله نبدأ حكايتنا",
    openingEn: "Together with our families",
    invitationAr: "يسعدنا ويشرفنا حضوركم ومشاركتنا فرحة زواجنا",
    invitationEn: "Invite you to join us as we celebrate our wedding day",
  },
] as const;

export const SAUDI_ETIQUETTE_OPTIONS = [
  "جنة الأطفال منازلهم",
  "ممنوع التصوير",
  "الدخول ببطاقة الدعوة الشخصية",
  "تتوفر خدمة صف السيارات (Valet)",
] as const;

export type WeddingStyle = {
  backgroundColor: string;
  accentColor: string;
  floralTheme: FloralTheme;
  displayFont: ArabicFont;
  bodyFont: ArabicFont;
  backgroundOverlayOpacity?: number;  // 0 to 0.75 readability dimmer/scrim
  ambientOverlayEffect?: 'gold-dust' | 'palace-rays' | 'soft-shimmer' | 'none';
  breathingZoom?: boolean;            // Subtle slow cinematic Ken Burns zoom on background artwork
  textEntranceStyle?: 'royal-rise' | 'calligraphic-glow' | 'soft-fade' | 'instant';
  textEntranceSpeed?: 'slow' | 'normal' | 'fast';
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
  showHijriDate?: boolean;
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
  videoUrl?: string;
  invitationVariant: WeddingVariant;
  customWording: string;
  visual: WeddingVisualSelection;
  style: WeddingStyle;
  presentation: WeddingPresentation;
  enableEnvelopeOpener?: boolean;
  waxSealMonogram?: string;
  etiquetteBadges?: string[];
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
  showHijriDate: true,
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
  videoUrl: "",
  invitationVariant: "both",
  customWording: "",
  visual: { source: "template" },
  style: {
    ...WeddingTemplateRegistry["soft-floral-garden"].defaults,
    backgroundOverlayOpacity: 0,
    ambientOverlayEffect: "gold-dust",
    breathingZoom: false,
    textEntranceStyle: "royal-rise",
    textEntranceSpeed: "normal",
  },
  presentation: {
    layoutPresetId: "centered-elegance",
    motionPresetId: "soft-dissolve",
    safeZone: "auto",
    transforms: { global: { scale: 1, x: 0, y: 0 }, blocks: {} },
  },
  enableEnvelopeOpener: false,
  waxSealMonogram: "",
  etiquetteBadges: ["جنة الأطفال منازلهم"],
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
  const persisted = Object.fromEntries(
    Object.entries(value ?? {}).filter(([, item]) => item != null),
  ) as Partial<WeddingEventData>;
  const template =
    WeddingTemplateRegistry[
      (persisted.templateId ?? defaultWeddingEvent.templateId) as WeddingVisualTemplateId
    ] ??
    WeddingTemplateRegistry[
      defaultWeddingEvent.templateId as WeddingVisualTemplateId
    ];
  return {
    ...defaultWeddingEvent,
    ...persisted,
    invitationLocale: normalizeLocale(persisted.invitationLocale),
    templateId: template.id,
    showHijriDate: typeof persisted.showHijriDate === "boolean" ? persisted.showHijriDate : true,
    visual: resolveWeddingVisualSelection(persisted.visual),
    style: { ...template.defaults, ...persisted.style },
    presentation: resolveWeddingPresentation(
      persisted.presentation,
      template.presentation,
    ),
    enableEnvelopeOpener: typeof persisted.enableEnvelopeOpener === "boolean" ? persisted.enableEnvelopeOpener : false,
    waxSealMonogram: typeof persisted.waxSealMonogram === "string" ? persisted.waxSealMonogram : "",
    etiquetteBadges: Array.isArray(persisted.etiquetteBadges) ? persisted.etiquetteBadges : ["جنة الأطفال منازلهم"],
    videoUrl: typeof persisted.videoUrl === "string" ? persisted.videoUrl : (persisted.backgroundMediaUrl || ""),
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

export function normalizeWeddingRsvpDraft(
  status: "pending" | WeddingRsvp["status"],
  response: Pick<WeddingRsvp, "guestCount" | "message">,
  allowedCompanions: number,
): WeddingRsvp {
  return {
    status: status === "declined" ? "declined" : "accepted",
    guestCount: status === "declined"
      ? 0
      : clampGuestCount(response.guestCount, allowedCompanions),
    message: response.message,
  };
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

export function deriveHijriDateFromGregorian(
  dateInput: string | Date,
  locale: 'ar' | 'en' = 'ar',
): string | null {
  if (!dateInput) return null;
  let date: Date;
  if (dateInput instanceof Date) {
    date = dateInput;
  } else {
    const trimmed = dateInput.trim();
    if (!trimmed) return null;
    date = new Date(trimmed.includes('T') ? trimmed : `${trimmed}T12:00:00`);
    if (Number.isNaN(date.getTime())) {
      date = new Date(trimmed);
    }
  }
  if (Number.isNaN(date.getTime())) return null;

  try {
    const calendarLocale = locale === 'ar' ? 'ar-SA-u-ca-islamic-umalqura' : 'en-u-ca-islamic-umalqura';
    return new Intl.DateTimeFormat(calendarLocale, {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(date);
  } catch {
    return null;
  }
}

export function deriveDayOfWeekFromGregorian(
  dateInput: string | Date,
  locale: 'ar' | 'en' = 'ar',
): string | null {
  if (!dateInput) return null;
  let date: Date;
  if (dateInput instanceof Date) {
    date = dateInput;
  } else {
    const trimmed = dateInput.trim();
    if (!trimmed) return null;
    date = new Date(trimmed.includes('T') ? trimmed : `${trimmed}T12:00:00`);
    if (Number.isNaN(date.getTime())) {
      date = new Date(trimmed);
    }
  }
  if (Number.isNaN(date.getTime())) return null;

  try {
    return new Intl.DateTimeFormat(locale === 'ar' ? 'ar-SA' : 'en-GB', {
      weekday: 'long',
    }).format(date);
  } catch {
    return null;
  }
}

export type NormalizedWhatsAppResult =
  | { success: true; phone: string }
  | { success: false; error: string };

export function normalizeSaudiWhatsAppPhone(rawPhone: string): NormalizedWhatsAppResult {
  if (!rawPhone || !rawPhone.trim()) {
    return { success: false, error: 'Phone number is required.' };
  }

  let cleaned = rawPhone.trim().replace(/[\s\-.()]/g, '');

  if (cleaned.startsWith('+')) {
    cleaned = cleaned.slice(1);
  } else if (cleaned.startsWith('00')) {
    cleaned = cleaned.slice(2);
  }

  // 1. Full Saudi international format: 9665XXXXXXXX (12 digits)
  if (/^9665\d{8}$/.test(cleaned)) {
    return { success: true, phone: cleaned };
  }

  // 2. Saudi national format: 05XXXXXXXX (10 digits) -> 9665XXXXXXXX
  if (/^05\d{8}$/.test(cleaned)) {
    return { success: true, phone: `966${cleaned.slice(1)}` };
  }

  // 3. Saudi local without leading 0: 5XXXXXXXX (9 digits) -> 9665XXXXXXXX
  if (/^5\d{8}$/.test(cleaned)) {
    return { success: true, phone: `966${cleaned}` };
  }

  // 4. Valid international number with country code already supplied (8-15 digits)
  const hadCountryPrefix = rawPhone.trim().startsWith('+') || rawPhone.trim().startsWith('00');
  if (hadCountryPrefix && /^\d{8,15}$/.test(cleaned)) {
    return { success: true, phone: cleaned };
  }

  return { success: false, error: 'Invalid or unsupported phone number format.' };
}

export function getWhatsAppShareUrl(
  mode: EventMode,
  eventName: string,
  phone: string,
  invitationUrl: string,
): string {
  let cleanPhone = "";
  if (phone && phone.trim()) {
    const normalized = normalizeSaudiWhatsAppPhone(phone);
    cleanPhone = normalized.success ? normalized.phone : phone.replace(/\D/g, "");
  }
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
