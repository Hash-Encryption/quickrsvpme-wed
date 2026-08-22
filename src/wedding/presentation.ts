export const weddingSceneIds = [
  "opening",
  "hosts",
  "names",
  "details",
  "rsvp",
] as const;

export type WeddingSceneId = (typeof weddingSceneIds)[number];
export type WeddingLayoutPresetId =
  | "centered-elegance"
  | "editorial-offset"
  | "cinematic-focus";
export type WeddingMotionPresetId =
  | "soft-dissolve"
  | "cinematic-rise"
  | "editorial-glide";

export type WeddingPresentation = {
  layoutPresetId: WeddingLayoutPresetId;
  motionPresetId: WeddingMotionPresetId;
};

export type WeddingLayoutRule = {
  vertical: "top" | "center" | "bottom";
  horizontal: "start" | "center" | "end";
  width: "compact" | "medium" | "wide";
};

export type WeddingLayoutPreset = {
  id: WeddingLayoutPresetId;
  name: string;
  nameAr: string;
  descriptionAr: string;
  scenes: Record<WeddingSceneId, WeddingLayoutRule>;
};

export type WeddingMotionState = {
  opacity: number;
  blockOffset?: number;
  inlineOffset?: number;
  scale?: number;
};

export type WeddingMotionTransition = {
  duration: number;
  ease: [number, number, number, number];
};

export type WeddingMotionTarget = {
  opacity: number;
  x: number;
  y: number;
  scale: number;
};

export type WeddingMotionPreset = {
  id: WeddingMotionPresetId;
  name: string;
  nameAr: string;
  descriptionAr: string;
  enter: WeddingMotionState;
  active: WeddingMotionState;
  exit: WeddingMotionState;
  enterTransition: WeddingMotionTransition;
  exitTransition: WeddingMotionTransition;
};

export type WeddingTemplatePresentation = {
  defaultLayoutPresetId: WeddingLayoutPresetId;
  defaultMotionPresetId: WeddingMotionPresetId;
  supportedLayoutPresetIds: ReadonlyArray<WeddingLayoutPresetId>;
  supportedMotionPresetIds: ReadonlyArray<WeddingMotionPresetId>;
};

export const WeddingLayoutPresets: Record<
  WeddingLayoutPresetId,
  WeddingLayoutPreset
> = {
  "centered-elegance": {
    id: "centered-elegance",
    name: "Centered Elegance",
    nameAr: "أناقة مركزية",
    descriptionAr: "تكوين كلاسيكي متوازن بمساحات هادئة ومحور واضح.",
    scenes: {
      opening: { vertical: "center", horizontal: "center", width: "medium" },
      hosts: { vertical: "center", horizontal: "center", width: "medium" },
      names: { vertical: "center", horizontal: "center", width: "wide" },
      details: { vertical: "center", horizontal: "center", width: "wide" },
      rsvp: { vertical: "center", horizontal: "center", width: "medium" },
    },
  },
  "editorial-offset": {
    id: "editorial-offset",
    name: "Editorial Offset",
    nameAr: "تحريرية جانبية",
    descriptionAr: "محاذاة منطقية جريئة وتكوين واسع وغير متماثل.",
    scenes: {
      opening: { vertical: "top", horizontal: "start", width: "medium" },
      hosts: { vertical: "center", horizontal: "start", width: "medium" },
      names: { vertical: "center", horizontal: "start", width: "wide" },
      details: { vertical: "center", horizontal: "start", width: "wide" },
      rsvp: { vertical: "bottom", horizontal: "start", width: "medium" },
    },
  },
  "cinematic-focus": {
    id: "cinematic-focus",
    name: "Cinematic Focus",
    nameAr: "تركيز سينمائي",
    descriptionAr: "فراغ درامي، أسماء مهيمنة، وتفاصيل في المنطقة السفلية.",
    scenes: {
      opening: { vertical: "top", horizontal: "center", width: "compact" },
      hosts: { vertical: "center", horizontal: "center", width: "medium" },
      names: { vertical: "center", horizontal: "center", width: "wide" },
      details: { vertical: "bottom", horizontal: "center", width: "wide" },
      rsvp: { vertical: "bottom", horizontal: "center", width: "medium" },
    },
  },
};

export const WeddingMotionPresets: Record<
  WeddingMotionPresetId,
  WeddingMotionPreset
> = {
  "soft-dissolve": {
    id: "soft-dissolve",
    name: "Soft Dissolve",
    nameAr: "تلاشي ناعم",
    descriptionAr: "ظهور هادئ بحركة رأسية تكاد لا تُرى.",
    enter: { opacity: 0, blockOffset: 8 },
    active: { opacity: 1, blockOffset: 0 },
    exit: { opacity: 0, blockOffset: -3 },
    enterTransition: { duration: 0.46, ease: [0.22, 1, 0.36, 1] },
    exitTransition: { duration: 0.22, ease: [0.4, 0, 1, 1] },
  },
  "cinematic-rise": {
    id: "cinematic-rise",
    name: "Cinematic Rise",
    nameAr: "صعود سينمائي",
    descriptionAr: "صعود فاخر ومقيد مع تغير طفيف في الحجم.",
    enter: { opacity: 0, blockOffset: 26, scale: 0.985 },
    active: { opacity: 1, blockOffset: 0, scale: 1 },
    exit: { opacity: 0, blockOffset: -8, scale: 0.995 },
    enterTransition: { duration: 0.68, ease: [0.16, 1, 0.3, 1] },
    exitTransition: { duration: 0.3, ease: [0.4, 0, 1, 1] },
  },
  "editorial-glide": {
    id: "editorial-glide",
    name: "Editorial Glide",
    nameAr: "انسياب تحريري",
    descriptionAr: "دخول أفقي واعٍ باتجاه العربية بإيقاع تحريري.",
    enter: { opacity: 0, inlineOffset: 22 },
    active: { opacity: 1, inlineOffset: 0 },
    exit: { opacity: 0, inlineOffset: -8 },
    enterTransition: { duration: 0.58, ease: [0.22, 1, 0.36, 1] },
    exitTransition: { duration: 0.26, ease: [0.4, 0, 1, 1] },
  },
};

export function resolveWeddingPresentation(
  value: Partial<Record<keyof WeddingPresentation, unknown>> | undefined,
  template: WeddingTemplatePresentation,
): WeddingPresentation {
  const layoutPresetId = template.supportedLayoutPresetIds.includes(
    value?.layoutPresetId as WeddingLayoutPresetId,
  )
    ? (value?.layoutPresetId as WeddingLayoutPresetId)
    : template.defaultLayoutPresetId;
  const motionPresetId = template.supportedMotionPresetIds.includes(
    value?.motionPresetId as WeddingMotionPresetId,
  )
    ? (value?.motionPresetId as WeddingMotionPresetId)
    : template.defaultMotionPresetId;
  return { layoutPresetId, motionPresetId };
}

export function resolveWeddingMotionTarget(
  state: WeddingMotionState,
  direction: "rtl" | "ltr",
  reduceMotion: boolean,
): WeddingMotionTarget {
  if (reduceMotion) return { opacity: 1, x: 0, y: 0, scale: 1 };
  return {
    opacity: state.opacity,
    x: (state.inlineOffset ?? 0) * (direction === "rtl" ? 1 : -1),
    y: state.blockOffset ?? 0,
    scale: state.scale ?? 1,
  };
}
