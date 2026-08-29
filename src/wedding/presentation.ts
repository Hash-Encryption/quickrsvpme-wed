export const weddingSceneIds = [
  "opening",
  "hosts",
  "names",
  "details",
  "rsvp",
] as const;

export type WeddingSceneId = (typeof weddingSceneIds)[number];
export type WeddingSceneTiming = {
  id: WeddingSceneId;
  startsAt: number;
};

export const canonicalWeddingSceneTimings: ReadonlyArray<WeddingSceneTiming> = [
  { id: "opening", startsAt: 0 },
  { id: "hosts", startsAt: 3000 },
  { id: "names", startsAt: 6000 },
  { id: "details", startsAt: 10000 },
  { id: "rsvp", startsAt: 14000 },
];
export type WeddingLayoutPresetId =
  | "centered-elegance"
  | "editorial-offset"
  | "cinematic-focus";
export type WeddingMotionPresetId =
  | "soft-dissolve"
  | "cinematic-rise"
  | "editorial-glide";
export type WeddingSafeZone = "auto" | "top" | "center" | "bottom";

export const weddingTransformBlockIds = [
  "opening", "occasion", "hosts", "principals", "date-time", "venue", "rsvp",
] as const;
export type WeddingTransformBlockId = (typeof weddingTransformBlockIds)[number];
export type WeddingTransform = { scale: number; x: number; y: number };
export type WeddingLayoutTransforms = {
  global: WeddingTransform;
  blocks: Partial<Record<WeddingTransformBlockId, WeddingTransform>>;
};

export const defaultWeddingTransform: WeddingTransform = { scale: 1, x: 0, y: 0 };
export const defaultWeddingLayoutTransforms: WeddingLayoutTransforms = {
  global: defaultWeddingTransform,
  blocks: {},
};

export type WeddingPresentation = {
  layoutPresetId: WeddingLayoutPresetId;
  motionPresetId: WeddingMotionPresetId;
  safeZone: WeddingSafeZone;
  transforms: WeddingLayoutTransforms;
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
  behavior: "elegant" | "cinematic" | "progressive";
  name: string;
  nameAr: string;
  descriptionAr: string;
  enterDurationMs: number;
  exitDurationMs: number;
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
    behavior: "elegant",
    name: "Elegant",
    nameAr: "أناقة هادئة",
    descriptionAr: "تتابع فاخر وهادئ بتلاشي ناعم واستقرار رقيق.",
    enterDurationMs: 720,
    exitDurationMs: 320,
    enter: { opacity: 0, blockOffset: 8 },
    active: { opacity: 1, blockOffset: 0 },
    exit: { opacity: 0, blockOffset: -3 },
    enterTransition: { duration: 0.46, ease: [0.22, 1, 0.36, 1] },
    exitTransition: { duration: 0.22, ease: [0.4, 0, 1, 1] },
  },
  "cinematic-rise": {
    id: "cinematic-rise",
    behavior: "cinematic",
    name: "Cinematic Rise",
    nameAr: "صعود سينمائي",
    descriptionAr: "صعود فاخر ومقيد مع تغير طفيف في الحجم.",
    enterDurationMs: 880,
    exitDurationMs: 380,
    enter: { opacity: 0, blockOffset: 26, scale: 0.985 },
    active: { opacity: 1, blockOffset: 0, scale: 1 },
    exit: { opacity: 0, blockOffset: -8, scale: 0.995 },
    enterTransition: { duration: 0.68, ease: [0.16, 1, 0.3, 1] },
    exitTransition: { duration: 0.3, ease: [0.4, 0, 1, 1] },
  },
  "editorial-glide": {
    id: "editorial-glide",
    behavior: "progressive",
    name: "Progressive Classic",
    nameAr: "كلاسيكية متتابعة",
    descriptionAr: "تتراكم معلومات الدعوة بهدوء حتى تكتمل في مشهد واحد.",
    enterDurationMs: 560,
    exitDurationMs: 0,
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
  const safeZone = ["top", "center", "bottom"].includes(value?.safeZone as string)
    ? value?.safeZone as Exclude<WeddingSafeZone, "auto">
    : "auto";
  return {
    layoutPresetId,
    motionPresetId,
    safeZone,
    transforms: normalizeWeddingLayoutTransforms(value?.transforms),
  };
}

const clamp = (value: unknown, min: number, max: number, fallback: number) =>
  typeof value === "number" && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;

export function normalizeWeddingTransform(value: unknown, block = false): WeddingTransform {
  const transform = value && typeof value === "object" ? value as Partial<WeddingTransform> : {};
  return {
    scale: clamp(transform.scale, block ? 0.75 : 0.8, block ? 1.35 : 1.25, 1),
    x: clamp(transform.x, block ? -0.25 : -0.18, block ? 0.25 : 0.18, 0),
    y: clamp(transform.y, block ? -0.25 : -0.22, block ? 0.25 : 0.22, 0),
  };
}

export function normalizeWeddingLayoutTransforms(value: unknown): WeddingLayoutTransforms {
  const transforms = value && typeof value === "object" ? value as Partial<WeddingLayoutTransforms> : {};
  const source = transforms.blocks && typeof transforms.blocks === "object" ? transforms.blocks : {};
  const blocks = Object.fromEntries(weddingTransformBlockIds.flatMap((id) =>
    id in source ? [[id, normalizeWeddingTransform(source[id], true)]] : [],
  )) as WeddingLayoutTransforms["blocks"];
  return { global: normalizeWeddingTransform(transforms.global), blocks };
}

export function resetWeddingLayoutTransforms(): WeddingLayoutTransforms {
  return { global: { ...defaultWeddingTransform }, blocks: {} };
}

export function selectWeddingLayoutPreset(
  presentation: WeddingPresentation,
  layoutPresetId: WeddingLayoutPresetId,
): WeddingPresentation {
  return { ...presentation, layoutPresetId, transforms: resetWeddingLayoutTransforms() };
}

export function weddingTransformCss(transform: WeddingTransform): string {
  return `translate(${transform.x * 100}%, ${transform.y * 100}%) scale(${transform.scale})`;
}

export function resolveWeddingSafeZone(
  safeZone: WeddingSafeZone,
  layoutVertical: WeddingLayoutRule["vertical"],
  focalY?: number,
): WeddingLayoutRule["vertical"] {
  if (safeZone !== "auto") return safeZone;
  if (typeof focalY !== "number" || !Number.isFinite(focalY)) return layoutVertical;
  if (focalY < 0.34) return "bottom";
  if (focalY > 0.66) return "top";
  return layoutVertical;
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
