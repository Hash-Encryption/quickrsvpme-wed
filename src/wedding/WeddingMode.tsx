import { useEffect, useRef, useState, type CSSProperties } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  Check,
  ChevronLeft,
  ChevronRight,
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
import { resolveWeddingScenes, type WeddingScene } from "./scene-engine";
import { normalizeWeddingBackground } from "./upload";
import "./wedding.css";

type WeddingRendererProps = {
  event: WeddingEventData;
  guest: WeddingGuestData;
  rsvpStatus?: "pending" | "accepted" | "declined";
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
  const uploaded = event.visual.source === "uploaded-background";
  const darkControls = uploaded || template.id === "midnight-gold";

  const style: WeddingStyleProperties = {
    "--wedding-bg": event.style.backgroundColor,
    "--wedding-accent": uploaded ? "#FFF3D5" : event.style.accentColor,
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
      scenes={scenes}
      timings={canonicalWeddingSceneTimings}
      musicUrl={event.musicUrl}
      backgroundMediaUrl={event.backgroundMediaUrl}
      preview={preview}
      style={style}
      renderScene={(scene, replayKey) => (
        <WeddingInvitationSceneRenderer
          scene={scene}
          replayKey={replayKey}
          layoutPreset={layoutPreset}
          motionPreset={motionPreset}
          templateId={template.id as WeddingVisualTemplateId}
          visual={event.visual}
          onOpenRsvp={() => setDrawerOpen(true)}
        />
      )}
      overlay={
        <AnimatePresence>
          {drawerOpen && (
            <WeddingRSVPDrawer
              guest={guest}
              status={rsvpStatus}
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
  scene,
  replayKey,
  layoutPreset,
  motionPreset,
  templateId,
  visual,
  onOpenRsvp,
}: {
  scene: WeddingScene;
  replayKey: number;
  layoutPreset: WeddingLayoutPreset;
  motionPreset: WeddingMotionPreset;
  templateId: WeddingVisualTemplateId;
  visual: WeddingEventData["visual"];
  onOpenRsvp: () => void;
}) {
  const className =
    scene.id === "names"
      ? "wedding-principals"
      : scene.id === "rsvp"
        ? "wedding-rsvp-reveal"
        : `wedding-${scene.id}`;
  return (
    <div
      className={`wedding-paper wedding-paper--${visual.source === "uploaded-background" ? "uploaded-background" : templateId} wedding-layout--${layoutPreset.id}`}
      key={replayKey}
      data-layout-preset={layoutPreset.id}
    >
      <WeddingVisualLayer templateId={templateId} visual={visual} />
      <div className="wedding-content">
        <WeddingMotionLayer
          sceneId={scene.id}
          replayKey={replayKey}
          layout={layoutPreset}
          motionPreset={motionPreset}
        >
          <div className={`wedding-scene ${className}`}>
            <WeddingSceneContent scene={scene} onOpenRsvp={onOpenRsvp} />
          </div>
        </WeddingMotionLayer>
      </div>
    </div>
  );
}

function WeddingSceneContent({
  scene,
  onOpenRsvp,
}: {
  scene: WeddingScene;
  onOpenRsvp: () => void;
}) {
  if (scene.id === "opening")
    return (
      <>
        <span className="wedding-ornament">۞</span>
        {scene.wording && <p>{scene.wording}</p>}
      </>
    );
  if (scene.id === "hosts")
    return (
      <>
        {scene.hostNames && (
          <p className="wedding-host-name">{scene.hostNames}</p>
        )}
        {scene.invitationWording && <p>{scene.invitationWording}</p>}
      </>
    );
  if (scene.id === "names")
    return <PrincipalNames lines={scene.lines} fallback={scene.fallback} />;
  if (scene.id === "details") {
    const hasDate =
      scene.startTime ||
      scene.eventDay ||
      scene.gregorianDate ||
      scene.hijriDate;
    return (
      <>
        {hasDate && <div className="wedding-date-rule" />}
        {hasDate && (
          <div className="wedding-date-grid">
            {scene.startTime && <span>{scene.startTime}</span>}
            {(scene.eventDay || scene.gregorianDate) && (
              <strong>
                {scene.eventDay && <small>{scene.eventDay}</small>}
                {scene.gregorianDate}
              </strong>
            )}
            {scene.hijriDate && <span dir="rtl">{scene.hijriDate}</span>}
          </div>
        )}
        {scene.venue && <p className="wedding-venue">{scene.venue}</p>}
        {scene.city && <p className="wedding-city">{scene.city}</p>}
        {(scene.receptionTime || scene.dinnerTime) && (
          <div className="wedding-schedule">
            {scene.receptionTime && (
              <span>
                الاستقبال <b>{scene.receptionTime}</b>
              </span>
            )}
            {scene.dinnerTime && (
              <span>
                العشاء <b>{scene.dinnerTime}</b>
              </span>
            )}
          </div>
        )}
        {scene.mapUrl && (
          <a
            className="wedding-map"
            href={scene.mapUrl}
            target="_blank"
            rel="noreferrer"
          >
            <MapPin size={13} /> عرض الموقع
          </a>
        )}
      </>
    );
  }
  return (
    <>
      <p className="wedding-rsvp-guest">دعوة خاصة إلى {scene.guestName}</p>
      <button
        className="wedding-rsvp-button"
        onClick={onOpenRsvp}
        data-testid="button-wedding-rsvp"
      >
        <span>{scene.status === "pending" ? "تأكيد الحضور" : "تعديل الرد"}</span>
        {scene.deadline && <small>{scene.deadline}</small>}
      </button>
    </>
  );
}

function PrincipalNames({
  lines,
  fallback,
}: {
  lines: string[];
  fallback?: string;
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
      {lines.length === 2 && <i>و</i>}
    </div>
  );
}

function WeddingRSVPDrawer({
  guest,
  status,
  onClose,
  onSubmit,
}: {
  guest: WeddingGuestData;
  status: "pending" | "accepted" | "declined";
  onClose: () => void;
  onSubmit: (response: WeddingRsvp) => void | Promise<void>;
}) {
  const [attendance, setAttendance] = useState<"accepted" | "declined">(
    status === "declined" ? "declined" : "accepted",
  );
  const [guestCount, setGuestCount] = useState(1);
  const [message, setMessage] = useState("");
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
      setSubmitError("تعذر حفظ الرد. يرجى المحاولة مرة أخرى.");
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
          aria-label="إغلاق"
        >
          <X />
        </button>
        <span className="wedding-drawer-handle" />
        <p className="wedding-drawer-eyebrow">دعوة خاصة إلى {guest.name}</p>
        <h2 id="wedding-rsvp-title">هل ستشرفنا بالحضور؟</h2>
        <div className="wedding-attendance-options">
          <button
            className={attendance === "accepted" ? "is-selected" : ""}
            onClick={() => setAttendance("accepted")}
            aria-pressed={attendance === "accepted"}
          >
            <Check /> حضور
          </button>
          <button
            className={attendance === "declined" ? "is-selected" : ""}
            onClick={() => setAttendance("declined")}
            aria-pressed={attendance === "declined"}
          >
            <X /> أعتذر عن الحضور
          </button>
        </div>
        {attendance === "accepted" && (
          <div className="wedding-companions">
            <div>
              <strong>عدد الحضور</strong>
              <small>الحد المسموح: {maxGuests}</small>
            </div>
            <div className="wedding-counter">
              <button
                onClick={() =>
                  setGuestCount((value) =>
                    clampGuestCount(value - 1, guest.allowedCompanions),
                  )
                }
                disabled={guestCount <= 1}
                aria-label="تقليل عدد الحضور"
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
                aria-label="زيادة عدد الحضور"
              >
                <Plus />
              </button>
            </div>
          </div>
        )}
        <label className="wedding-message">
          <span>
            رسالة للعروسين <small>(اختياري)</small>
          </span>
          <textarea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            rows={3}
            maxLength={300}
            placeholder="اكتب رسالتك هنا"
          />
        </label>
        <button
          className="wedding-submit"
          onClick={submit}
          disabled={submitting}
        >
          {submitting ? "جارٍ الحفظ…" : "حفظ الرد"}
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
  onChange: (event: WeddingEventData) => void;
};

const builderSteps = [
  { id: "template", label: "القالب" },
  { id: "details", label: "التفاصيل" },
  { id: "style", label: "النمط" },
  { id: "presentation", label: "التخطيط والحركة" },
  { id: "preview", label: "المعاينة" },
] as const;

export function WeddingStudio({
  event,
  guest,
  rsvpStatus,
  onChange,
}: WeddingStudioProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const step = builderSteps[stepIndex];
  const update = (patch: Partial<WeddingEventData>) =>
    onChange({ ...event, ...patch });
  const updateStyle = (patch: Partial<WeddingEventData["style"]>) =>
    update({ style: { ...event.style, ...patch } });
  const updatePresentation = (
    patch: Partial<WeddingEventData["presentation"]>,
  ) => update({ presentation: { ...event.presentation, ...patch } });
  return (
    <div className="wedding-studio" dir="rtl">
      <nav className="wedding-stepper" aria-label="خطوات إنشاء دعوة الزفاف">
        {builderSteps.map((item, index) => (
          <button
            key={item.id}
            onClick={() => setStepIndex(index)}
            className={index === stepIndex ? "is-active" : ""}
            aria-current={index === stepIndex ? "step" : undefined}
          >
            <span>{index + 2}</span>
            {item.label}
          </button>
        ))}
        <span className="wedding-stepper-tail">7 الضيوف · 8 الإرسال</span>
      </nav>
      <div className="wedding-studio-grid">
        <div className="wedding-editor-panel">
          {step.id === "template" && (
            <TemplateStep event={event} update={update} />
          )}
          {step.id === "details" && (
            <DetailsStep event={event} update={update} />
          )}
          {step.id === "style" && (
            <StyleStep
              event={event}
              update={update}
              updateStyle={updateStyle}
            />
          )}
          {step.id === "presentation" && (
            <PresentationStep
              event={event}
              updatePresentation={updatePresentation}
            />
          )}
          {step.id === "preview" && (
            <div className="wedding-preview-copy">
              <span>المعاينة الحقيقية</span>
              <h2>كل ما تراه هنا هو ما يفتحه الضيف.</h2>
              <p>
                شغّل المشاهد، أعدها، افتح تأكيد الحضور، وراجع التفاف الأسماء قبل
                إرسال الرابط.
              </p>
            </div>
          )}
          <div className="wedding-editor-nav">
            <button
              onClick={() => setStepIndex((value) => Math.max(0, value - 1))}
              disabled={stepIndex === 0}
            >
              <ChevronRight /> السابق
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
              التالي <ChevronLeft />
            </button>
          </div>
        </div>
        <div className="wedding-live-preview">
          <div className="wedding-phone-label">
            <span>9:16</span>
            <b>معاينة الضيف</b>
          </div>
          <WeddingInvitationRenderer
            key={event.presentation.motionPresetId}
            event={event}
            guest={guest}
            rsvpStatus={rsvpStatus}
            preview
            onSubmit={() => undefined}
          />
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
        },
      });
    } catch (error) {
      setUploadError(
        error instanceof Error ? error.message : "تعذر تجهيز الصورة.",
      );
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };
  return (
    <div>
      <StepHeading
        kicker="الخطوة 2"
        title="اختاري القالب"
        description="القالب يحدد التصميم البصري والزخارف؛ أما التخطيط والحركة فيُختاران بشكل مستقل."
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
              <small>{template.name} · قالب جاهز</small>
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
            <b>{uploading ? "جارٍ تجهيز الصورة…" : uploaded ? "استبدال الخلفية" : "خلفية خاصة"}</b>
            <small>
              {uploadedBackground
                ? uploadedBackground.fileName
                : "JPEG أو PNG أو WebP · صورة خلفية فقط"}
            </small>
          </span>
          {uploaded && <Check aria-hidden="true" />}
        </button>
        <input
          ref={inputRef}
          className="wedding-file-input"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          aria-label="رفع صورة خلفية للدعوة"
          onChange={(changeEvent) => uploadBackground(changeEvent.target.files?.[0])}
        />
      </div>
      {uploadError && <p className="wedding-upload-error" role="alert">{uploadError}</p>}
      {uploaded && (
        <button
          className="wedding-remove-background"
          onClick={() => update({ visual: { source: "template" } })}
        >
          <Trash2 aria-hidden="true" /> إزالة الخلفية والعودة للقالب الجاهز
        </button>
      )}
      <p className="wedding-registry-note">
        القوالب المخصصة المستقبلية تدخل السجل نفسه، من دون تغيير بيانات الضيوف
        أو نظام الرد.
      </p>
    </div>
  );
}

function DetailsStep({
  event,
  update,
}: {
  event: WeddingEventData;
  update: (patch: Partial<WeddingEventData>) => void;
}) {
  return (
    <div>
      <StepHeading
        kicker="الخطوة 3"
        title="تفاصيل المناسبة"
        description="النصوص أدناه هي المصدر الوحيد لمحتوى الدعوة."
      />
      <div className="wedding-fields">
        <Field
          label="صيغة الدعوة"
          value={event.invitationVariant}
          onChange={(value) =>
            update({ invitationVariant: value as WeddingVariant })
          }
          options={[
            ["both", "العروس والعريس"],
            ["women", "العروس فقط"],
            ["men", "العريس فقط"],
            ["family", "العائلة"],
            ["custom", "نص مخصص"],
          ]}
        />
        <Field
          label="نص الافتتاح"
          value={event.openingWording}
          onChange={(value) => update({ openingWording: value })}
        />
        <Field
          label="أسماء الداعين / العائلتين"
          value={event.hostNames}
          onChange={(value) => update({ hostNames: value })}
          wide
        />
        <Field
          label="عبارة الدعوة"
          value={event.invitationWording}
          onChange={(value) => update({ invitationWording: value })}
          wide
        />
        <Field
          label="اسم العريس"
          value={event.groomName}
          onChange={(value) => update({ groomName: value })}
        />
        <Field
          label="اسم العروس"
          value={event.brideName}
          onChange={(value) => update({ brideName: value })}
        />
        {event.invitationVariant === "family" && (
          <Field
            label="أسماء العائلة"
            value={event.familyNames}
            onChange={(value) => update({ familyNames: value })}
            wide
          />
        )}
        {event.invitationVariant === "custom" && (
          <Field
            label="النص العربي المخصص"
            value={event.customWording}
            onChange={(value) => update({ customWording: value })}
            textarea
            wide
          />
        )}
        <Field
          label="اليوم"
          value={event.eventDay}
          onChange={(value) => update({ eventDay: value })}
        />
        <Field
          label="التاريخ الميلادي"
          value={event.gregorianDate}
          onChange={(value) => update({ gregorianDate: value })}
        />
        <Field
          label="التاريخ الهجري"
          value={event.hijriDate}
          onChange={(value) => update({ hijriDate: value })}
        />
        <Field
          label="وقت البداية"
          value={event.startTime}
          onChange={(value) => update({ startTime: value })}
        />
        <Field
          label="وقت الاستقبال"
          value={event.receptionTime}
          onChange={(value) => update({ receptionTime: value })}
        />
        <Field
          label="وقت العشاء"
          value={event.dinnerTime}
          onChange={(value) => update({ dinnerTime: value })}
        />
        <Field
          label="القاعة"
          value={event.venue}
          onChange={(value) => update({ venue: value })}
        />
        <Field
          label="المدينة"
          value={event.city}
          onChange={(value) => update({ city: value })}
        />
        <Field
          label="رابط الخريطة"
          value={event.mapUrl}
          onChange={(value) => update({ mapUrl: value })}
          wide
          dir="ltr"
        />
        <Field
          label="موعد إغلاق الرد"
          value={event.rsvpDeadline}
          onChange={(value) => update({ rsvpDeadline: value })}
          wide
        />
      </div>
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
  const template =
    WeddingTemplateRegistry[event.templateId as WeddingVisualTemplateId] ??
    WeddingTemplateRegistry["soft-floral-garden"];
  const customization = template.allowedCustomization;
  const uploaded = event.visual.source === "uploaded-background";
  return (
    <div>
      <StepHeading
        kicker="الخطوة 4"
        title="نمط مضبوط بعناية"
        description="ألوان وخطوط وزخارف تضبط الهوية البصرية من دون فرض التكوين أو الحركة."
      />
      {!uploaded && <div className="wedding-style-section">
        <b>الخلفية</b>
        <div className="wedding-color-options">
          {customization.backgrounds.map((color) => (
            <button
              key={color}
              style={{ backgroundColor: color }}
              className={
                event.style.backgroundColor === color ? "is-selected" : ""
              }
              onClick={() => updateStyle({ backgroundColor: color })}
              aria-label={`خلفية ${color}`}
              aria-pressed={event.style.backgroundColor === color}
            />
          ))}
        </div>
      </div>}
      {!uploaded && <div className="wedding-style-section">
        <b>لون العناوين</b>
        <div className="wedding-color-options">
          {customization.accents.map((color) => (
            <button
              key={color}
              style={{ backgroundColor: color }}
              className={event.style.accentColor === color ? "is-selected" : ""}
              onClick={() => updateStyle({ accentColor: color })}
              aria-label={`لون عنوان ${color}`}
              aria-pressed={event.style.accentColor === color}
            />
          ))}
        </div>
      </div>}
      {uploaded && (
        <p className="wedding-upload-style-note">
          الصورة هي الخلفية الأساسية، ويُطبّق عليها غطاء قراءة محايد تلقائيًا.
        </p>
      )}
      <div className="wedding-fields">
        {!uploaded && customization.floralThemes.length > 0 && <Field
          label="ألوان الزهور"
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
          label="خط الأسماء"
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
          label="خط المعلومات"
          value={event.style.bodyFont}
          onChange={(value) => updateStyle({ bodyFont: value as ArabicFont })}
          options={customization.fonts.map((key) => [
            key,
            weddingFonts[key].name,
          ])}
        />
        <Field
          label="رابط موسيقى اختياري"
          value={event.musicUrl}
          onChange={(value) => update({ musicUrl: value })}
          dir="ltr"
        />
        <Field
          label="رابط فيديو خلفية اختياري"
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
}: {
  event: WeddingEventData;
  updatePresentation: (
    patch: Partial<WeddingEventData["presentation"]>,
  ) => void;
}) {
  const template =
    WeddingTemplateRegistry[event.templateId as WeddingVisualTemplateId] ??
    WeddingTemplateRegistry["soft-floral-garden"];
  return (
    <div>
      <StepHeading
        kicker="الخطوة 5"
        title="التخطيط والحركة"
        description="اختاري موضع المحتوى وطريقة دخوله بشكل مستقل عن تصميم القالب."
      />
      <div className="wedding-presentation-section">
        <b>التخطيط</b>
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
                  <strong>{preset.nameAr}</strong>
                  <small>{preset.name}</small>
                  <em>{preset.descriptionAr}</em>
                </span>
                {selected && <Check aria-hidden="true" />}
              </button>
            );
          })}
        </div>
      </div>
      <div className="wedding-presentation-section">
        <b>الحركة</b>
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
                  <strong>{preset.nameAr}</strong>
                  <small>{preset.name}</small>
                  <em>{preset.descriptionAr}</em>
                </span>
                {selected && <Check aria-hidden="true" />}
              </button>
            );
          })}
        </div>
      </div>
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
  dir = "rtl",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options?: ReadonlyArray<ReadonlyArray<string>>;
  textarea?: boolean;
  wide?: boolean;
  dir?: "rtl" | "ltr";
}) {
  return (
    <label className={wide ? "is-wide" : ""}>
      <span>{label}</span>
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
