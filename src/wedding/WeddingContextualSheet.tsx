import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  AlertCircle,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Check,
  ChevronDown,
  ChevronUp,
  ImagePlus,
  Pause,
  Play,
  RotateCcw,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import {
  WeddingTemplateRegistry,
  floralThemes,
  weddingFonts,
  deriveHijriDateFromGregorian,
  deriveDayOfWeekFromGregorian,
  SAUDI_DAWAH_PRESETS,
  SAUDI_ETIQUETTE_OPTIONS,
  type ArabicFont,
  type FloralTheme,
  type WeddingEventData,
  type WeddingVariant,
  type WeddingVisualTemplateId,
} from "./model";
import {
  WeddingLayoutPresets,
  WeddingMotionPresets,
  defaultWeddingTransform,
  resetWeddingLayoutTransforms,
  selectWeddingLayoutPreset,
  type WeddingLayoutPresetId,
  type WeddingMotionPresetId,
  type WeddingSafeZone,
  type WeddingTransformBlockId,
} from "./presentation";
import {
  defaultWeddingArtworkSettings,
  normalizeWeddingBackground,
  normalizeWeddingPoint,
} from "./upload";
import { localeDirection, type InvitationLocale } from "../i18n/locale";
import { useAppLocale } from "../i18n/app-locale";
import { weddingBuilderT } from "../i18n/wedding-builder";
import { DualHijriCalendar } from "../components/DualHijriCalendar";
import { formatDualDateSummary } from "../utils/saudiCalendar";

export { SAUDI_DAWAH_PRESETS, SAUDI_ETIQUETTE_OPTIONS };

export type WeddingEditorTab = "information" | "design" | "motion" | "more";
export type WeddingDirectEditTarget =
  | "principals"
  | "date-time"
  | "venue"
  | "occasion"
  | "hosts"
  | "opening"
  | "rsvp"
  | "artwork"
  | "style"
  | null;

type WeddingContextualSheetProps = {
  isOpen: boolean;
  activeTab: WeddingEditorTab;
  directTarget: WeddingDirectEditTarget;
  event: WeddingEventData;
  onUpdate: (patch: Partial<WeddingEventData>) => void;
  onClose: () => void;
  onReplay?: () => void;
  isSettled?: boolean;
  onToggleSettled?: (settled: boolean) => void;
  selectedBlock?: WeddingTransformBlockId;
  onSelectBlock?: (id: WeddingTransformBlockId) => void;
};

function isStreamingMusicLink(url: string): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    return (
      host.includes("spotify.com") ||
      host.includes("youtube.com") ||
      host.includes("youtu.be") ||
      host.includes("apple.com") ||
      host.includes("soundcloud.com")
    );
  } catch {
    return false;
  }
}

function isStreamingVideoLink(url: string): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    return (
      host.includes("youtube.com") ||
      host.includes("youtu.be") ||
      host.includes("vimeo.com") ||
      host.includes("tiktok.com")
    );
  } catch {
    return false;
  }
}

export function WeddingContextualSheet({
  isOpen,
  activeTab,
  directTarget,
  event,
  onUpdate,
  onClose,
  onReplay,
  isSettled = false,
  onToggleSettled,
  selectedBlock = "principals",
  onSelectBlock,
}: WeddingContextualSheetProps) {
  const { t, dir, locale } = useAppLocale();
  const w = (key: Parameters<typeof weddingBuilderT>[1]) => weddingBuilderT(locale, key);
  const contentDir = localeDirection(event.invitationLocale);
  const [showOptionalTiming, setShowOptionalTiming] = useState(
    Boolean(event.hijriDate || event.receptionTime || event.dinnerTime)
  );
  const [showOptionalWording, setShowOptionalWording] = useState(
    Boolean(event.customWording || event.mapUrl)
  );

  const [audioTesting, setAudioTesting] = useState(false);
  const audioPreviewRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    return () => {
      if (audioPreviewRef.current) {
        audioPreviewRef.current.pause();
        audioPreviewRef.current = null;
      }
    };
  }, []);

  const toggleAudioPreview = () => {
    if (!event.musicUrl) return;
    if (audioTesting && audioPreviewRef.current) {
      audioPreviewRef.current.pause();
      setAudioTesting(false);
      return;
    }
    try {
      if (!audioPreviewRef.current) {
        audioPreviewRef.current = new Audio(event.musicUrl);
        audioPreviewRef.current.onended = () => setAudioTesting(false);
        audioPreviewRef.current.onerror = () => setAudioTesting(false);
      } else {
        audioPreviewRef.current.src = event.musicUrl;
      }
      audioPreviewRef.current
        .play()
        .then(() => setAudioTesting(true))
        .catch(() => setAudioTesting(false));
    } catch {
      setAudioTesting(false);
    }
  };

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");

  if (!isOpen) return null;

  const uploaded = event.visual.source === "uploaded-background";
  const visual = event.visual;
  const template =
    WeddingTemplateRegistry[event.templateId as WeddingVisualTemplateId] ??
    WeddingTemplateRegistry["soft-floral-garden"];
  const customization = template.allowedCustomization;

  const updateVisual = (patch: Partial<typeof visual>) => {
    onUpdate({ visual: { ...visual, ...patch } as typeof visual });
  };

  const updatePresentation = (patch: Partial<WeddingEventData["presentation"]>) => {
    onUpdate({ presentation: { ...event.presentation, ...patch } });
  };

  const updateStyle = (patch: Partial<WeddingEventData["style"]>) => {
    onUpdate({ style: { ...event.style, ...patch } });
  };

  const selectTemplate = (templateId: WeddingVisualTemplateId) => {
    const nextTemplate = WeddingTemplateRegistry[templateId];
    onUpdate({
      templateId,
      visual: { source: "template" },
      style: { ...nextTemplate.defaults },
      presentation: {
        ...event.presentation,
        layoutPresetId: nextTemplate.presentation.defaultLayoutPresetId,
        motionPresetId: nextTemplate.presentation.defaultMotionPresetId,
      },
    });
  };

  const uploadBackground = async (file?: File) => {
    if (!file) return;
    setUploading(true);
    setUploadError("");
    try {
      const normalized = await normalizeWeddingBackground(file);
      onUpdate({
        visual: {
          source: "uploaded-background",
          uploadedBackground: normalized,
          ...defaultWeddingArtworkSettings,
        },
      });
    } catch {
      setUploadError(w("uploadError"));
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const nudgeArtwork = (x: number, y: number) => {
    if (visual.source !== "uploaded-background") return;
    const next = normalizeWeddingPoint({
      x: visual.backgroundPosition.x + x,
      y: visual.backgroundPosition.y + y,
    });
    updateVisual({ backgroundPosition: next, focalPoint: next });
  };

  // Resolve title
  let sheetTitle = w(activeTab);
  if (directTarget === "principals") sheetTitle = w("namesSection");
  else if (directTarget === "date-time") sheetTitle = w("timingSection");
  else if (directTarget === "venue") sheetTitle = w("venueSection");
  else if (directTarget === "occasion" || directTarget === "opening") sheetTitle = w("wordingSection");
  else if (directTarget === "hosts") sheetTitle = w("hostsSection");
  else if (directTarget === "rsvp") sheetTitle = w("rsvpSection");
  else if (directTarget === "artwork") sheetTitle = w("artwork");
  else if (directTarget === "style") sheetTitle = w("moreOptions");

  return (
    <div
      className="wedding-sheet-wrapper"
      role="region"
      aria-label={sheetTitle}
      data-testid="wedding-contextual-sheet"
    >
      <div className="wedding-sheet-header">
        <div className="wedding-sheet-handle" aria-hidden="true" />
        <div className="flex items-center justify-between gap-3 px-5 pt-1 pb-3 border-b border-[#D4AF37]/25">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#0C2D24] text-[#D4AF37]">
              <Sparkles size={14} aria-hidden="true" />
            </span>
            <h2 className="text-base font-bold text-[#0C2D24]">{sheetTitle}</h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              data-testid="button-sheet-done"
              className="focus-ring rounded-full bg-[#0C2D24] px-4 py-1.5 text-xs font-bold text-white shadow-xs transition hover:bg-[#174839]"
            >
              {w("done")}
            </button>
            <button
              type="button"
              onClick={onClose}
              data-testid="button-sheet-close"
              aria-label={w("close")}
              className="focus-ring flex h-8 w-8 items-center justify-center rounded-full text-[#68615a] hover:bg-black/5"
            >
              <X size={18} />
            </button>
          </div>
        </div>
      </div>

      <div className="wedding-sheet-body overflow-y-auto px-5 py-4 space-y-6 max-h-[60vh] sm:max-h-[70vh]">
        {/* ======================= TAB: INFORMATION OR DIRECT EDIT ======================= */}
        {(activeTab === "information" || (directTarget && directTarget !== "artwork" && directTarget !== "style")) && (
          <div className="space-y-5">
            {/* Language Selector */}
            {(!directTarget || directTarget === "principals") && (
              <div className="rounded-2xl border border-[#D4AF37]/35 bg-[#FFFDF9] p-3">
                <label className="wedding-locale-field flex items-center justify-between gap-3 text-xs font-semibold text-[#0C2D24]">
                  <span>{t("invitationLanguage")}</span>
                  <select
                    data-testid="select-wedding-invitation-locale"
                    value={event.invitationLocale}
                    onChange={(e) => onUpdate({ invitationLocale: e.target.value as InvitationLocale })}
                    className="qr-field-inline min-h-9 rounded-xl px-3 text-xs font-bold text-[#0C2D24]"
                  >
                    <option value="ar">{t("arabic")}</option>
                    <option value="en">{t("english")}</option>
                  </select>
                </label>
              </div>
            )}

            {/* Couple Names */}
            {(!directTarget || directTarget === "principals") && (
              <fieldset className="rounded-2xl border border-[#D4AF37]/30 bg-white/70 p-4 shadow-2xs">
                <legend className="px-2 text-xs font-bold text-[#0C2D24]">{w("namesSection")}</legend>
                <div className="wedding-fields mt-2" dir={contentDir}>
                  <label className="is-wide">
                    <span>{w("invitationFormat")}</span>
                    <select
                      value={event.invitationVariant}
                      onChange={(e) => onUpdate({ invitationVariant: e.target.value as WeddingVariant })}
                      dir={localeDirection(locale)}
                    >
                      <option value="both">{w("both")}</option>
                      <option value="women">{w("women")}</option>
                      <option value="men">{w("men")}</option>
                      <option value="family">{w("family")}</option>
                      <option value="custom">{w("custom")}</option>
                    </select>
                  </label>

                  {event.invitationVariant !== "women" && (
                    <label>
                      <span>{w("groom")}</span>
                      <input
                        data-testid="input-edit-groom-name"
                        value={event.groomName}
                        onChange={(e) => onUpdate({ groomName: e.target.value })}
                        placeholder={locale === "ar" ? "فيصل" : "Faisal"}
                      />
                    </label>
                  )}

                  {event.invitationVariant !== "men" && (
                    <label>
                      <span>{w("bride")}</span>
                      <input
                        data-testid="input-edit-bride-name"
                        value={event.brideName}
                        onChange={(e) => onUpdate({ brideName: e.target.value })}
                        placeholder={locale === "ar" ? "ريم" : "Reem"}
                      />
                    </label>
                  )}

                  {event.invitationVariant === "family" && (
                    <label className="is-wide">
                      <span>{w("familyNames")}</span>
                      <input
                        value={event.familyNames}
                        onChange={(e) => onUpdate({ familyNames: e.target.value })}
                        placeholder={locale === "ar" ? "عائلتا آل سالم وآل ناصر" : "Al Salem & Al Nasser Families"}
                      />
                    </label>
                  )}
                </div>
              </fieldset>
            )}

            {/* Date Section */}
            {(!directTarget || directTarget === "date-time") && (
              <fieldset className="rounded-2xl border border-[#D4AF37]/30 bg-white/70 p-4 shadow-2xs">
                {!directTarget && <legend className="px-2 text-xs font-bold text-[#0C2D24]">{w("dateSection")}</legend>}

                {/* Dual Hijri & Gregorian Calendar */}
                <div className="rounded-2xl border border-[#D4AF37]/40 bg-white/80 p-3 mb-3">
                  <span className="block text-xs font-bold text-[#0C2D24] mb-2">
                    📅 {locale === 'ar' ? 'التقويم المزدوج (هجري وميلادي)' : 'Dual Hijri & Gregorian Calendar'}
                  </span>
                  <DualHijriCalendar
                    value={event.gregorianDate}
                    onChange={(greg: string) => {
                      const derivedHijri = deriveHijriDateFromGregorian(greg, locale) || formatDualDateSummary(greg, locale);
                      const derivedDay = deriveDayOfWeekFromGregorian(greg, locale) || "";
                      onUpdate({
                        gregorianDate: greg,
                        hijriDate: derivedHijri,
                        eventDay: derivedDay,
                        showHijriDate: true,
                      });
                    }}
                    locale={locale === 'ar' ? 'ar' : 'en'}
                  />
                </div>

                <div className="wedding-fields mt-2" dir={contentDir}>
                  <label>
                    <span>{w("gregorian")}</span>
                    <input
                      data-testid="input-edit-gregorian-date"
                      value={event.gregorianDate}
                      onChange={(e) => {
                        const val = e.target.value;
                        const derivedHijri = val.trim() ? deriveHijriDateFromGregorian(val.trim(), locale) : "";
                        const derivedDay = val.trim() ? deriveDayOfWeekFromGregorian(val.trim(), locale) : "";
                        onUpdate({
                          gregorianDate: val,
                          ...(derivedHijri ? { hijriDate: derivedHijri } : {}),
                          ...(derivedDay ? { eventDay: derivedDay } : {}),
                        });
                      }}
                    />
                  </label>
                  <label>
                    <span>{w("hijri")}</span>
                    <input
                      data-testid="input-edit-hijri-date"
                      value={event.hijriDate}
                      onChange={(e) => onUpdate({ hijriDate: e.target.value })}
                    />
                  </label>
                  <label className="is-wide">
                    <span>{w("day")}</span>
                    <input
                      value={event.eventDay}
                      onChange={(e) => onUpdate({ eventDay: e.target.value })}
                      placeholder={locale === "ar" ? "الجمعة" : "Friday"}
                    />
                  </label>
                  <div className="is-wide flex items-center gap-2 pt-1">
                    <input
                      id="sheet-show-hijri"
                      data-testid="checkbox-sheet-show-hijri"
                      type="checkbox"
                      checked={event.showHijriDate !== false}
                      onChange={(e) => onUpdate({ showHijriDate: e.target.checked })}
                      className="h-4 w-4 rounded border-[#D4AF37] text-[#0C2D24] focus:ring-[#D4AF37] cursor-pointer"
                    />
                    <label htmlFor="sheet-show-hijri" className="text-xs font-semibold text-[#0C2D24] cursor-pointer select-none">
                      {w("showHijriOnInvitation")}
                    </label>
                  </div>
                </div>
              </fieldset>
            )}

            {/* Timing Section */}
            {(!directTarget || directTarget === "date-time") && (
              <fieldset className="rounded-2xl border border-[#D4AF37]/30 bg-white/70 p-4 shadow-2xs">
                {!directTarget && <legend className="px-2 text-xs font-bold text-[#0C2D24]">{w("timingSection")}</legend>}

                {/* 1-Tap Saudi Wedding Timing Chips */}
                <div className="mb-3">
                  <span className="block text-[11px] font-bold text-[#8B7040] mb-1.5">
                    ⏰ {locale === 'ar' ? 'أوقات الزفاف السعودية الشائعة (الاستقبال / الحفل)' : 'Popular Saudi Wedding Timing'}
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {['بعد صلاة العشاء', '8:30 PM', '9:00 PM', '9:30 PM', '10:30 PM', '11:00 PM'].map((timeStr) => (
                      <button
                        key={timeStr}
                        type="button"
                        onClick={() => onUpdate({ startTime: timeStr })}
                        className={`rounded-full px-2.5 py-1 text-[11px] font-semibold border transition ${
                          event.startTime === timeStr
                            ? 'bg-[#0C2D24] text-[#D4AF37] border-[#D4AF37]'
                            : 'bg-white/80 text-[#0C2D24] border-[#D4AF37]/40 hover:bg-[#D4AF37]/15'
                        }`}
                      >
                        {timeStr}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="wedding-fields mt-2" dir={contentDir}>
                  <label>
                    <span>{w("start")}</span>
                    <input
                      value={event.startTime}
                      onChange={(e) => onUpdate({ startTime: e.target.value })}
                      placeholder="8:00 PM"
                    />
                  </label>
                  <label>
                    <span>{w("reception")}</span>
                    <input
                      value={event.receptionTime}
                      onChange={(e) => onUpdate({ receptionTime: e.target.value })}
                    />
                  </label>
                  <label>
                    <span>{w("dinner")}</span>
                    <input
                      value={event.dinnerTime}
                      onChange={(e) => onUpdate({ dinnerTime: e.target.value })}
                    />
                  </label>
                </div>
              </fieldset>
            )}

            {/* Venue & Location */}
            {(!directTarget || directTarget === "venue") && (
              <fieldset className="rounded-2xl border border-[#D4AF37]/30 bg-white/70 p-4 shadow-2xs">
                {!directTarget && <legend className="px-2 text-xs font-bold text-[#0C2D24]">{w("venueSection")}</legend>}
                <div className="wedding-fields mt-2" dir={contentDir}>
                  <label>
                    <span>{w("venue")}</span>
                    <input
                      data-testid="input-edit-venue"
                      value={event.venue}
                      onChange={(e) => onUpdate({ venue: e.target.value })}
                      placeholder={locale === "ar" ? "قاعة النخيل" : "The Grand Ballroom"}
                    />
                  </label>
                  <label>
                    <span>{w("city")}</span>
                    <input
                      data-testid="input-edit-city"
                      value={event.city}
                      onChange={(e) => onUpdate({ city: e.target.value })}
                      placeholder={locale === "ar" ? "الرياض" : "Riyadh"}
                    />
                  </label>
                  <label className="is-wide">
                    <span>{w("map")}</span>
                    <input
                      value={event.mapUrl}
                      onChange={(e) => onUpdate({ mapUrl: e.target.value })}
                      placeholder="https://maps.google.com/..."
                      dir="ltr"
                    />
                  </label>
                </div>
              </fieldset>
            )}

            {/* Wording & Hosts */}
            {(!directTarget || directTarget === "occasion" || directTarget === "opening" || directTarget === "hosts") && (
              <fieldset className="rounded-2xl border border-[#D4AF37]/30 bg-white/70 p-4 shadow-2xs">
                {!directTarget && <legend className="px-2 text-xs font-bold text-[#0C2D24]">{w("wordingSection")}</legend>}

                {/* 5 1-Tap Saudi Da'wah Presets */}
                <div className="mb-3">
                  <span className="block text-[11px] font-bold text-[#8B7040] mb-1.5">
                    📜 {locale === 'ar' ? 'ديباجات زفاف ملكية جاهزة (بنقرة واحدة)' : 'Royal Saudi Wedding Da\'wah Presets'}
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {SAUDI_DAWAH_PRESETS.map((preset) => (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => {
                          onUpdate({
                            openingWording: locale === 'ar' ? preset.openingAr : preset.openingEn,
                            invitationWording: locale === 'ar' ? preset.invitationAr : preset.invitationEn,
                          });
                        }}
                        className="rounded-full px-2.5 py-1 text-[11px] font-semibold border border-[#D4AF37]/50 bg-white/80 text-[#0C2D24] hover:bg-[#D4AF37]/20 transition"
                      >
                        ✨ {locale === 'ar' ? preset.nameAr : preset.nameEn}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 1-Tap Saudi Wedding Etiquette Badges */}
                <div className="mb-3 pt-2 border-t border-[#D4AF37]/20">
                  <span className="block text-[11px] font-bold text-[#8B7040] mb-1.5">
                    🏷️ {locale === 'ar' ? 'ملاحظات الدعوة (تظهر في أسفل بطاقة الزفاف)' : 'Wedding Etiquette Badges (Bottom Micro-Pills)'}
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {SAUDI_ETIQUETTE_OPTIONS.map((badge) => {
                      const active = (event.etiquetteBadges || []).includes(badge);
                      return (
                        <button
                          key={badge}
                          type="button"
                          onClick={() => {
                            const current = event.etiquetteBadges || [];
                            const next = active
                              ? current.filter((b) => b !== badge)
                              : [...current, badge];
                            onUpdate({ etiquetteBadges: next });
                          }}
                          className={`rounded-full px-2.5 py-1 text-[11px] font-semibold border transition flex items-center gap-1 ${
                            active
                              ? 'bg-[#0C2D24] text-[#D4AF37] border-[#D4AF37]'
                              : 'bg-white/80 text-[#0C2D24] border-[#D4AF37]/40 hover:bg-[#D4AF37]/15'
                          }`}
                        >
                          {active && <Check size={11} />}
                          <span>{badge}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="wedding-fields mt-2" dir={contentDir}>
                  <label className="is-wide">
                    <span>{w("opening")}</span>
                    <input
                      value={event.openingWording}
                      onChange={(e) => onUpdate({ openingWording: e.target.value })}
                    />
                  </label>
                  <label className="is-wide">
                    <span>{w("invitationWording")}</span>
                    <input
                      value={event.invitationWording}
                      onChange={(e) => onUpdate({ invitationWording: e.target.value })}
                    />
                  </label>
                  <label className="is-wide">
                    <span>{w("hosts")}</span>
                    <input
                      value={event.hostNames}
                      onChange={(e) => onUpdate({ hostNames: e.target.value })}
                    />
                  </label>

                  {event.invitationVariant === "custom" && (
                    <label className="is-wide">
                      <span>{w("customArabic")}</span>
                      <textarea
                        value={event.customWording}
                        onChange={(e) => onUpdate({ customWording: e.target.value })}
                        rows={3}
                      />
                    </label>
                  )}
                </div>
              </fieldset>
            )}

            {/* RSVP Deadline */}
            {(!directTarget || directTarget === "rsvp") && (
              <fieldset className="rounded-2xl border border-[#D4AF37]/30 bg-white/70 p-4 shadow-2xs">
                <legend className="px-2 text-xs font-bold text-[#0C2D24]">{w("rsvpSection")}</legend>
                <div className="wedding-fields mt-2" dir={contentDir}>
                  <label className="is-wide">
                    <span>{w("deadline")}</span>
                    <input
                      value={event.rsvpDeadline}
                      onChange={(e) => onUpdate({ rsvpDeadline: e.target.value })}
                      placeholder={locale === "ar" ? "يرجى التأكيد قبل 10 مايو" : "Please confirm by May 10"}
                    />
                  </label>
                </div>
              </fieldset>
            )}
          </div>
        )}

        {/* ======================= TAB: DESIGN OR ARTWORK DIRECT EDIT ======================= */}
        {(activeTab === "design" || directTarget === "artwork" || directTarget === "style") && (
          <div className="space-y-6">
            {/* 1. Template Picker */}
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#8B7040] mb-3">
                {w("chooseTemplate")}
              </h3>
              <div className="wedding-template-list">
                {Object.values(WeddingTemplateRegistry).map((tmpl) => (
                  <button
                    key={tmpl.id}
                    type="button"
                    className={!uploaded && event.templateId === tmpl.id ? "is-selected" : ""}
                    onClick={() => selectTemplate(tmpl.id as WeddingVisualTemplateId)}
                    aria-pressed={!uploaded && event.templateId === tmpl.id}
                  >
                    <span className={`wedding-template-swatch wedding-template-swatch--${tmpl.id}`}>
                      <i />
                      <i />
                      <i />
                    </span>
                    <span>
                      <b>{locale === "ar" ? tmpl.nameAr : tmpl.name}</b>
                      <small>{locale === "ar" ? tmpl.name : tmpl.nameAr} · {w("readyTemplate")}</small>
                    </span>
                    {!uploaded && event.templateId === tmpl.id && <Check size={16} />}
                  </button>
                ))}

                {/* Upload Background Card */}
                <label
                  className={`wedding-upload-card cursor-pointer select-none relative ${uploaded ? "is-selected" : ""} ${uploading ? "opacity-60 pointer-events-none" : ""}`}
                  data-testid="upload-background-card"
                >
                  <input
                    ref={fileInputRef}
                    className="sr-only"
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/*,.jpg,.jpeg,.png,.webp"
                    disabled={uploading}
                    aria-label={w("uploadBackground")}
                    onChange={(e) => void uploadBackground(e.target.files?.[0])}
                  />
                  <span className="wedding-template-swatch wedding-template-swatch--upload overflow-hidden">
                    {uploading ? (
                      <span className="inline-block animate-spin text-[#D4AF37]">⏳</span>
                    ) : uploaded && visual.source === "uploaded-background" ? (
                      <img
                        src={visual.uploadedBackground.dataUrl}
                        alt="Preview"
                        className="h-full w-full object-cover rounded"
                      />
                    ) : (
                      <ImagePlus aria-hidden="true" size={20} />
                    )}
                  </span>
                  <span>
                    <b>{w(uploading ? "preparingImage" : uploaded ? "replaceBackground" : "customBackground")}</b>
                    <small>
                      {uploaded && visual.source === "uploaded-background"
                        ? visual.uploadedBackground.fileName
                        : w("imageOnly")}
                    </small>
                  </span>
                  {uploaded && <Check aria-hidden="true" size={16} />}
                </label>
              </div>

              {uploadError && <p className="wedding-upload-error mt-2" role="alert">{uploadError}</p>}

              {uploaded && (
                <button
                  type="button"
                  className="wedding-remove-background mt-3 text-xs text-[#8c302b] flex items-center gap-1.5 font-semibold hover:underline"
                  onClick={() => onUpdate({ visual: { source: "template" } })}
                >
                  <Trash2 size={14} aria-hidden="true" /> {w("removeBackground")}
                </button>
              )}
            </div>

            {/* 2. Custom Background Controls (Fit / Fill / Zoom / Position / Safe Zone) */}
            {uploaded && visual.source === "uploaded-background" && (
              <section className="wedding-artwork-controls rounded-2xl border border-[#D4AF37]/35 bg-white/80 p-4 shadow-2xs">
                <div className="wedding-control-heading mb-3">
                  <h4 className="text-sm font-bold text-[#0C2D24]">{w("positionArtwork")}</h4>
                  <p className="text-xs text-[#756F66]">{w("positionHelp")}</p>
                </div>

                <div className="wedding-fit-options" role="group" aria-label={w("artworkDisplay")}>
                  {(["fit", "fill"] as const).map((fitMode) => (
                    <button
                      key={fitMode}
                      type="button"
                      className={visual.fitMode === fitMode ? "is-selected" : ""}
                      aria-pressed={visual.fitMode === fitMode}
                      onClick={() =>
                        updateVisual({
                          fitMode,
                          backgroundZoom: fitMode === "fit" ? 1 : visual.backgroundZoom,
                        })
                      }
                    >
                      {w(fitMode)}
                    </button>
                  ))}
                </div>

                <p className="wedding-fit-help mt-2 text-xs text-[#756F66]">
                  {w(visual.fitMode === "fit" ? "fitHelp" : "fillHelp")}
                </p>

                {visual.fitMode === "fill" && (
                  <div className="mt-4 pt-3 border-t border-[#D4AF37]/20 space-y-3">
                    <label className="wedding-zoom-control">
                      <span>{w("zoom")}</span>
                      <input
                        type="range"
                        min="1"
                        max="2"
                        step="0.05"
                        value={visual.backgroundZoom}
                        onChange={(e) => updateVisual({ backgroundZoom: Number(e.target.value) })}
                      />
                      <output>{Math.round(visual.backgroundZoom * 100)}%</output>
                    </label>

                    <div className="wedding-nudge-controls" aria-label={w("positionFallback")}>
                      <button type="button" onClick={() => nudgeArtwork(0, -0.05)} aria-label={w("moveUp")}>
                        <ArrowUp size={16} />
                      </button>
                      <button type="button" onClick={() => nudgeArtwork(-0.05, 0)} aria-label={w("moveLeft")}>
                        <ArrowLeft size={16} />
                      </button>
                      <button
                        type="button"
                        className="is-center"
                        onClick={() =>
                          updateVisual({
                            backgroundPosition: { x: 0.5, y: 0.5 },
                            focalPoint: { x: 0.5, y: 0.5 },
                          })
                        }
                      >
                        {w("centerArtwork")}
                      </button>
                      <button type="button" onClick={() => nudgeArtwork(0.05, 0)} aria-label={w("moveRight")}>
                        <ArrowRight size={16} />
                      </button>
                      <button type="button" onClick={() => nudgeArtwork(0, 0.05)} aria-label={w("moveDown")}>
                        <ArrowDown size={16} />
                      </button>
                    </div>
                  </div>
                )}

                {/* Safe Text Zone (Conservative Auto/Top/Center/Bottom) */}
                <div className="mt-4 pt-3 border-t border-[#D4AF37]/20">
                  <span className="block text-xs font-bold text-[#0C2D24] mb-2">{w("safeZone")}</span>
                  <div className="grid grid-cols-4 gap-1.5" role="group" aria-label={w("safeZone")}>
                    {(["auto", "top", "center", "bottom"] as const).map((sz) => (
                      <button
                        key={sz}
                        type="button"
                        className={`min-h-9 rounded-xl border text-xs font-semibold ${
                          event.presentation.safeZone === sz
                            ? "bg-[#0C2D24] text-white border-[#0C2D24]"
                            : "bg-[#FFFDF9] text-[#615a53] border-[#d8cec1]"
                        }`}
                        aria-pressed={event.presentation.safeZone === sz}
                        onClick={() => updatePresentation({ safeZone: sz })}
                      >
                        {w(sz)}
                      </button>
                    ))}
                  </div>
                </div>
              </section>
            )}

            {/* 3. Style: Colors and Fonts */}
            <section className="rounded-2xl border border-[#D4AF37]/30 bg-white/70 p-4 shadow-2xs space-y-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#8B7040]">
                {w("moreOptions")}
              </h4>

              {/* Background Color swatches (when template) */}
              {!uploaded && customization.backgrounds.length > 0 && (
                <div>
                  <span className="block text-xs font-semibold text-[#68615a] mb-2">{w("background")}</span>
                  <div className="wedding-color-options">
                    {customization.backgrounds.map((color) => (
                      <button
                        key={color}
                        type="button"
                        style={{ backgroundColor: color }}
                        className={event.style.backgroundColor === color ? "is-selected" : ""}
                        onClick={() => updateStyle({ backgroundColor: color })}
                        aria-label={`${w("background")} ${color}`}
                        aria-pressed={event.style.backgroundColor === color}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Accent Color swatches (when template) */}
              {!uploaded && customization.accents.length > 0 && (
                <div>
                  <span className="block text-xs font-semibold text-[#68615a] mb-2">{w("headingColor")}</span>
                  <div className="wedding-color-options">
                    {customization.accents.map((color) => (
                      <button
                        key={color}
                        type="button"
                        style={{ backgroundColor: color }}
                        className={event.style.accentColor === color ? "is-selected" : ""}
                        onClick={() => updateStyle({ accentColor: color })}
                        aria-label={`${w("headingColor")} ${color}`}
                        aria-pressed={event.style.accentColor === color}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Floral theme (if template has floral themes) */}
              {!uploaded && customization.floralThemes.length > 0 && (
                <div>
                  <label className="text-xs font-semibold text-[#68615a] block mb-1">
                    {w("flowers")}
                  </label>
                  <select
                    value={event.style.floralTheme}
                    onChange={(e) => updateStyle({ floralTheme: e.target.value as FloralTheme })}
                    className="qr-field-inline min-h-11 w-full rounded-xl px-3 text-xs"
                  >
                    {customization.floralThemes.map((key) => (
                      <option key={key} value={key}>
                        {floralThemes[key].name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Fonts */}
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-semibold text-[#68615a] block mb-1">
                    {w("namesFont")}
                  </label>
                  <select
                    value={event.style.displayFont}
                    onChange={(e) => updateStyle({ displayFont: e.target.value as ArabicFont })}
                    className="qr-field-inline min-h-11 w-full rounded-xl px-3 text-xs font-semibold"
                  >
                    {customization.fonts.map((key) => (
                      <option key={key} value={key}>
                        {weddingFonts[key].name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-[#68615a] block mb-1">
                    {w("infoFont")}
                  </label>
                  <select
                    value={event.style.bodyFont}
                    onChange={(e) => updateStyle({ bodyFont: e.target.value as ArabicFont })}
                    className="qr-field-inline min-h-11 w-full rounded-xl px-3 text-xs"
                  >
                    {customization.fonts.map((key) => (
                      <option key={key} value={key}>
                        {weddingFonts[key].name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </section>

            {/* 4. Living Video Atmosphere & Background Overlays */}
            <section className="rounded-2xl border border-[#D4AF37]/30 bg-white/70 p-4 shadow-2xs space-y-4">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#8B7040]">
                  {locale === "ar" ? "المؤثرات الحية وتحسين القراءة" : "Living Atmosphere & Readability"}
                </h4>
                <p className="mt-1 text-xs text-[#756F66]">
                  {locale === "ar"
                    ? "إضفاء طابع سينمائي حيوي على الخلفية وضبط تباين النصوص لتبدو كفيديو فاخر"
                    : "Add living motion effects and adjust background contrast for crisp, luxurious calligraphy"}
                </p>
              </div>

              {/* Readability Dimmer / Scrim Slider */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-[#68615a]">
                    {locale === "ar" ? "تعتيم الخلفية لسهولة القراءة" : "Readability Dimmer (Background Scrim)"}
                  </span>
                  <span className="font-bold text-[#0C2D24]">
                    {Math.round((event.style.backgroundOverlayOpacity ?? 0) * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="0.75"
                  step="0.05"
                  value={event.style.backgroundOverlayOpacity ?? 0}
                  onChange={(e) => updateStyle({ backgroundOverlayOpacity: Number(e.target.value) })}
                  className="w-full accent-[#0C2D24]"
                  data-testid="slider-readability-dimmer"
                />
              </div>

              {/* Living Video Atmosphere Effect */}
              <div>
                <span className="block text-xs font-semibold text-[#68615a] mb-2">
                  {locale === "ar" ? "المؤثرات الحية للخلفية" : "Living Atmosphere Effect"}
                </span>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="group" aria-label="Living Atmosphere Effect">
                  {[
                    { id: "none", labelAr: "بدون", labelEn: "None", icon: "⊘" },
                    { id: "gold-dust", labelAr: "ذرات الذهب", labelEn: "Gold Dust", icon: "✨" },
                    { id: "palace-rays", labelAr: "أشعة القصر", labelEn: "Palace Rays", icon: "☀️" },
                    { id: "soft-shimmer", labelAr: "بريق ناعم", labelEn: "Soft Shimmer", icon: "💫" },
                  ].map((effect) => {
                    const active = (event.style.ambientOverlayEffect ?? "none") === effect.id;
                    return (
                      <button
                        key={effect.id}
                        type="button"
                        onClick={() => updateStyle({ ambientOverlayEffect: effect.id as any })}
                        data-testid={`button-ambient-${effect.id}`}
                        aria-pressed={active}
                        className={`flex items-center justify-center gap-1.5 min-h-10 px-3 py-2 rounded-xl border text-xs font-semibold transition ${
                          active
                            ? "bg-[#0C2D24] text-[#F3E5AB] border-[#0C2D24] shadow-xs"
                            : "bg-[#FFFDF9] text-[#615a53] border-[#d8cec1] hover:border-[#D4AF37]"
                        }`}
                      >
                        <span aria-hidden="true">{effect.icon}</span>
                        <span>{locale === "ar" ? effect.labelAr : effect.labelEn}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Breathing Zoom Toggle */}
              <div className="pt-2 border-t border-[#F0EBE1]">
                <label className="flex items-center justify-between cursor-pointer py-1">
                  <div className="flex items-center gap-2">
                    <span className="text-base" aria-hidden="true">🌬️</span>
                    <div>
                      <span className="block text-xs font-bold text-[#0C2D24]">
                        {locale === "ar" ? "حركة تنفس هادئة للمشهد" : "Subtle Breathing Motion (Slow Zoom)"}
                      </span>
                      <span className="block text-[11px] text-[#756F66]">
                        {locale === "ar"
                          ? "حركة تقريب سينمائية بطيئة تعطي إحساس الفيديو للصور الثابتة"
                          : "Subtle slow cinematic zoom bringing static photos to life"}
                      </span>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={Boolean(event.style.breathingZoom)}
                    onChange={(e) => updateStyle({ breathingZoom: e.target.checked })}
                    data-testid="toggle-breathing-zoom"
                    className="h-4 w-4 rounded border-gray-300 text-[#0C2D24] accent-[#0C2D24] focus:ring-[#0C2D24]"
                  />
                </label>
              </div>

              {/* Background Video URL direct field in Design tab */}
              <div className="pt-2 border-t border-[#F0EBE1] space-y-1.5">
                <div className="flex items-center justify-between">
                  <label htmlFor="input-design-video-url" className="text-xs font-semibold text-[#68615a]">
                    {locale === "ar" ? "رابط فيديو الخلفية المباشر (MP4 / WebM)" : "Direct Background Video URL (MP4 / WebM)"}
                  </label>
                  {(event.videoUrl || event.backgroundMediaUrl) && (
                    <span className="inline-flex items-center gap-1 text-[11px] text-[#0C2D24] font-medium">
                      <span className="h-2 w-2 rounded-full bg-[#0C2D24]" />
                      {w("videoConfigured")}
                    </span>
                  )}
                </div>
                <input
                  id="input-design-video-url"
                  type="url"
                  placeholder="https://.../video.mp4"
                  dir="ltr"
                  value={event.videoUrl || event.backgroundMediaUrl || ""}
                  onChange={(e) => {
                    const val = e.target.value;
                    onUpdate({ videoUrl: val, backgroundMediaUrl: val });
                  }}
                  data-testid="input-background-video-url"
                  className="qr-field-inline min-h-11 w-full rounded-xl px-3 text-xs"
                />
                <p className="text-[11px] text-[#756F66]">
                  {locale === "ar"
                    ? "رابط مباشر لملف فيديو 9:16 يعمل بتكرار سلس كخلفية حية خلف الخطوط الملكية"
                    : "Direct 9:16 video loop behind the calligraphy for a live motion invitation"}
                </p>
              </div>
            </section>
          </div>
        )}

        {/* ======================= TAB: MOTION ======================= */}
        {activeTab === "motion" && (
          <div className="space-y-5">
            <div className="wedding-control-heading">
              <h3 className="text-sm font-bold text-[#0C2D24]">{w("motion")}</h3>
              <p className="text-xs text-[#756F66]">{w("motionHelp")}</p>
            </div>

            {/* Motion Presets Grid */}
            <div className="grid gap-3">
              {template.presentation.supportedMotionPresetIds.map((id) => {
                const preset = WeddingMotionPresets[id];
                const selected = !isSettled && event.presentation.motionPresetId === id;
                return (
                  <button
                    key={id}
                    type="button"
                    className={`flex items-start gap-3 p-3.5 rounded-2xl border text-start transition ${
                      selected
                        ? "border-[#0C2D24] bg-[#0C2D24]/5 shadow-sm"
                        : "border-[#D4AF37]/30 bg-white hover:border-[#0C2D24]"
                    }`}
                    onClick={() => {
                      onToggleSettled?.(false);
                      updatePresentation({ motionPresetId: id });
                      onReplay?.();
                    }}
                    aria-pressed={selected}
                  >
                    <span
                      className={`wedding-motion-mark wedding-motion-mark--${id} shrink-0 mt-0.5`}
                      aria-hidden="true"
                    >
                      <i />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <strong className="text-xs font-bold text-[#0C2D24]">
                          {locale === "ar" ? preset.nameAr : preset.name}
                        </strong>
                        {selected && <Check size={16} className="text-[#0C2D24]" />}
                      </div>
                      <p className="mt-1 text-[11px] text-[#756F66] leading-relaxed">
                        {locale === "ar" ? preset.descriptionAr : preset.name}
                      </p>
                    </div>
                  </button>
                );
              })}

              {/* Static / Settled Option (Design Choice, distinct from accessibility reduced-motion) */}
              <button
                type="button"
                className={`flex items-start gap-3 p-3.5 rounded-2xl border text-start transition ${
                  isSettled
                    ? "border-[#0C2D24] bg-[#0C2D24]/5 shadow-sm"
                    : "border-[#D4AF37]/30 bg-white hover:border-[#0C2D24]"
                }`}
                onClick={() => onToggleSettled?.(true)}
                aria-pressed={isSettled}
              >
                <span className="wedding-motion-mark shrink-0 mt-0.5 flex items-center justify-center bg-[#f4eee5]">
                  <Check size={16} className="text-[#71808d]" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <strong className="text-xs font-bold text-[#0C2D24]">{w("noneMotion")}</strong>
                    {isSettled && <Check size={16} className="text-[#0C2D24]" />}
                  </div>
                  <p className="mt-1 text-[11px] text-[#756F66] leading-relaxed">
                    {w("noneMotionDesc")}
                  </p>
                </div>
              </button>
            </div>

            {/* Text Entrance Style & Speed Section */}
            <div className="rounded-2xl border border-[#D4AF37]/30 bg-white/70 p-4 shadow-2xs space-y-4">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#8B7040]">
                  {locale === "ar" ? "طريقة وتوقيت تدفق الخط العربي" : "Calligraphic Entrance Flow & Speed"}
                </h4>
                <p className="mt-1 text-xs text-[#756F66]">
                  {locale === "ar"
                    ? "تخصيص تسلسل ظهور الآية، أسماء العائلتين، العروسين، والتفاصيل كفيديو موشن جرافيكس"
                    : "Choreograph how each calligraphic block emerges sequentially like a motion graphics video"}
                </p>
              </div>

              {/* Entrance Style Selection */}
              <div>
                <span className="block text-xs font-semibold text-[#68615a] mb-2">
                  {locale === "ar" ? "أسلوب حركة النصوص" : "Entrance Style"}
                </span>
                <div className="grid gap-2 sm:grid-cols-2" role="group" aria-label="Text Entrance Style">
                  {[
                    {
                      id: "royal-rise",
                      labelAr: "ارتقاء ملكي",
                      labelEn: "Royal Rise",
                      descAr: "صعود تدريجي ناعم مع توهج ذهبي خفيف",
                      descEn: "Smooth upward emergence with golden glow",
                    },
                    {
                      id: "calligraphic-glow",
                      labelAr: "توهج خطي",
                      labelEn: "Calligraphic Glow",
                      descAr: "ظهور بانبثاق وتوهج خطوط أصيلة",
                      descEn: "Soft radiant illumination of calligraphy",
                    },
                    {
                      id: "soft-fade",
                      labelAr: "تلاشي حريري",
                      labelEn: "Soft Fade",
                      descAr: "تدرج شفافية سينمائي ناعم",
                      descEn: "Gentle cinematic dissolve",
                    },
                    {
                      id: "instant",
                      labelAr: "فوري ومباشر",
                      labelEn: "Instant",
                      descAr: "ظهور النص مباشرة بدون تأخير",
                      descEn: "Direct display without animation delay",
                    },
                  ].map((style) => {
                    const active = (event.style.textEntranceStyle ?? "royal-rise") === style.id;
                    return (
                      <button
                        key={style.id}
                        type="button"
                        onClick={() => {
                          updateStyle({ textEntranceStyle: style.id as any });
                          onReplay?.();
                        }}
                        data-testid={`button-entrance-${style.id}`}
                        aria-pressed={active}
                        className={`p-3 rounded-xl border text-start transition ${
                          active
                            ? "border-[#0C2D24] bg-[#0C2D24]/5 shadow-xs"
                            : "border-[#D4AF37]/30 bg-white hover:border-[#0C2D24]"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <strong className="text-xs font-bold text-[#0C2D24]">
                            {locale === "ar" ? style.labelAr : style.labelEn}
                          </strong>
                          {active && <Check size={14} className="text-[#0C2D24]" />}
                        </div>
                        <p className="mt-1 text-[11px] text-[#756F66]">
                          {locale === "ar" ? style.descAr : style.descEn}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Entrance Speed Selection */}
              <div>
                <span className="block text-xs font-semibold text-[#68615a] mb-2">
                  {locale === "ar" ? "سرعة التدفق الزمني" : "Pacing & Speed"}
                </span>
                <div className="grid grid-cols-3 gap-2" role="group" aria-label="Text Entrance Speed">
                  {[
                    { id: "slow", labelAr: "هادئ وملكي", labelEn: "Slow & Regal" },
                    { id: "normal", labelAr: "طبيعي معتدل", labelEn: "Balanced" },
                    { id: "fast", labelAr: "سريع وحيوي", labelEn: "Brisk" },
                  ].map((speed) => {
                    const active = (event.style.textEntranceSpeed ?? "normal") === speed.id;
                    return (
                      <button
                        key={speed.id}
                        type="button"
                        onClick={() => {
                          updateStyle({ textEntranceSpeed: speed.id as any });
                          onReplay?.();
                        }}
                        data-testid={`button-speed-${speed.id}`}
                        aria-pressed={active}
                        className={`min-h-10 px-2 py-1.5 rounded-xl border text-center text-xs font-semibold transition ${
                          active
                            ? "bg-[#0C2D24] text-white border-[#0C2D24]"
                            : "bg-white text-[#615a53] border-[#d8cec1] hover:border-[#D4AF37]"
                        }`}
                      >
                        {locale === "ar" ? speed.labelAr : speed.labelEn}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Quick Replay button */}
            <div className="pt-2">
              <button
                type="button"
                onClick={onReplay}
                className="focus-ring flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl border border-[#D4AF37]/50 bg-[#0C2D24] px-5 text-xs font-bold text-white shadow-xs transition hover:bg-[#174839]"
              >
                <RotateCcw size={15} />
                <span>{w("replay")}</span>
              </button>
            </div>
          </div>
        )}

        {/* ======================= TAB: MORE ======================= */}
        {activeTab === "more" && (
          <div className="space-y-6">
            {/* 3D Couple Monogram Wax Seal Envelope */}
            <div className="rounded-2xl border border-[#D4AF37]/35 bg-white/70 p-4 shadow-2xs space-y-3.5">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-[#8B7040]">
                    {locale === "ar" ? "ظرف الفخامة بختم الشمع الملكي (3D)" : "Luxury 3D Wax Seal Envelope"}
                  </h4>
                  <p className="mt-1 text-xs text-[#756F66]">
                    {locale === "ar"
                      ? "ظرف فاخر بختم شمعي يفتحه الضيف بلمسة قبل عرض بطاقة الزفاف"
                      : "Interactive royal envelope with couple monogram wax seal opening experience"}
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={event.enableEnvelopeOpener !== false}
                    onChange={(e) => onUpdate({ enableEnvelopeOpener: e.target.checked })}
                    data-testid="toggle-envelope-opener"
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#0C2D24]"></div>
                </label>
              </div>

              {event.enableEnvelopeOpener !== false && (
                <div className="pt-2 border-t border-[#F0EBE1] space-y-2">
                  <label htmlFor="input-wax-seal-monogram" className="block text-xs font-semibold text-[#68615a]">
                    {locale === "ar" ? "نقش الختم الشمعي (حرفان أو رمز)" : "Wax Seal Monogram (2 letters or symbol)"}
                  </label>
                  <input
                    id="input-wax-seal-monogram"
                    type="text"
                    value={event.waxSealMonogram || ""}
                    onChange={(e) => onUpdate({ waxSealMonogram: e.target.value })}
                    placeholder={
                      event.groomName && event.brideName
                        ? `${event.groomName.trim().charAt(0)} & ${event.brideName.trim().charAt(0)}`
                        : "ف & ر"
                    }
                    data-testid="input-wax-seal-monogram"
                    maxLength={10}
                    className="qr-field-inline min-h-11 w-full rounded-xl px-3 text-xs font-bold text-center tracking-wider"
                  />
                  <p className="text-[11px] text-[#756F66]">
                    {locale === "ar"
                      ? "مثال: ف & ر (فيصل وريم) أو F&R ليتم نقشها ثلاثية الأبعاد على الختم الشمعي"
                      : "Example: F&R or couple initials embossed directly on the 3D wax seal"}
                  </p>
                </div>
              )}
            </div>

            {/* Layout Preset selection */}
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#8B7040] mb-3">
                {w("layout")}
              </h3>
              <div className="grid gap-2.5">
                {template.presentation.supportedLayoutPresetIds.map((id) => {
                  const preset = WeddingLayoutPresets[id];
                  const selected = event.presentation.layoutPresetId === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      className={`flex flex-col sm:flex-row items-stretch sm:items-start gap-3 p-3 rounded-2xl border text-start transition min-h-[44px] ${
                        selected
                          ? "border-[#0C2D24] bg-[#0C2D24]/5 shadow-sm"
                          : "border-[#D4AF37]/30 bg-white hover:border-[#0C2D24]"
                      }`}
                      onClick={() =>
                        updatePresentation(selectWeddingLayoutPreset(event.presentation, id))
                      }
                      aria-pressed={selected}
                    >
                      <span className={`wedding-layout-diagram wedding-layout-diagram--${id} w-16 h-12 shrink-0 self-center sm:self-start`}>
                        <i />
                        <i />
                        <i />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <strong className="text-xs font-bold text-[#0C2D24] break-words">
                            {locale === "ar" ? preset.nameAr : preset.name}
                          </strong>
                          {selected && <Check size={16} className="text-[#0C2D24] shrink-0" />}
                        </div>
                        <p className="mt-1 text-[10px] text-[#756F66] break-words">
                          {locale === "ar" ? preset.descriptionAr : preset.name}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Music & Video */}
            <div className="rounded-2xl border border-[#D4AF37]/30 bg-white/70 p-4 shadow-2xs space-y-4">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#8B7040]">
                  {w("musicAndVideo")}
                </h4>
                <p className="mt-1 text-xs text-[#756F66]">
                  {w("musicAndVideoDesc")}
                </p>
              </div>

              {/* Background Music */}
              <div className="space-y-2 pt-1 border-t border-[#F0EBE1]">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#68615a]">{w("musicUrlLabel")}</span>
                  <span className={`inline-flex items-center gap-1.5 text-[11px] font-medium ${event.musicUrl ? "text-[#0C2D24]" : "text-[#756F66]"}`}>
                    <span className={`h-2 w-2 rounded-full ${event.musicUrl ? "bg-[#0C2D24]" : "bg-[#D1C7B7]"}`} />
                    {event.musicUrl ? w("audioConfigured") : w("noAudioConfigured")}
                  </span>
                </div>

                <input
                  value={event.musicUrl}
                  onChange={(e) => onUpdate({ musicUrl: e.target.value })}
                  placeholder="https://.../music.mp3"
                  dir="ltr"
                  className="qr-field-inline min-h-11 w-full rounded-xl px-3 text-xs"
                />

                {isStreamingMusicLink(event.musicUrl) && (
                  <div className="flex items-start gap-2 rounded-xl bg-[#b4534b]/10 p-2.5 text-xs text-[#8c302b]" role="alert">
                    <AlertCircle size={15} className="shrink-0 mt-0.5 text-[#8c302b]" />
                    <span>{w("streamingWarning")}</span>
                  </div>
                )}

                {event.musicUrl && (
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={toggleAudioPreview}
                      className="qr-button qr-button--secondary text-xs inline-flex items-center gap-1.5"
                    >
                      {audioTesting ? <Pause size={13} /> : <Play size={13} />}
                      <span>{audioTesting ? w("pauseAudio") : w("previewAudio")}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (audioPreviewRef.current) audioPreviewRef.current.pause();
                        setAudioTesting(false);
                        onUpdate({ musicUrl: "" });
                      }}
                      className="qr-button qr-button--danger text-xs inline-flex items-center gap-1.5"
                    >
                      <Trash2 size={13} />
                      <span>{w("removeAudio")}</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Background Video */}
              <div className="space-y-2 pt-2 border-t border-[#F0EBE1]">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#68615a]">{w("videoUrlLabel")}</span>
                  <span className={`inline-flex items-center gap-1.5 text-[11px] font-medium ${event.backgroundMediaUrl ? "text-[#0C2D24]" : "text-[#756F66]"}`}>
                    <span className={`h-2 w-2 rounded-full ${event.backgroundMediaUrl ? "bg-[#0C2D24]" : "bg-[#D1C7B7]"}`} />
                    {event.backgroundMediaUrl ? w("videoConfigured") : w("noVideoConfigured")}
                  </span>
                </div>

                <input
                  value={event.backgroundMediaUrl || event.videoUrl || ""}
                  onChange={(e) => onUpdate({ backgroundMediaUrl: e.target.value, videoUrl: e.target.value })}
                  placeholder="https://.../video.mp4"
                  dir="ltr"
                  className="qr-field-inline min-h-11 w-full rounded-xl px-3 text-xs"
                />

                {isStreamingVideoLink(event.backgroundMediaUrl || event.videoUrl || "") && (
                  <div className="flex items-start gap-2 rounded-xl bg-[#b4534b]/10 p-2.5 text-xs text-[#8c302b]" role="alert">
                    <AlertCircle size={15} className="shrink-0 mt-0.5 text-[#8c302b]" />
                    <span>{w("streamingWarning")}</span>
                  </div>
                )}

                {(event.backgroundMediaUrl || event.videoUrl) && (
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => onUpdate({ backgroundMediaUrl: "", videoUrl: "" })}
                      className="qr-button qr-button--danger text-xs inline-flex items-center gap-1.5"
                    >
                      <Trash2 size={13} />
                      <span>{w("removeVideo")}</span>
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Overall Content Scale & Position - Move all content */}
            <div className="rounded-2xl border border-[#D4AF37]/30 bg-white/70 p-4 shadow-2xs space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#8B7040]">
                {w("moveAllContent")}
              </h4>
              <p className="text-xs text-[#756F66]">{w("overallContentHelp")}</p>

              <label className="wedding-transform-slider text-xs">
                <span>{w("contentSize")}</span>
                <input
                  type="range"
                  min={0.8}
                  max={1.25}
                  step={0.01}
                  value={event.presentation.transforms.global.scale}
                  onChange={(e) =>
                    updatePresentation({
                      transforms: {
                        ...event.presentation.transforms,
                        global: {
                          ...event.presentation.transforms.global,
                          scale: Number(e.target.value),
                        },
                      },
                    })
                  }
                />
                <output>{Math.round(event.presentation.transforms.global.scale * 100)}%</output>
              </label>

              <div className="pt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() =>
                    updatePresentation({
                      transforms: {
                        ...event.presentation.transforms,
                        global: { ...defaultWeddingTransform },
                      },
                    })
                  }
                  className="qr-button qr-button--secondary text-xs"
                >
                  {w("resetContent")}
                </button>
                <button
                  type="button"
                  onClick={() => updatePresentation({ transforms: resetWeddingLayoutTransforms() })}
                  className="qr-button qr-button--secondary text-xs"
                >
                  {w("resetEntireLayout")}
                </button>
              </div>
            </div>

            {/* Move elements separately */}
            <div className="rounded-2xl border border-[#D4AF37]/30 bg-white/70 p-4 shadow-2xs space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#8B7040]">
                {w("moveElementsSeparately")}
              </h4>
              <p className="text-xs text-[#756F66]">{w("selectBlockHelp")}</p>

              <div className="flex flex-wrap gap-1.5" role="group" aria-label={w("moveElementsSeparately")}>
                {(["opening", "hosts", "principals", "date-time", "venue", "rsvp"] as WeddingTransformBlockId[]).map((id) => (
                  <button
                    key={id}
                    type="button"
                    className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                      selectedBlock === id
                        ? "bg-[#0C2D24] text-white border-[#0C2D24]"
                        : "bg-white text-[#0C2D24] border-[#D4AF37]/40 hover:bg-[#FAF8F5]"
                    }`}
                    onClick={() => onSelectBlock?.(id)}
                    aria-pressed={selectedBlock === id}
                  >
                    {w(id === "principals" ? "namesBlock" : id === "date-time" ? "detailsBlock" : id === "rsvp" ? "rsvpBlock" : id)}
                  </button>
                ))}
              </div>

              <div className="text-xs font-semibold text-[#8B7040] pt-1">
                {w("selectedElement")}:{" "}
                <span className="text-[#0C2D24]">
                  {w(selectedBlock === "principals" ? "namesBlock" : selectedBlock === "date-time" ? "detailsBlock" : selectedBlock === "rsvp" ? "rsvpBlock" : selectedBlock)}
                </span>
              </div>

              <label className="wedding-transform-slider text-xs">
                <span>{w("blockSize")}</span>
                <input
                  type="range"
                  min={0.75}
                  max={1.35}
                  step={0.01}
                  value={(event.presentation.transforms.blocks[selectedBlock] ?? defaultWeddingTransform).scale}
                  onChange={(e) => {
                    const current = event.presentation.transforms.blocks[selectedBlock] ?? defaultWeddingTransform;
                    updatePresentation({
                      transforms: {
                        ...event.presentation.transforms,
                        blocks: {
                          ...event.presentation.transforms.blocks,
                          [selectedBlock]: { ...current, scale: Number(e.target.value) },
                        },
                      },
                    });
                  }}
                />
                <output>{Math.round((event.presentation.transforms.blocks[selectedBlock] ?? defaultWeddingTransform).scale * 100)}%</output>
              </label>

              <label className="wedding-transform-slider text-xs">
                <span>{w("horizontalPosition")}</span>
                <input
                  type="range"
                  min={-0.25}
                  max={0.25}
                  step={0.01}
                  value={(event.presentation.transforms.blocks[selectedBlock] ?? defaultWeddingTransform).x}
                  onChange={(e) => {
                    const current = event.presentation.transforms.blocks[selectedBlock] ?? defaultWeddingTransform;
                    updatePresentation({
                      transforms: {
                        ...event.presentation.transforms,
                        blocks: {
                          ...event.presentation.transforms.blocks,
                          [selectedBlock]: { ...current, x: Number(e.target.value) },
                        },
                      },
                    });
                  }}
                />
                <output>{Math.round((event.presentation.transforms.blocks[selectedBlock] ?? defaultWeddingTransform).x * 100)}</output>
              </label>

              <label className="wedding-transform-slider text-xs">
                <span>{w("verticalPosition")}</span>
                <input
                  type="range"
                  min={-0.25}
                  max={0.25}
                  step={0.01}
                  value={(event.presentation.transforms.blocks[selectedBlock] ?? defaultWeddingTransform).y}
                  onChange={(e) => {
                    const current = event.presentation.transforms.blocks[selectedBlock] ?? defaultWeddingTransform;
                    updatePresentation({
                      transforms: {
                        ...event.presentation.transforms,
                        blocks: {
                          ...event.presentation.transforms.blocks,
                          [selectedBlock]: { ...current, y: Number(e.target.value) },
                        },
                      },
                    });
                  }}
                />
                <output>{Math.round((event.presentation.transforms.blocks[selectedBlock] ?? defaultWeddingTransform).y * 100)}</output>
              </label>

              <div className="wedding-nudge-controls pt-2" aria-label={w("nudgeBlock")}>
                <button
                  type="button"
                  aria-label={w("moveUp")}
                  onClick={() => {
                    const current = event.presentation.transforms.blocks[selectedBlock] ?? defaultWeddingTransform;
                    updatePresentation({
                      transforms: {
                        ...event.presentation.transforms,
                        blocks: {
                          ...event.presentation.transforms.blocks,
                          [selectedBlock]: { ...current, y: Math.max(-0.25, current.y - 0.02) },
                        },
                      },
                    });
                  }}
                >
                  <ArrowUp aria-hidden="true" size={14} />
                </button>
                <button
                  type="button"
                  aria-label={w("moveLeft")}
                  onClick={() => {
                    const current = event.presentation.transforms.blocks[selectedBlock] ?? defaultWeddingTransform;
                    updatePresentation({
                      transforms: {
                        ...event.presentation.transforms,
                        blocks: {
                          ...event.presentation.transforms.blocks,
                          [selectedBlock]: { ...current, x: Math.max(-0.25, current.x - 0.02) },
                        },
                      },
                    });
                  }}
                >
                  <ArrowLeft aria-hidden="true" size={14} />
                </button>
                <button
                  type="button"
                  className="is-center"
                  onClick={() => {
                    const blocks = { ...event.presentation.transforms.blocks };
                    delete blocks[selectedBlock];
                    updatePresentation({
                      transforms: {
                        ...event.presentation.transforms,
                        blocks,
                      },
                    });
                  }}
                >
                  {w("resetBlock")}
                </button>
                <button
                  type="button"
                  aria-label={w("moveRight")}
                  onClick={() => {
                    const current = event.presentation.transforms.blocks[selectedBlock] ?? defaultWeddingTransform;
                    updatePresentation({
                      transforms: {
                        ...event.presentation.transforms,
                        blocks: {
                          ...event.presentation.transforms.blocks,
                          [selectedBlock]: { ...current, x: Math.min(0.25, current.x + 0.02) },
                        },
                      },
                    });
                  }}
                >
                  <ArrowRight aria-hidden="true" size={14} />
                </button>
                <button
                  type="button"
                  aria-label={w("moveDown")}
                  onClick={() => {
                    const current = event.presentation.transforms.blocks[selectedBlock] ?? defaultWeddingTransform;
                    updatePresentation({
                      transforms: {
                        ...event.presentation.transforms,
                        blocks: {
                          ...event.presentation.transforms.blocks,
                          [selectedBlock]: { ...current, y: Math.min(0.25, current.y + 0.02) },
                        },
                      },
                    });
                  }}
                >
                  <ArrowDown aria-hidden="true" size={14} />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
