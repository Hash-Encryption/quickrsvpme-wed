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

            {/* Date & Time */}
            {(!directTarget || directTarget === "date-time") && (
              <fieldset className="rounded-2xl border border-[#D4AF37]/30 bg-white/70 p-4 shadow-2xs">
                <legend className="px-2 text-xs font-bold text-[#0C2D24]">{w("dateTimeSection")}</legend>
                <div className="wedding-fields mt-2" dir={contentDir}>
                  <label>
                    <span>{w("gregorian")}</span>
                    <input
                      data-testid="input-edit-gregorian-date"
                      value={event.gregorianDate}
                      onChange={(e) => onUpdate({ gregorianDate: e.target.value })}
                    />
                  </label>
                  <label>
                    <span>{w("day")}</span>
                    <input
                      value={event.eventDay}
                      onChange={(e) => onUpdate({ eventDay: e.target.value })}
                      placeholder={locale === "ar" ? "الجمعة" : "Friday"}
                    />
                  </label>
                  <label className={showOptionalTiming ? "" : "is-wide"}>
                    <span>{w("start")}</span>
                    <input
                      value={event.startTime}
                      onChange={(e) => onUpdate({ startTime: e.target.value })}
                      placeholder="8:00 PM"
                    />
                  </label>

                  {/* Progressive disclosure for secondary timing */}
                  {showOptionalTiming ? (
                    <>
                      <label>
                        <span>{w("hijri")}</span>
                        <input
                          value={event.hijriDate}
                          onChange={(e) => onUpdate({ hijriDate: e.target.value })}
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
                    </>
                  ) : (
                    <div className="is-wide pt-1">
                      <button
                        type="button"
                        onClick={() => setShowOptionalTiming(true)}
                        className="text-xs font-semibold text-[#8B7040] hover:underline flex items-center gap-1"
                      >
                        <ChevronDown size={14} /> {w("optionalTiming")}
                      </button>
                    </div>
                  )}
                </div>
              </fieldset>
            )}

            {/* Venue & Location */}
            {(!directTarget || directTarget === "venue") && (
              <fieldset className="rounded-2xl border border-[#D4AF37]/30 bg-white/70 p-4 shadow-2xs">
                <legend className="px-2 text-xs font-bold text-[#0C2D24]">{w("venueSection")}</legend>
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
                <legend className="px-2 text-xs font-bold text-[#0C2D24]">{w("wordingSection")}</legend>
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
                <button
                  type="button"
                  className={uploaded ? "wedding-upload-card is-selected" : "wedding-upload-card"}
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  aria-pressed={uploaded}
                >
                  <span className="wedding-template-swatch wedding-template-swatch--upload">
                    <ImagePlus aria-hidden="true" size={20} />
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
                </button>
                <input
                  ref={fileInputRef}
                  className="wedding-file-input"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  aria-label={w("uploadBackground")}
                  onChange={(e) => void uploadBackground(e.target.files?.[0])}
                />
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
                  value={event.backgroundMediaUrl}
                  onChange={(e) => onUpdate({ backgroundMediaUrl: e.target.value })}
                  placeholder="https://.../video.mp4"
                  dir="ltr"
                  className="qr-field-inline min-h-11 w-full rounded-xl px-3 text-xs"
                />

                {isStreamingVideoLink(event.backgroundMediaUrl) && (
                  <div className="flex items-start gap-2 rounded-xl bg-[#b4534b]/10 p-2.5 text-xs text-[#8c302b]" role="alert">
                    <AlertCircle size={15} className="shrink-0 mt-0.5 text-[#8c302b]" />
                    <span>{w("streamingWarning")}</span>
                  </div>
                )}

                {event.backgroundMediaUrl && (
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => onUpdate({ backgroundMediaUrl: "" })}
                      className="qr-button qr-button--danger text-xs inline-flex items-center gap-1.5"
                    >
                      <Trash2 size={13} />
                      <span>{w("removeVideo")}</span>
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Overall Content Scale & Position */}
            <div className="rounded-2xl border border-[#D4AF37]/30 bg-white/70 p-4 shadow-2xs space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#8B7040]">
                {w("overallContent")}
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
          </div>
        )}
      </div>
    </div>
  );
}
