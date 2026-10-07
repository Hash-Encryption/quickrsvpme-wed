// Keep normalized data well below typical 5 MB localStorage quotas; raw files
// are capped before decode and large dimensions are reduced before encoding.
export const weddingBackgroundLimits = {
  maxRawBytes: 12 * 1024 * 1024,
  maxOutputBytes: 1_400_000,
  maxDataUrlLength: 2_000_000,
  maxDimension: 1920,
} as const;

export const supportedWeddingBackgroundTypes = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export type WeddingUploadedBackground = {
  dataUrl: string;
  fileName: string;
  mimeType: string;
};

export type WeddingArtworkFitMode = "fit" | "fill";
export type WeddingNormalizedPoint = { x: number; y: number };
export type WeddingArtworkSettings = {
  fitMode: WeddingArtworkFitMode;
  backgroundPosition: WeddingNormalizedPoint;
  backgroundZoom: number;
  focalPoint: WeddingNormalizedPoint;
};

export const defaultWeddingArtworkSettings: WeddingArtworkSettings = {
  fitMode: "fit",
  backgroundPosition: { x: 0.5, y: 0.5 },
  backgroundZoom: 1,
  focalPoint: { x: 0.5, y: 0.5 },
};

export type WeddingVisualSelection =
  | { source: "template" }
  | {
      source: "uploaded-background";
      uploadedBackground: WeddingUploadedBackground;
    } & WeddingArtworkSettings;

const finite = (value: unknown, fallback: number) =>
  typeof value === "number" && Number.isFinite(value) ? value : fallback;
const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(maximum, Math.max(minimum, value));

export function normalizeWeddingPoint(
  value: unknown,
  fallback: WeddingNormalizedPoint = defaultWeddingArtworkSettings.backgroundPosition,
): WeddingNormalizedPoint {
  const point = value && typeof value === "object"
    ? value as Partial<WeddingNormalizedPoint>
    : {};
  return {
    x: clamp(finite(point.x, fallback.x), 0, 1),
    y: clamp(finite(point.y, fallback.y), 0, 1),
  };
}

export function normalizeWeddingArtworkSettings(
  value: unknown,
): WeddingArtworkSettings {
  const settings = value && typeof value === "object"
    ? value as Partial<WeddingArtworkSettings>
    : {};
  const fitMode = settings.fitMode === "fill" ? "fill" : "fit";
  const backgroundPosition = normalizeWeddingPoint(settings.backgroundPosition);
  return {
    fitMode,
    backgroundPosition,
    backgroundZoom: fitMode === "fit"
      ? 1
      : clamp(finite(settings.backgroundZoom, 1), 1, 2),
    focalPoint: normalizeWeddingPoint(settings.focalPoint, backgroundPosition),
  };
}

export function moveWeddingArtwork(
  start: WeddingNormalizedPoint,
  deltaX: number,
  deltaY: number,
  width: number,
  height: number,
): WeddingNormalizedPoint {
  if (width <= 0 || height <= 0) return normalizeWeddingPoint(start);
  return normalizeWeddingPoint({
    x: start.x - deltaX / width,
    y: start.y - deltaY / height,
  });
}

export function isValidWeddingBackgroundMetadata(
  value: unknown,
): value is WeddingUploadedBackground {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<WeddingUploadedBackground>;
  return (
    typeof item.fileName === "string" &&
    item.fileName.trim().length > 0 &&
    typeof item.mimeType === "string" &&
    supportedWeddingBackgroundTypes.includes(
      item.mimeType as (typeof supportedWeddingBackgroundTypes)[number],
    ) &&
    typeof item.dataUrl === "string" &&
    item.dataUrl.length <= weddingBackgroundLimits.maxDataUrlLength &&
    item.dataUrl.startsWith(`data:${item.mimeType};base64,`)
  );
}

export function resolveWeddingVisualSelection(
  value: unknown,
): WeddingVisualSelection {
  if (!value || typeof value !== "object") return { source: "template" };
  const selection = value as Partial<WeddingVisualSelection> & {
    uploadedBackground?: unknown;
  };
  if (selection.source === "template") return { source: "template" };
  if (
    selection.source === "uploaded-background" &&
    isValidWeddingBackgroundMetadata(selection.uploadedBackground)
  ) {
    return {
      source: "uploaded-background",
      uploadedBackground: selection.uploadedBackground,
      ...normalizeWeddingArtworkSettings(selection),
    };
  }
  return { source: "template" };
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  quality: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("تعذر ضغط الصورة."))),
      "image/webp",
      quality,
    );
  });
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("تعذر قراءة الصورة المضغوطة."));
    reader.readAsDataURL(blob);
  });
}

export function detectWeddingImageMimeType(file: File): string | null {
  const rawType = (file.type || '').trim().toLowerCase();
  if (rawType === 'image/jpeg' || rawType === 'image/jpg' || rawType === 'image/pjpeg') return 'image/jpeg';
  if (rawType === 'image/png') return 'image/png';
  if (rawType === 'image/webp') return 'image/webp';

  const name = (file.name || '').toLowerCase();
  if (name.endsWith('.jpg') || name.endsWith('.jpeg')) return 'image/jpeg';
  if (name.endsWith('.png')) return 'image/png';
  if (name.endsWith('.webp')) return 'image/webp';

  return null;
}

export function validateWeddingUploadFile(file: File): string {
  const mimeType = detectWeddingImageMimeType(file);
  if (!mimeType) {
    throw new Error("اختاري صورة بصيغة JPEG أو PNG أو WebP.");
  }
  if (file.size > weddingBackgroundLimits.maxRawBytes) {
    throw new Error("حجم الصورة كبير جدًا. الحد الأقصى قبل المعالجة هو 12 MB.");
  }
  return mimeType;
}

export async function normalizeWeddingBackground(
  file: File,
): Promise<WeddingUploadedBackground> {
  const mimeType = validateWeddingUploadFile(file);

  let width = 0;
  let height = 0;
  let drawToCanvas: (context: CanvasRenderingContext2D, w: number, h: number) => void = () => {};
  let cleanup: () => void = () => {};

  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file);
      width = bitmap.width;
      height = bitmap.height;
      drawToCanvas = (ctx, w, h) => ctx.drawImage(bitmap, 0, 0, w, h);
      cleanup = () => bitmap.close();
    } catch {
      // Fall through to HTMLImageElement fallback
    }
  }

  if (!width || !height) {
    await new Promise<void>((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        width = img.naturalWidth || img.width;
        height = img.naturalHeight || img.height;
        drawToCanvas = (ctx, w, h) => ctx.drawImage(img, 0, 0, w, h);
        cleanup = () => URL.revokeObjectURL(url);
        resolve();
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("تعذر فتح الصورة. جرّبي ملفًا آخر."));
      };
      img.src = url;
    });
  }

  try {
    const scale = Math.min(
      1,
      weddingBackgroundLimits.maxDimension / Math.max(width, height),
    );
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("تعذر تجهيز الصورة للمعاينة.");
    drawToCanvas(context, canvas.width, canvas.height);

    let output = await canvasToBlob(canvas, 0.84);
    for (let quality = 0.74; output.size > weddingBackgroundLimits.maxOutputBytes && quality >= 0.5; quality -= 0.12) {
      output = await canvasToBlob(canvas, quality);
    }
    if (output.size > weddingBackgroundLimits.maxOutputBytes) {
      throw new Error("تعذر ضغط الصورة إلى حجم مناسب للحفظ المحلي.");
    }

    return {
      dataUrl: await blobToDataUrl(output),
      fileName: file.name,
      mimeType: "image/webp",
    };
  } finally {
    cleanup();
  }
}
