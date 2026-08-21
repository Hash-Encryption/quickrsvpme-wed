import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  MapPin,
  Minus,
  Music2,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import {
  WeddingTemplateRegistry,
  clampGuestCount,
  floralThemes,
  getWeddingPrincipalLines,
  weddingFonts,
  type ArabicFont,
  type FloralTheme,
  type WeddingEventData,
  type WeddingGuestData,
  type WeddingRsvp,
  type WeddingVariant,
} from "./model";
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
};

export function WeddingInvitationRenderer({
  event,
  guest,
  rsvpStatus = "pending",
  preview = false,
  onSubmit,
}: WeddingRendererProps) {
  const template =
    WeddingTemplateRegistry[event.templateId] ??
    WeddingTemplateRegistry["soft-floral-garden"];
  const reduceMotion = useReducedMotion();
  const audioRef = useRef<HTMLAudioElement>(null);
  const [run, setRun] = useState(0);
  const [activeScene, setActiveScene] = useState(
    reduceMotion ? template.scenes.length - 1 : 0,
  );
  const [isPlaying, setIsPlaying] = useState(!reduceMotion);
  const [isMuted, setIsMuted] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const theme = floralThemes[event.style.floralTheme];

  useEffect(() => {
    if (reduceMotion || !isPlaying) return;
    const timers = template.scenes.slice(1).map((scene, index) =>
      window.setTimeout(() => {
        setActiveScene(index + 1);
        if (index === template.scenes.length - 2) setIsPlaying(false);
      }, scene.startsAt),
    );
    return () => timers.forEach(window.clearTimeout);
  }, [isPlaying, reduceMotion, run, template.scenes]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.muted = isMuted;
    if (isMuted || !isPlaying) audio.pause();
    else void audio.play().catch(() => setIsMuted(true));
  }, [isMuted, isPlaying]);

  const replay = () => {
    setActiveScene(reduceMotion ? template.scenes.length - 1 : 0);
    setIsPlaying(!reduceMotion);
    setRun((value) => value + 1);
  };

  const togglePlayback = () => {
    if (activeScene === template.scenes.length - 1) replay();
    else setIsPlaying((value) => !value);
  };

  const style: WeddingStyleProperties = {
    "--wedding-bg": event.style.backgroundColor,
    "--wedding-accent": event.style.accentColor,
    "--wedding-petal": theme.petal,
    "--wedding-petal-soft": theme.petalSoft,
    "--wedding-leaf": theme.leaf,
    "--wedding-display": weddingFonts[event.style.displayFont].css,
    "--wedding-body": weddingFonts[event.style.bodyFont].css,
  };

  return (
    <section
      className={`wedding-stage ${preview ? "wedding-stage--preview" : ""}`}
      style={style}
      dir="rtl"
      aria-label="دعوة زفاف"
    >
      {event.backgroundMediaUrl && (
        <video
          className="wedding-background-video"
          src={event.backgroundMediaUrl}
          autoPlay
          loop
          muted
          playsInline
          preload="metadata"
          aria-hidden="true"
        />
      )}
      {event.musicUrl && (
        <audio ref={audioRef} src={event.musicUrl} loop preload="none" />
      )}
      <div className="wedding-paper" key={run}>
        <div className="wedding-paper-texture" />
        <FloralGardenFrame />
        <div className="wedding-content">
          <Reveal visible={activeScene >= 0} className="wedding-opening">
            <span className="wedding-ornament">۞</span>
            <p>{event.openingWording}</p>
          </Reveal>

          <Reveal visible={activeScene >= 1} className="wedding-hosts">
            <p className="wedding-host-name">{event.hostNames}</p>
            <p>{event.invitationWording}</p>
          </Reveal>

          <Reveal visible={activeScene >= 2} className="wedding-principals">
            <PrincipalNames event={event} guest={guest} />
          </Reveal>

          <Reveal visible={activeScene >= 3} className="wedding-details">
            <div className="wedding-date-rule" />
            <div className="wedding-date-grid">
              <span>{event.startTime}</span>
              <strong>
                <small>{event.eventDay}</small>
                {event.gregorianDate}
              </strong>
              <span dir="rtl">{event.hijriDate}</span>
            </div>
            <p className="wedding-venue">{event.venue}</p>
            <p className="wedding-city">{event.city}</p>
            {(event.receptionTime || event.dinnerTime) && (
              <div className="wedding-schedule">
                {event.receptionTime && (
                  <span>
                    الاستقبال <b>{event.receptionTime}</b>
                  </span>
                )}
                {event.dinnerTime && (
                  <span>
                    العشاء <b>{event.dinnerTime}</b>
                  </span>
                )}
              </div>
            )}
            {event.mapUrl && (
              <a
                className="wedding-map"
                href={event.mapUrl}
                target="_blank"
                rel="noreferrer"
              >
                <MapPin size={13} /> عرض الموقع
              </a>
            )}
          </Reveal>

          <Reveal visible={activeScene >= 4} className="wedding-rsvp-reveal">
            <button
              className="wedding-rsvp-button"
              onClick={() => setDrawerOpen(true)}
              data-testid="button-wedding-rsvp"
            >
              <span>
                {rsvpStatus === "pending" ? "تأكيد الحضور" : "تعديل الرد"}
              </span>
              <small>{event.rsvpDeadline}</small>
            </button>
          </Reveal>
        </div>
      </div>

      <div className="wedding-controls" aria-label="عناصر تحكم الدعوة">
        <button
          onClick={togglePlayback}
          aria-label={isPlaying ? "إيقاف العرض مؤقتاً" : "تشغيل العرض"}
        >
          {isPlaying ? <Pause /> : <Play />}
        </button>
        <button onClick={replay} aria-label="إعادة العرض">
          <RotateCcw />
        </button>
        <button
          onClick={() => event.musicUrl && setIsMuted((value) => !value)}
          disabled={!event.musicUrl}
          aria-label={isMuted ? "تشغيل الصوت" : "كتم الصوت"}
        >
          {isMuted ? <VolumeX /> : <Volume2 />}
        </button>
      </div>

      <div className="wedding-progress" aria-hidden="true">
        {template.scenes.map((scene, index) => (
          <span
            key={scene.id}
            className={activeScene >= index ? "is-active" : ""}
          />
        ))}
      </div>

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
    </section>
  );
}

function Reveal({
  visible,
  className,
  children,
}: {
  visible: boolean;
  className: string;
  children: ReactNode;
}) {
  return (
    <div
      className={`${className} wedding-reveal ${visible ? "is-visible" : ""}`}
      aria-hidden={!visible}
    >
      {children}
    </div>
  );
}

function PrincipalNames({
  event,
  guest,
}: {
  event: WeddingEventData;
  guest: WeddingGuestData;
}) {
  const lines = getWeddingPrincipalLines(
    event,
    guest.invitationVariantOverride,
  );
  if (!lines.length)
    return <p className="wedding-custom-copy">{event.invitationWording}</p>;
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

function FloralGardenFrame() {
  return (
    <svg
      className="wedding-floral-frame"
      viewBox="0 0 390 693"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      <defs>
        <radialGradient id="petal" cx="38%" cy="30%">
          <stop offset="0" stopColor="#fff" stopOpacity=".8" />
          <stop offset="1" stopColor="var(--wedding-petal)" />
        </radialGradient>
        <linearGradient id="leaf" x1="0" x2="1" y1="0" y2="1">
          <stop stopColor="var(--wedding-leaf)" stopOpacity=".45" />
          <stop offset="1" stopColor="var(--wedding-leaf)" />
        </linearGradient>
        <filter id="soft-shadow">
          <feDropShadow
            dx="0"
            dy="3"
            stdDeviation="4"
            floodColor="#5d5145"
            floodOpacity=".12"
          />
        </filter>
      </defs>
      <path
        className="wedding-arch"
        d="M35 635V168C35 94 92 37 164 37h62c72 0 129 57 129 131v467"
      />
      <g
        className="wedding-botanical wedding-botanical--top"
        filter="url(#soft-shadow)"
      >
        <path
          className="wedding-stem"
          d="M-5 155C47 125 51 55 144 8M20 115C55 98 86 96 114 55M58 78C36 50 33 28 46 2"
        />
        <Leaf x="18" y="108" rotate="-42" />
        <Leaf x="48" y="83" rotate="28" />
        <Leaf x="74" y="63" rotate="-32" />
        <Leaf x="101" y="37" rotate="34" />
        <Leaf x="38" y="31" rotate="-18" />
        <Flower cx="22" cy="74" size="42" />
        <Flower cx="67" cy="33" size="58" />
        <Flower cx="112" cy="18" size="32" />
        <SmallFlowers x="7" y="137" />
        <SmallFlowers x="125" y="47" />
      </g>
      <g
        className="wedding-botanical wedding-botanical--bottom"
        filter="url(#soft-shadow)"
      >
        <path
          className="wedding-stem"
          d="M395 515C345 546 341 620 239 691M378 582C334 591 304 615 284 650M343 632C360 658 365 675 360 697"
        />
        <Leaf x="350" y="536" rotate="35" />
        <Leaf x="327" y="573" rotate="-38" />
        <Leaf x="301" y="607" rotate="30" />
        <Leaf x="267" y="644" rotate="-35" />
        <Leaf x="351" y="658" rotate="16" />
        <Flower cx="371" cy="612" size="48" />
        <Flower cx="326" cy="657" size="62" />
        <Flower cx="270" cy="677" size="34" />
        <SmallFlowers x="354" y="548" />
        <SmallFlowers x="239" y="635" />
      </g>
    </svg>
  );
}

function Flower({
  cx,
  cy,
  size,
}: {
  cx: number | string;
  cy: number | string;
  size: number | string;
}) {
  const petals = Array.from({ length: 9 });
  return (
    <g transform={`translate(${cx} ${cy}) scale(${Number(size) / 46})`}>
      {petals.map((_, index) => (
        <ellipse
          key={index}
          rx="9"
          ry="20"
          fill="url(#petal)"
          transform={`rotate(${index * 40}) translate(0 -12)`}
        />
      ))}
      <circle r="8" fill="var(--wedding-petal-soft)" />
      <circle r="3" fill="#B99A63" />
    </g>
  );
}

function Leaf({
  x,
  y,
  rotate,
}: {
  x: number | string;
  y: number | string;
  rotate: number | string;
}) {
  return (
    <path
      d="M0 0C10-13 24-12 30-1C18 10 7 10 0 0Z"
      fill="url(#leaf)"
      transform={`translate(${x} ${y}) rotate(${rotate})`}
    />
  );
}

function SmallFlowers({ x, y }: { x: number | string; y: number | string }) {
  return (
    <g
      transform={`translate(${x} ${y})`}
      fill="var(--wedding-petal-soft)"
      stroke="var(--wedding-petal)"
      strokeWidth=".8"
    >
      <circle cx="0" cy="0" r="4" />
      <circle cx="13" cy="-8" r="5" />
      <circle cx="25" cy="2" r="3.5" />
      <path
        d="M0 4L-8 18M13-3L11 17M25 5L21 20"
        fill="none"
        stroke="var(--wedding-leaf)"
      />
    </g>
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
  const maxGuests = 1 + Math.max(0, guest.allowedCompanions);
  const submit = async () => {
    setSubmitting(true);
    await onSubmit({
      status: attendance,
      guestCount: attendance === "accepted" ? guestCount : 0,
      message,
    });
    setSubmitting(false);
  };
  return (
    <motion.div
      className="wedding-drawer-backdrop"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="wedding-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="wedding-rsvp-title"
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 28, stiffness: 260 }}
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
        <span className="wedding-stepper-tail">6 الضيوف · 7 الإرسال</span>
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
  return (
    <div>
      <StepHeading
        kicker="الخطوة 2"
        title="اختاري القالب"
        description="القالب يثبت التكوين والحركة؛ وتبقى معلومات كل مناسبة ديناميكية بالكامل."
      />
      <div className="wedding-template-list">
        {Object.values(WeddingTemplateRegistry).map((template) => (
          <button
            key={template.id}
            className={event.templateId === template.id ? "is-selected" : ""}
            onClick={() =>
              update({
                templateId: template.id,
                style: { ...template.defaults },
              })
            }
          >
            <span className="wedding-template-swatch">
              <i />
              <i />
              <i />
            </span>
            <span>
              <b>{template.nameAr}</b>
              <small>{template.name} · قالب جاهز</small>
            </span>
            {event.templateId === template.id && <Check />}
          </button>
        ))}
      </div>
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
  const customization =
    WeddingTemplateRegistry[event.templateId].allowedCustomization;
  return (
    <div>
      <StepHeading
        kicker="الخطوة 4"
        title="نمط مضبوط بعناية"
        description="خيارات محددة تحافظ على التباين والتكوين في كل شاشة."
      />
      <div className="wedding-style-section">
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
      </div>
      <div className="wedding-style-section">
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
      </div>
      <div className="wedding-fields">
        <Field
          label="ألوان الزهور"
          value={event.style.floralTheme}
          onChange={(value) =>
            updateStyle({ floralTheme: value as FloralTheme })
          }
          options={customization.floralThemes.map((key) => [
            key,
            floralThemes[key].name,
          ])}
        />
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
