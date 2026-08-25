import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ImagePlus,
  MapPin,
  Minus,
  Music2,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import {
  WeddingTemplateRegistry,
  clampGuestCount,
  normalizeWeddingRsvpDraft,
  floralThemes,
  weddingFonts,
  type ArabicFont,
  type FloralTheme,
  type WeddingEventData,
  type WeddingGuestData,
  type WeddingRsvp,
  type WeddingVariant,
  type WeddingVisualTemplateId,
} from "./model";
import {
  WeddingLayoutPresets,
  WeddingMotionPresets,
  canonicalWeddingSceneTimings,
  resolveWeddingPresentation,
  type WeddingLayoutPreset,
  type WeddingMotionPreset,
} from "./presentation";
import { WeddingMotionLayer } from "./WeddingMotionLayer";
import { WeddingSceneEngine } from "./WeddingSceneEngine";
import { WeddingVisualLayer } from "./WeddingVisualLayer";
import {
  resolveWeddingChoreography,
  resolveWeddingChoreographyBoundaries,
  resolveWeddingScenes,
  resolveWeddingSemanticBlocks,
  weddingTimelineEnd,
  type WeddingChoreographyFrame,
  type WeddingSemanticBlock,
} from "./scene-engine";
import {
  defaultWeddingArtworkSettings,
  moveWeddingArtwork,
  normalizeWeddingBackground,
  normalizeWeddingPoint,
} from "./upload";
import { invitationT } from "../i18n/invitation";
import { localeDirection, type InvitationLocale } from "../i18n/locale";
import { useAppLocale } from "../i18n/app-locale";
import { weddingBuilderT } from "../i18n/wedding-builder";
import "./wedding.css";

type WeddingRendererProps = {
  event: WeddingEventData;
  guest: WeddingGuestData;
  rsvpStatus?: "pending" | "accepted" | "declined";
  rsvpResponse?: Pick<WeddingRsvp, "guestCount" | "message">;
  preview?: boolean;
  onSubmit: (response: WeddingRsvp) => void | Promise<void>;
};

type WeddingStyleProperties = CSSProperties & {
  "--wedding-bg": string;
  "--wedding-accent": string;
  "--wedding-petal": string;
  "--wedding-petal-soft": string;
  "--wedding-leaf": string;
  "--wedding-display": string;
  "--wedding-body": string;
  "--wedding-control-bg": string;
  "--wedding-control-border": string;
  "--wedding-progress-muted": string;
};

export function WeddingInvitationRenderer({
  event,
  guest,
  rsvpStatus = "pending",
  rsvpResponse = { guestCount: 1, message: "" },
  preview = false,
  onSubmit,
}: WeddingRendererProps) {
  const template =
    WeddingTemplateRegistry[event.templateId as WeddingVisualTemplateId] ??
    WeddingTemplateRegistry["soft-floral-garden"];
  const presentation = resolveWeddingPresentation(
    event.presentation,
    template.presentation,
  );
  const layoutPreset = WeddingLayoutPresets[presentation.layoutPresetId];
  const motionPreset = WeddingMotionPresets[presentation.motionPresetId];
  const [drawerOpen, setDrawerOpen] = useState(false);
  const theme = floralThemes[event.style.floralTheme] ?? floralThemes["neutral-ivory"];
  const scenes = resolveWeddingScenes(event, guest, rsvpStatus);
  const semanticBlocks = resolveWeddingSemanticBlocks(event, guest, rsvpStatus);
  const cueTimes = resolveWeddingChoreographyBoundaries(semanticBlocks);
  const uploaded = event.visual.source === "uploaded-background";
  const darkControls = template.id === "midnight-gold";

  const style: WeddingStyleProperties = {
    "--wedding-bg": event.style.backgroundColor,
    "--wedding-accent": uploaded ? "#263A31" : event.style.accentColor,
    "--wedding-petal": theme.petal,
    "--wedding-petal-soft": theme.petalSoft,
    "--wedding-leaf": theme.leaf,
    "--wedding-display": weddingFonts[event.style.displayFont].css,
    "--wedding-body": weddingFonts[event.style.bodyFont].css,
    "--wedding-control-bg": darkControls
      ? "rgb(10 12 16 / 0.68)"
      : "rgb(255 253 248 / 0.72)",
    "--wedding-control-border": darkControls
      ? "rgb(255 243 213 / 0.42)"
      : "rgb(113 128 141 / 0.25)",
    "--wedding-progress-muted": darkControls
      ? "rgb(255 255 255 / 0.34)"
      : "rgb(113 128 141 / 0.24)",
  };

  return (
    <WeddingSceneEngine
      locale={event.invitationLocale}
      scenes={scenes}
      timings={canonicalWeddingSceneTimings}
      cueTimes={cueTimes}
      timelineEnd={weddingTimelineEnd}
      musicUrl={event.musicUrl}
      backgroundMediaUrl={event.backgroundMediaUrl}
      preview={preview}
      style={style}
      renderScene={(_scene, playback) => (
        <WeddingInvitationSceneRenderer
          blocks={semanticBlocks}
          playback={playback}
          layoutPreset={layoutPreset}
          motionPreset={motionPreset}
          templateId={template.id as WeddingVisualTemplateId}
          visual={event.visual}
          safeZone={presentation.safeZone}
          onOpenRsvp={() => setDrawerOpen(true)}
          locale={event.invitationLocale}
        />
      )}
      overlay={
        <AnimatePresence>
          {drawerOpen && (
            <WeddingRSVPDrawer
              guest={guest}
              locale={event.invitationLocale}
              status={rsvpStatus}
              response={rsvpResponse}
              onClose={() => setDrawerOpen(false)}
              onSubmit={async (response) => {
                await onSubmit(response);
                setDrawerOpen(false);
              }}
            />
          )}
        </AnimatePresence>
      }
    />
  );
}

function WeddingInvitationSceneRenderer({
  blocks,
  playback,
  layoutPreset,
  motionPreset,
  templateId,
  visual,
  safeZone,
  onOpenRsvp,
  locale,
}: {
  blocks: ReadonlyArray<WeddingSemanticBlock>;
  playback: {
    elapsed: number;
    isPlaying: boolean;
    reduceMotion: boolean;
    settleScene: boolean;
    replayKey: number;
  };
  layoutPreset: WeddingLayoutPreset;
  motionPreset: WeddingMotionPreset;
  templateId: WeddingVisualTemplateId;
  visual: WeddingEventData["visual"];
  safeZone: WeddingEventData["presentation"]["safeZone"];
  onOpenRsvp: () => void;
  locale: InvitationLocale;
}) {
  const direction = localeDirection(locale);
  const artworkMode = visual.source === "uploaded-background" ? visual.fitMode : "template";
  const frame: WeddingChoreographyFrame = resolveWeddingChoreography(
    blocks,
    motionPreset,
    playback.elapsed,
    { direction, reduceMotion: playback.reduceMotion, settleScene: playback.settleScene, artworkMode },
  );
  return (
    <div
      className={`wedding-paper wedding-paper--${visual.source === "uploaded-background" ? "uploaded-background" : templateId} wedding-layout--${layoutPreset.id}`}
      key={playback.replayKey}
      data-layout-preset={layoutPreset.id}
    >
      <WeddingVisualLayer
        templateId={templateId}
        visual={visual}
        backgroundMotion={frame.backgroundMotion}
        elapsed={playback.elapsed}
        isPlaying={playback.isPlaying}
        resolved={playback.reduceMotion || playback.settleScene || frame.final}
      />
      <div className="wedding-content wedding-content--complete">
        <WeddingMotionLayer
          frame={frame}
          replayKey={playback.replayKey}
          isPlaying={playback.isPlaying}
          reduceMotion={playback.reduceMotion}
          settleScene={playback.settleScene}
          layout={layoutPreset}
          motionPreset={motionPreset}
          safeZone={safeZone}
          focalY={visual.source === "uploaded-background" ? visual.focalPoint.y : undefined}
          renderBlock={(block) => (
            <WeddingSemanticBlockContent
              block={block}
              onOpenRsvp={onOpenRsvp}
              locale={locale}
            />
          )}
        />
      </div>
    </div>
  );
}

function WeddingSemanticBlockContent({
  block,
  onOpenRsvp,
  locale,
}: {
  block: WeddingSemanticBlock;
  onOpenRsvp: () => void;
  locale: InvitationLocale;
}) {
  if (block.id === "opening")
    return (
      <div className="wedding-scene wedding-opening">
        <span className="wedding-ornament">۞</span>
        <p>{block.text}</p>
      </div>
    );
  if (block.id === "occasion")
    return <div className="wedding-scene wedding-hosts"><p>{block.text}</p></div>;
  if (block.id === "hosts")
    return (
      <div className="wedding-scene wedding-hosts">
        <p className="wedding-host-name">{block.text}</p>
      </div>
    );
  if (block.id === "principals")
    return <div className="wedding-scene wedding-principals"><PrincipalNames lines={block.lines} locale={locale} /></div>;
  if (block.id === "date-time") {
    const hasDate =
      block.startTime ||
      block.eventDay ||
      block.gregorianDate ||
      block.hijriDate;
    return (
      <div className="wedding-scene wedding-details">
        {hasDate && <div className="wedding-date-rule" />}
        {hasDate && (
          <div className="wedding-date-grid">
            {block.startTime && <span>{block.startTime}</span>}
            {(block.eventDay || block.gregorianDate) && (
              <strong>
                {block.eventDay && <small>{block.eventDay}</small>}
                {block.gregorianDate}
              </strong>
            )}
            {block.hijriDate && <span dir="rtl">{block.hijriDate}</span>}
          </div>
        )}
        {(block.receptionTime || block.dinnerTime) && (
          <div className="wedding-schedule">
            {block.receptionTime && (
              <span>
                {invitationT(locale, "reception")} <b>{block.receptionTime}</b>
              </span>
            )}
            {block.dinnerTime && (
              <span>
                {invitationT(locale, "dinner")} <b>{block.dinnerTime}</b>
              </span>
            )}
          </div>
        )}
      </div>
    );
  }
  if (block.id === "venue")
    return (
      <div className="wedding-scene wedding-details">
        {block.venue && <p className="wedding-venue">{block.venue}</p>}
        {block.city && <p className="wedding-city">{block.city}</p>}
        {block.mapUrl && <a className="wedding-map" href={block.mapUrl} target="_blank" rel="noreferrer"><MapPin size={13} /> {invitationT(locale, "viewLocation")}</a>}
      </div>
    );
  return (
    <div className="wedding-scene wedding-rsvp-reveal">
      <p className="wedding-rsvp-guest">{invitationT(locale, "privateInvitation")} {block.guestName}</p>
      <button
        className="wedding-rsvp-button"
        onClick={onOpenRsvp}
        data-testid="button-wedding-rsvp"
      >
        <span>{invitationT(locale, block.status === "pending" ? "confirmAttendance" : "editResponse")}</span>
        {block.deadline && <small>{block.deadline}</small>}
      </button>
    </div>
  );
}

function PrincipalNames({
  lines,
  fallback,
  locale,
}: {
  lines: string[];
  fallback?: string;
  locale: InvitationLocale;
}) {
  if (!lines.length)
    return fallback ? <p className="wedding-custom-copy">{fallback}</p> : null;
  const longest = Math.max(...lines.map((line) => line.length));
  const lengthClass =
    longest > 24 ? "is-very-long" : longest > 14 ? "is-long" : "";
  return (
    <div
      className={`wedding-name-stack wedding-name-stack--${lines.length} ${lengthClass}`}
    >
      {lines.map((line, index) => (
        <span key={`${line}-${index}`}>{line}</span>
      ))}
      {lines.length === 2 && <i>{invitationT(locale, "and")}</i>}
    </div>
  );
}

function WeddingRSVPDrawer({
  guest,
  locale,
  status,
  response,
  onClose,
  onSubmit,
}: {
  guest: WeddingGuestData;
  locale: InvitationLocale;
  status: "pending" | "accepted" | "declined";
  response: Pick<WeddingRsvp, "guestCount" | "message">;
  onClose: () => void;
  onSubmit: (response: WeddingRsvp) => void | Promise<void>;
}) {
  const draft = normalizeWeddingRsvpDraft(status, response, guest.allowedCompanions);
  const [attendance, setAttendance] = useState<"accepted" | "declined">(draft.status);
  const [guestCount, setGuestCount] = useState(draft.guestCount || 1);
  const [message, setMessage] = useState(draft.message);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const drawerRef = useRef<HTMLDivElement>(null);
  const reduceMotion = Boolean(useReducedMotion());
  const maxGuests = 1 + Math.max(0, guest.allowedCompanions);

  useEffect(() => {
    const drawer = drawerRef.current;
    const returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (!drawer) return;
    const focusable = () => Array.from(drawer.querySelectorAll<HTMLElement>(
      'button:not([disabled]), textarea:not([disabled]), [href], input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
    )).filter((element) => element.getClientRects().length);
    focusable()[0]?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;
      const controls = focusable();
      if (!controls.length) return;
      const first = controls[0];
      const last = controls.at(-1)!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      returnFocus?.focus();
    };
  }, [onClose]);

  const submit = async () => {
    setSubmitting(true);
    setSubmitError("");
    try {
      await onSubmit({
        status: attendance,
        guestCount: attendance === "accepted" ? guestCount : 0,
        message,
      });
    } catch {
      setSubmitError(invitationT(locale, "saveError"));
    } finally {
      setSubmitting(false);
    }
  };
  return (
    <motion.div
      className="wedding-drawer-backdrop"
      initial={reduceMotion ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={reduceMotion ? { opacity: 1 } : { opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="wedding-drawer"
        dir={localeDirection(locale)}
        lang={locale}
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="wedding-rsvp-title"
        initial={reduceMotion ? false : { y: "100%" }}
        animate={{ y: 0 }}
        exit={reduceMotion ? { y: 0 } : { y: "100%" }}
        transition={reduceMotion ? { duration: 0 } : { type: "spring", damping: 28, stiffness: 260 }}
        onClick={(event) => event.stopPropagation()}
      >
        <button
          className="wedding-drawer-close"
          onClick={onClose}
          aria-label={invitationT(locale, "close")}
        >
          <X />
        </button>
        <span className="wedding-drawer-handle" />
        <p className="wedding-drawer-eyebrow">{invitationT(locale, "privateInvitation")} {guest.name}</p>
        <h2 id="wedding-rsvp-title">{invitationT(locale, "rsvpTitle")}</h2>
        <div className="wedding-attendance-options">
          <button
            className={attendance === "accepted" ? "is-selected" : ""}
            onClick={() => setAttendance("accepted")}
            aria-pressed={attendance === "accepted"}
          >
            <Check /> {invitationT(locale, "attending")}
          </button>
          <button
            className={attendance === "declined" ? "is-selected" : ""}
            onClick={() => setAttendance("declined")}
            aria-pressed={attendance === "declined"}
          >
            <X /> {invitationT(locale, "declining")}
          </button>
        </div>
        {attendance === "accepted" && (
          <div className="wedding-companions">
            <div>
              <strong>{invitationT(locale, "guestCount")}</strong>
              <small>{invitationT(locale, "allowed")}: {maxGuests}</small>
            </div>
            <div className="wedding-counter">
              <button
                onClick={() =>
                  setGuestCount((value) =>
                    clampGuestCount(value - 1, guest.allowedCompanions),
                  )
                }
                disabled={guestCount <= 1}
                aria-label={invitationT(locale, "decreaseGuests")}
              >
                <Minus />
              </button>
              <b>{guestCount}</b>
              <button
                onClick={() =>
                  setGuestCount((value) =>
                    clampGuestCount(value + 1, guest.allowedCompanions),
                  )
                }
                disabled={guestCount >= maxGuests}
                aria-label={invitationT(locale, "increaseGuests")}
              >
                <Plus />
              </button>
            </div>
          </div>
        )}
        <label className="wedding-message">
          <span>
            {invitationT(locale, "message")} <small>({invitationT(locale, "optional")})</small>
          </span>
          <textarea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            rows={3}
            maxLength={300}
            placeholder={invitationT(locale, "messagePlaceholder")}
          />
        </label>
        <button
          className="wedding-submit"
          onClick={submit}
          disabled={submitting}
        >
          {invitationT(locale, submitting ? "saving" : "save")}
        </button>
        {submitError && <p role="alert">{submitError}</p>}
      </motion.div>
    </motion.div>
  );
}

type WeddingStudioProps = {
  event: WeddingEventData;
  guest: WeddingGuestData;
  rsvpStatus: "pending" | "accepted" | "declined";
  rsvpResponse: Pick<WeddingRsvp, "guestCount" | "message">;
  onChange: (event: WeddingEventData) => void;
};

const builderStepIds = ["information", "artwork", "layout", "motion", "preview"] as const;

export function WeddingStudio({
  event,
  guest,
  rsvpStatus,
  rsvpResponse,
  onChange,
}: WeddingStudioProps) {
  const { t, dir, locale } = useAppLocale();
  const w = (key: Parameters<typeof weddingBuilderT>[1]) => weddingBuilderT(locale, key);
  const builderSteps = builderStepIds.map((id) => ({ id, label: w(id) }));
  const [stepIndex, setStepIndex] = useState(0);
  const [transientVisual, setTransientVisual] = useState<WeddingEventData["visual"] | null>(null);
  const dragRef = useRef<{
    pointerId: number;
    x: number;
    y: number;
    start: { x: number; y: number };
    position: { x: number; y: number };
  } | null>(null);
  const step = builderSteps[stepIndex];
  const update = (patch: Partial<WeddingEventData>) =>
    onChange({ ...event, ...patch });
  const updateStyle = (patch: Partial<WeddingEventData["style"]>) =>
    update({ style: { ...event.style, ...patch } });
  const updatePresentation = (
    patch: Partial<WeddingEventData["presentation"]>,
  ) => update({ presentation: { ...event.presentation, ...patch } });
  const positioning = step.id === "artwork" && event.visual.source === "uploaded-background" && event.visual.fitMode === "fill";
  const previewEvent = transientVisual ? { ...event, visual: transientVisual } : event;
  const startPosition = (pointerEvent: ReactPointerEvent<HTMLDivElement>) => {
    if (!positioning || pointerEvent.button !== 0 || event.visual.source !== "uploaded-background") return;
    pointerEvent.currentTarget.setPointerCapture(pointerEvent.pointerId);
    dragRef.current = {
      pointerId: pointerEvent.pointerId,
      x: pointerEvent.clientX,
      y: pointerEvent.clientY,
      start: event.visual.backgroundPosition,
      position: event.visual.backgroundPosition,
    };
  };
  const movePosition = (pointerEvent: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== pointerEvent.pointerId || event.visual.source !== "uploaded-background") return;
    const bounds = pointerEvent.currentTarget.getBoundingClientRect();
    const position = moveWeddingArtwork(
      drag.start,
      pointerEvent.clientX - drag.x,
      pointerEvent.clientY - drag.y,
      bounds.width,
      bounds.height,
    );
    drag.position = position;
    setTransientVisual({ ...event.visual, backgroundPosition: position, focalPoint: position });
  };
  const finishPosition = (pointerId: number) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== pointerId || event.visual.source !== "uploaded-background") return;
    dragRef.current = null;
    setTransientVisual(null);
    update({ visual: { ...event.visual, backgroundPosition: drag.position, focalPoint: drag.position } });
  };
  return (
    <div className="wedding-studio">
      <nav className="wedding-stepper" aria-label={w("builderSteps")}>
        {builderSteps.map((item, index) => (
          <button
            key={item.id}
            onClick={() => setStepIndex(index)}
            className={index === stepIndex ? "is-active" : ""}
            aria-current={index === stepIndex ? "step" : undefined}
          >
            <span>{index + 1}</span>
            {item.label}
          </button>
        ))}
      </nav>
      <div className="wedding-studio-grid">
        <div className="wedding-editor-panel">
          {step.id === "information" && (
            <>
              <StepHeading kicker={w("informationKicker")} title={w("informationTitle")} description={w("informationHelp")} />
              <label className="wedding-locale-field">
                <span>{t("invitationLanguage")}</span>
                <select data-testid="select-wedding-invitation-locale" value={event.invitationLocale} onChange={(changeEvent) => update({ invitationLocale: changeEvent.target.value as InvitationLocale })}>
                  <option value="ar">{t("arabic")}</option><option value="en">{t("english")}</option>
                </select>
              </label>
              <DetailsStep event={event} update={update} />
            </>
          )}
          {step.id === "artwork" && (
            <>
              <TemplateStep event={event} update={update} />
              <ArtworkControls event={event} update={update} />
              <details className="wedding-fine-tune">
                <summary>{w("fineTune")}</summary>
                <SafeZoneControls event={event} updatePresentation={updatePresentation} />
                <StyleStep event={event} update={update} updateStyle={updateStyle} />
              </details>
            </>
          )}
          {(step.id === "layout" || step.id === "motion") && (
            <PresentationStep
              event={event}
              updatePresentation={updatePresentation}
              kind={step.id}
            />
          )}
          {step.id === "preview" && (
            <div className="wedding-preview-copy">
              <span>{weddingBuilderT(locale, "realPreview")}</span>
              <h2>{weddingBuilderT(locale, "previewTitle")}</h2>
              <p>
                {weddingBuilderT(locale, "previewHelp")}
              </p>
            </div>
          )}
          <div className="wedding-editor-nav">
            <button
              onClick={() => setStepIndex((value) => Math.max(0, value - 1))}
              disabled={stepIndex === 0}
            >
              {dir === "rtl" ? <ChevronRight /> : <ChevronLeft />} {t("previous")}
            </button>
            <button
              className="is-primary"
              onClick={() =>
                setStepIndex((value) =>
                  Math.min(builderSteps.length - 1, value + 1),
                )
              }
              disabled={stepIndex === builderSteps.length - 1}
            >
              {t("next")} {dir === "rtl" ? <ChevronLeft /> : <ChevronRight />}
            </button>
          </div>
        </div>
        <div className="wedding-live-preview">
          <div className="wedding-phone-label">
            <span>9:16</span>
            <b>{t("guestPreview")}</b>
          </div>
          <div className="wedding-preview-canvas">
            <WeddingInvitationRenderer
              key={event.presentation.motionPresetId}
              event={previewEvent}
              guest={guest}
              rsvpStatus={rsvpStatus}
              rsvpResponse={rsvpResponse}
              preview
              onSubmit={() => undefined}
            />
            {positioning && <div
              className="wedding-position-surface"
              onPointerDown={startPosition}
              onPointerMove={movePosition}
              onPointerUp={(pointerEvent) => finishPosition(pointerEvent.pointerId)}
              onPointerCancel={(pointerEvent) => finishPosition(pointerEvent.pointerId)}
              onLostPointerCapture={(pointerEvent) => finishPosition(pointerEvent.pointerId)}
              aria-label={w("dragArtwork")}
            ><span>{w("dragArtwork")}</span></div>}
          </div>
        </div>
      </div>
    </div>
  );
}

function TemplateStep({
  event,
  update,
}: {
  event: WeddingEventData;
  update: (patch: Partial<WeddingEventData>) => void;
}) {
  const { locale } = useAppLocale();
  const w = (key: Parameters<typeof weddingBuilderT>[1]) => weddingBuilderT(locale, key);
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const uploaded = event.visual.source === "uploaded-background";
  const uploadedBackground =
    event.visual.source === "uploaded-background"
      ? event.visual.uploadedBackground
      : undefined;
  const selectTemplate = (templateId: WeddingVisualTemplateId) => {
    const template = WeddingTemplateRegistry[templateId];
    update({
      templateId,
      visual: { source: "template" },
      style: { ...template.defaults },
      presentation: resolveWeddingPresentation(
        event.presentation,
        template.presentation,
      ),
    });
  };
  const uploadBackground = async (file?: File) => {
    if (!file) return;
    setUploading(true);
    setUploadError("");
    try {
      update({
        visual: {
          source: "uploaded-background",
          uploadedBackground: await normalizeWeddingBackground(file),
          ...defaultWeddingArtworkSettings,
        },
      });
    } catch {
      setUploadError(w("uploadError"));
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };
  return (
    <div>
      <StepHeading
        kicker={w("step2")}
        title={w("artwork")}
        description={w("templateHelp")}
      />
      <div className="wedding-template-list">
        {Object.values(WeddingTemplateRegistry).map((template) => (
          <button
            key={template.id}
            className={!uploaded && event.templateId === template.id ? "is-selected" : ""}
            onClick={() => selectTemplate(template.id as WeddingVisualTemplateId)}
            aria-pressed={!uploaded && event.templateId === template.id}
          >
            <span className={`wedding-template-swatch wedding-template-swatch--${template.id}`}>
              <i />
              <i />
              <i />
            </span>
            <span>
              <b>{template.nameAr}</b>
              <small>{locale === "ar" ? template.nameAr : template.name} · {w("readyTemplate")}</small>
            </span>
            {!uploaded && event.templateId === template.id && <Check />}
          </button>
        ))}
        <button
          className={uploaded ? "wedding-upload-card is-selected" : "wedding-upload-card"}
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          aria-pressed={uploaded}
        >
          <span className="wedding-template-swatch wedding-template-swatch--upload">
            <ImagePlus aria-hidden="true" />
          </span>
          <span>
            <b>{w(uploading ? "preparingImage" : uploaded ? "replaceBackground" : "customBackground")}</b>
            <small>
              {uploadedBackground
                ? uploadedBackground.fileName
                : w("imageOnly")}
            </small>
          </span>
          {uploaded && <Check aria-hidden="true" />}
        </button>
        <input
          ref={inputRef}
          className="wedding-file-input"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          aria-label={w("uploadBackground")}
          onChange={(changeEvent) => uploadBackground(changeEvent.target.files?.[0])}
        />
      </div>
      {uploadError && <p className="wedding-upload-error" role="alert">{uploadError}</p>}
      {uploaded && (
        <button
          className="wedding-remove-background"
          onClick={() => update({ visual: { source: "template" } })}
        >
          <Trash2 aria-hidden="true" /> {w("removeBackground")}
        </button>
      )}
      <p className="wedding-registry-note">
        {w("futureTemplates")}
      </p>
    </div>
  );
}

function ArtworkControls({
  event,
  update,
}: {
  event: WeddingEventData;
  update: (patch: Partial<WeddingEventData>) => void;
}) {
  const { locale } = useAppLocale();
  const w = (key: Parameters<typeof weddingBuilderT>[1]) => weddingBuilderT(locale, key);
  if (event.visual.source !== "uploaded-background") return null;
  const visual = event.visual;
  const change = (patch: Partial<typeof visual>) => update({ visual: { ...visual, ...patch } });
  const position = (x: number, y: number) => {
    const next = normalizeWeddingPoint({ x: visual.backgroundPosition.x + x, y: visual.backgroundPosition.y + y });
    change({ backgroundPosition: next, focalPoint: next });
  };
  return (
    <section className="wedding-artwork-controls" aria-labelledby="wedding-artwork-position-title">
      <div className="wedding-control-heading">
        <h3 id="wedding-artwork-position-title">{w("positionArtwork")}</h3>
        <p>{w("positionHelp")}</p>
      </div>
      <div className="wedding-fit-options" role="group" aria-label={w("artworkDisplay")}>
        {(["fit", "fill"] as const).map((fitMode) => <button
          key={fitMode}
          className={visual.fitMode === fitMode ? "is-selected" : ""}
          aria-pressed={visual.fitMode === fitMode}
          onClick={() => change({ fitMode, backgroundZoom: fitMode === "fit" ? 1 : visual.backgroundZoom })}
        >{w(fitMode)}</button>)}
      </div>
      <p className="wedding-fit-help">{w(visual.fitMode === "fit" ? "fitHelp" : "fillHelp")}</p>
      {visual.fitMode === "fill" && <>
        <label className="wedding-zoom-control">
          <span>{w("zoom")}</span>
          <input type="range" min="1" max="2" step="0.05" value={visual.backgroundZoom} onChange={(changeEvent) => change({ backgroundZoom: Number(changeEvent.target.value) })} />
          <output>{Math.round(visual.backgroundZoom * 100)}%</output>
        </label>
        <div className="wedding-nudge-controls" aria-label={w("positionFallback")}>
          <button onClick={() => position(0, -0.05)} aria-label={w("moveUp")}><ArrowUp /></button>
          <button onClick={() => position(-0.05, 0)} aria-label={w("moveLeft")}><ArrowLeft /></button>
          <button className="is-center" onClick={() => change({ backgroundPosition: { x: 0.5, y: 0.5 }, focalPoint: { x: 0.5, y: 0.5 } })}>{w("centerArtwork")}</button>
          <button onClick={() => position(0.05, 0)} aria-label={w("moveRight")}><ArrowRight /></button>
          <button onClick={() => position(0, 0.05)} aria-label={w("moveDown")}><ArrowDown /></button>
        </div>
      </>}
    </section>
  );
}

function SafeZoneControls({
  event,
  updatePresentation,
}: {
  event: WeddingEventData;
  updatePresentation: (patch: Partial<WeddingEventData["presentation"]>) => void;
}) {
  const { locale } = useAppLocale();
  const w = (key: Parameters<typeof weddingBuilderT>[1]) => weddingBuilderT(locale, key);
  return <section className="wedding-safe-zone-controls">
    <div className="wedding-control-heading"><h3>{w("safeZone")}</h3><p>{w("safeZoneHelp")}</p></div>
    <div role="group" aria-label={w("safeZone")}>
      {(["auto", "top", "center", "bottom"] as const).map((safeZone) => <button key={safeZone} className={event.presentation.safeZone === safeZone ? "is-selected" : ""} aria-pressed={event.presentation.safeZone === safeZone} onClick={() => updatePresentation({ safeZone })}>{w(safeZone)}</button>)}
    </div>
  </section>;
}

function DetailsStep({
  event,
  update,
}: {
  event: WeddingEventData;
  update: (patch: Partial<WeddingEventData>) => void;
}) {
  const { locale } = useAppLocale();
  const w = (key: Parameters<typeof weddingBuilderT>[1]) => weddingBuilderT(locale, key);
  const contentDir = localeDirection(event.invitationLocale);
  return (
    <div className="wedding-information-sections">
      <fieldset><legend>{w("namesSection")}</legend><div className="wedding-fields" dir={contentDir}>
        <Field
          label={w("invitationFormat")}
          value={event.invitationVariant}
          onChange={(value) =>
            update({ invitationVariant: value as WeddingVariant })
          }
          options={[
            ["both", w("both")], ["women", w("women")], ["men", w("men")], ["family", w("family")], ["custom", w("custom")],
          ]}
          dir={localeDirection(locale)}
        />
        <Field
          label={w("groom")}
          value={event.groomName}
          onChange={(value) => update({ groomName: value })}
        />
        <Field
          label={w("bride")}
          value={event.brideName}
          onChange={(value) => update({ brideName: value })}
        />
        {event.invitationVariant === "family" && (
          <Field
            label={w("familyNames")}
            value={event.familyNames}
            onChange={(value) => update({ familyNames: value })}
            wide
          />
        )}
      </div></fieldset>
      <fieldset><legend>{w("wordingSection")}</legend><div className="wedding-fields" dir={contentDir}>
        <Field label={w("opening")} value={event.openingWording} onChange={(value) => update({ openingWording: value })} />
        <Field label={w("invitationWording")} value={event.invitationWording} onChange={(value) => update({ invitationWording: value })} />
        {event.invitationVariant === "custom" && (
          <Field
            label={w("customArabic")}
            value={event.customWording}
            onChange={(value) => update({ customWording: value })}
            textarea
            wide
          />
        )}
      </div></fieldset>
      <fieldset><legend>{w("hostsSection")}</legend><div className="wedding-fields" dir={contentDir}>
        <Field label={w("hosts")} value={event.hostNames} onChange={(value) => update({ hostNames: value })} wide />
      </div></fieldset>
      <fieldset><legend>{w("dateTimeSection")}</legend><div className="wedding-fields" dir={contentDir}>
        <Field
          label={w("day")}
          value={event.eventDay}
          onChange={(value) => update({ eventDay: value })}
        />
        <Field
          label={w("gregorian")}
          value={event.gregorianDate}
          onChange={(value) => update({ gregorianDate: value })}
        />
        <Field
          label={w("hijri")}
          value={event.hijriDate}
          onChange={(value) => update({ hijriDate: value })}
        />
        <Field
          label={w("start")}
          value={event.startTime}
          onChange={(value) => update({ startTime: value })}
        />
        <Field
          label={w("reception")}
          value={event.receptionTime}
          onChange={(value) => update({ receptionTime: value })}
        />
        <Field
          label={w("dinner")}
          value={event.dinnerTime}
          onChange={(value) => update({ dinnerTime: value })}
        />
      </div></fieldset>
      <fieldset><legend>{w("venueSection")}</legend><div className="wedding-fields" dir={contentDir}>
        <Field
          label={w("venue")}
          value={event.venue}
          onChange={(value) => update({ venue: value })}
        />
        <Field
          label={w("city")}
          value={event.city}
          onChange={(value) => update({ city: value })}
        />
        <Field
          label={w("map")}
          value={event.mapUrl}
          onChange={(value) => update({ mapUrl: value })}
          wide
          dir="ltr"
        />
      </div></fieldset>
      <fieldset><legend>{w("rsvpSection")}</legend><div className="wedding-fields" dir={contentDir}>
        <Field
          label={w("deadline")}
          value={event.rsvpDeadline}
          onChange={(value) => update({ rsvpDeadline: value })}
          wide
        />
      </div></fieldset>
    </div>
  );
}

function StyleStep({
  event,
  update,
  updateStyle,
}: {
  event: WeddingEventData;
  update: (patch: Partial<WeddingEventData>) => void;
  updateStyle: (patch: Partial<WeddingEventData["style"]>) => void;
}) {
  const { locale } = useAppLocale();
  const w = (key: Parameters<typeof weddingBuilderT>[1]) => weddingBuilderT(locale, key);
  const template =
    WeddingTemplateRegistry[event.templateId as WeddingVisualTemplateId] ??
    WeddingTemplateRegistry["soft-floral-garden"];
  const customization = template.allowedCustomization;
  const uploaded = event.visual.source === "uploaded-background";
  return (
    <div>
      <StepHeading
        kicker={w("fineTune")}
        title={w("moreOptions")}
        description={w("styleHelp")}
      />
      {!uploaded && <div className="wedding-style-section">
        <b>{w("background")}</b>
        <div className="wedding-color-options">
          {customization.backgrounds.map((color) => (
            <button
              key={color}
              style={{ backgroundColor: color }}
              className={
                event.style.backgroundColor === color ? "is-selected" : ""
              }
              onClick={() => updateStyle({ backgroundColor: color })}
              aria-label={`${w("background")} ${color}`}
              aria-pressed={event.style.backgroundColor === color}
            />
          ))}
        </div>
      </div>}
      {!uploaded && <div className="wedding-style-section">
        <b>{w("headingColor")}</b>
        <div className="wedding-color-options">
          {customization.accents.map((color) => (
            <button
              key={color}
              style={{ backgroundColor: color }}
              className={event.style.accentColor === color ? "is-selected" : ""}
              onClick={() => updateStyle({ accentColor: color })}
              aria-label={`${w("headingColor")} ${color}`}
              aria-pressed={event.style.accentColor === color}
            />
          ))}
        </div>
      </div>}
      {uploaded && (
        <p className="wedding-upload-style-note">
          {w("imageOverlay")}
        </p>
      )}
      <div className="wedding-fields">
        {!uploaded && customization.floralThemes.length > 0 && <Field
          label={w("flowers")}
          value={event.style.floralTheme}
          onChange={(value) =>
            updateStyle({ floralTheme: value as FloralTheme })
          }
          options={customization.floralThemes.map((key) => [
            key,
            floralThemes[key].name,
          ])}
        />}
        <Field
          label={w("namesFont")}
          value={event.style.displayFont}
          onChange={(value) =>
            updateStyle({ displayFont: value as ArabicFont })
          }
          options={customization.fonts.map((key) => [
            key,
            weddingFonts[key].name,
          ])}
        />
        <Field
          label={w("infoFont")}
          value={event.style.bodyFont}
          onChange={(value) => updateStyle({ bodyFont: value as ArabicFont })}
          options={customization.fonts.map((key) => [
            key,
            weddingFonts[key].name,
          ])}
        />
        <Field
          label={w("music")}
          value={event.musicUrl}
          onChange={(value) => update({ musicUrl: value })}
          dir="ltr"
        />
        <Field
          label={w("video")}
          value={event.backgroundMediaUrl}
          onChange={(value) => update({ backgroundMediaUrl: value })}
          dir="ltr"
          wide
        />
      </div>
    </div>
  );
}

function PresentationStep({
  event,
  updatePresentation,
  kind,
}: {
  event: WeddingEventData;
  updatePresentation: (
    patch: Partial<WeddingEventData["presentation"]>,
  ) => void;
  kind: "layout" | "motion";
}) {
  const { locale } = useAppLocale();
  const w = (key: Parameters<typeof weddingBuilderT>[1]) => weddingBuilderT(locale, key);
  const template =
    WeddingTemplateRegistry[event.templateId as WeddingVisualTemplateId] ??
    WeddingTemplateRegistry["soft-floral-garden"];
  return (
    <div>
      <StepHeading
        kicker={w(kind === "layout" ? "layoutKicker" : "motionKicker")}
        title={w(kind)}
        description={w(kind === "layout" ? "layoutHelp" : "motionHelp")}
      />
      {kind === "layout" && <div className="wedding-presentation-section">
        <b>{w("layout")}</b>
        <div className="wedding-preset-grid">
          {template.presentation.supportedLayoutPresetIds.map((id) => {
            const preset = WeddingLayoutPresets[id];
            const selected = event.presentation.layoutPresetId === id;
            return (
              <button
                key={id}
                className={selected ? "is-selected" : ""}
                onClick={() => updatePresentation({ layoutPresetId: id })}
                aria-pressed={selected}
              >
                <span className={`wedding-layout-diagram wedding-layout-diagram--${id}`} aria-hidden="true">
                  <i />
                  <i />
                  <i />
                </span>
                <span>
                  <strong>{locale === "ar" ? preset.nameAr : preset.name}</strong>
                  {locale === "ar" && <small>{preset.name}</small>}
                  {locale === "ar" && <em>{preset.descriptionAr}</em>}
                </span>
                {selected && <Check aria-hidden="true" />}
              </button>
            );
          })}
        </div>
      </div>}
      {kind === "motion" && <div className="wedding-presentation-section">
        <b>{w("motion")}</b>
        <div className="wedding-motion-options">
          {template.presentation.supportedMotionPresetIds.map((id) => {
            const preset = WeddingMotionPresets[id];
            const selected = event.presentation.motionPresetId === id;
            return (
              <button
                key={id}
                className={selected ? "is-selected" : ""}
                onClick={() => updatePresentation({ motionPresetId: id })}
                aria-pressed={selected}
              >
                <span className={`wedding-motion-mark wedding-motion-mark--${id}`} aria-hidden="true"><i /></span>
                <span>
                  <strong>{locale === "ar" ? preset.nameAr : preset.name}</strong>
                  {locale === "ar" && <small>{preset.name}</small>}
                  {locale === "ar" && <em>{preset.descriptionAr}</em>}
                </span>
                {selected && <Check aria-hidden="true" />}
              </button>
            );
          })}
        </div>
      </div>}
    </div>
  );
}

function StepHeading({
  kicker,
  title,
  description,
}: {
  kicker: string;
  title: string;
  description: string;
}) {
  return (
    <header className="wedding-step-heading">
      <span>{kicker}</span>
      <h2>{title}</h2>
      <p>{description}</p>
    </header>
  );
}

function Field({
  label,
  value,
  onChange,
  options,
  textarea = false,
  wide = false,
  dir,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options?: ReadonlyArray<ReadonlyArray<string>>;
  textarea?: boolean;
  wide?: boolean;
  dir?: "rtl" | "ltr";
}) {
  const { dir: appDir } = useAppLocale();
  return (
    <label className={wide ? "is-wide" : ""}>
      <span dir={appDir}>{label}</span>
      {options ? (
        <select
          value={value}
          onChange={(event) => onChange(event.target.value)}
        >
          {options.map(([key, name]) => (
            <option key={key} value={key}>
              {name}
            </option>
          ))}
        </select>
      ) : textarea ? (
        <textarea
          value={value}
          onChange={(event) => onChange(event.target.value)}
          rows={4}
          dir={dir}
        />
      ) : (
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          dir={dir}
        />
      )}
    </label>
  );
}
