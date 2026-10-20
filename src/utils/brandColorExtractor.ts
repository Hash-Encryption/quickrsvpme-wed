/**
 * Brand Color Extractor & Saudi Luxury Palette Engine
 * Extracts dominant, primary text, and accent colors from logo/image data URLs,
 * performs client-side white-background logo transparency processing,
 * with deterministic SSR/test fallbacks and 6 curated Saudi/Corporate luxury palettes.
 */

export type BrandTheme = {
  name?: string;
  backgroundColor: string;
  surfaceColor: string;
  primaryColor: string;
  accentColor: string;
};

export type ExtractedPalette = {
  background: string;
  primary: string;
  accent: string;
  swatches: string[];
  dominantHex?: string;
  accentHex?: string;
  themes?: {
    dark: BrandTheme;
    light: BrandTheme;
    bold: BrandTheme;
    vibrant?: BrandTheme;
  };
};

export type SaudiBrandPalette = {
  id: string;
  name: string;
  nameAr: string;
  description: string;
  descriptionAr: string;
  backgroundColor: string;
  surfaceColor: string;
  primaryColor: string;
  accentColor: string;
  swatches: string[];
};

export const SAUDI_LUXURY_PALETTES: SaudiBrandPalette[] = [
  {
    id: 'riyadh-executive',
    name: 'Riyadh Executive',
    nameAr: 'أزرق تنفيذي · الرياض',
    description: 'Deep navy with bronze copper accents and clean architectural structure.',
    descriptionAr: 'كحلي داكن مع لمسات نحاسية وتخطيط معماري رصين.',
    backgroundColor: '#0F1E2E',
    surfaceColor: '#172B3E',
    primaryColor: '#F4F7F9',
    accentColor: '#C28B55',
    swatches: ['#0F1E2E', '#172B3E', '#C28B55', '#F4F7F9'],
  },
  {
    id: 'royal-emerald',
    name: 'Royal Emerald',
    nameAr: 'زمردي ملكي فاخر',
    description: 'Dark forest emerald with champagne accents for prestige functions.',
    descriptionAr: 'أخضر زمردي داكن مع ذهب شامبين للمناسبات الرفيعة.',
    backgroundColor: '#0A261D',
    surfaceColor: '#13392D',
    primaryColor: '#F2F8F5',
    accentColor: '#D4AF37',
    swatches: ['#0A261D', '#13392D', '#D4AF37', '#F2F8F5'],
  },
  {
    id: 'diriyah-terracotta',
    name: 'Diriyah Terracotta',
    nameAr: 'طين الدرعية التراثي',
    description: 'Historic warm earth and Najdi clay with refined desert sand.',
    descriptionAr: 'طين نجدي دافئ مستوحى من طراز الطريف وبوابة الدرعية.',
    backgroundColor: '#2C1810',
    surfaceColor: '#3E2319',
    primaryColor: '#FDFBF7',
    accentColor: '#C27A56',
    swatches: ['#2C1810', '#3E2319', '#C27A56', '#FDFBF7'],
  },
  {
    id: 'red-sea-pearl',
    name: 'Red Sea Pearl',
    nameAr: 'لؤلؤ البحر الأحمر',
    description: 'Deep maritime cyan and coastal pearl for modern tech and coastal summits.',
    descriptionAr: 'كحلي بحري عميق مع زرقة شاطئية وأبيض لؤلؤي متألق.',
    backgroundColor: '#0E1D24',
    surfaceColor: '#162C36',
    primaryColor: '#F0F6F8',
    accentColor: '#4FA8B8',
    swatches: ['#0E1D24', '#162C36', '#4FA8B8', '#F0F6F8'],
  },
  {
    id: 'desert-champagne',
    name: 'Desert Champagne',
    nameAr: 'شامبين الصحراء الذهبي',
    description: 'Rich dark espresso with luminous champagne gold warmth.',
    descriptionAr: 'إسبريسو غني مع إشراقة ذهبية دافئة للمساء.',
    backgroundColor: '#1C1917',
    surfaceColor: '#2B2623',
    primaryColor: '#FBF9F5',
    accentColor: '#D6B265',
    swatches: ['#1C1917', '#2B2623', '#D6B265', '#FBF9F5'],
  },
  {
    id: 'minimalist-alabaster',
    name: 'Minimalist Alabaster',
    nameAr: 'رخام أبيض نقي',
    description: 'Pristine warm alabaster with deep obsidian typography.',
    descriptionAr: 'رخام ناصع وأبيض عاجي مع كتابة سوداء رصينة ولمسة برونزية.',
    backgroundColor: '#F8F6F0',
    surfaceColor: '#FFFFFF',
    primaryColor: '#1A1A1A',
    accentColor: '#8C7355',
    swatches: ['#F8F6F0', '#FFFFFF', '#8C7355', '#1A1A1A'],
  },
];

/**
 * Calculates relative luminance for RGB components.
 */
export function getRelativeLuminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

/**
 * Converts RGB numbers to 6-digit hex string.
 */
export function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map((x) => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, '0')).join('').toUpperCase();
}

/**
 * Parses a hex string to RGB tuple.
 */
export function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  if (clean.length === 3) {
    return [
      parseInt(clean[0] + clean[0], 16),
      parseInt(clean[1] + clean[1], 16),
      parseInt(clean[2] + clean[2], 16),
    ];
  }
  return [
    parseInt(clean.slice(0, 2), 16) || 0,
    parseInt(clean.slice(2, 4), 16) || 0,
    parseInt(clean.slice(4, 6), 16) || 0,
  ];
}

/**
 * Quantizes an RGB color to reduce bucket noise.
 */
function quantize(val: number, step = 24): number {
  return Math.min(255, Math.floor(val / step) * step + Math.floor(step / 2));
}

/**
 * Mixes two hex colors by given weight (0 to 1).
 */
export function mixColors(hex1: string, hex2: string, weight = 0.5): string {
  const [r1, g1, b1] = hexToRgb(hex1);
  const [r2, g2, b2] = hexToRgb(hex2);
  const r = Math.round(r1 * (1 - weight) + r2 * weight);
  const g = Math.round(g1 * (1 - weight) + g2 * weight);
  const b = Math.round(b1 * (1 - weight) + b2 * weight);
  return rgbToHex(r, g, b);
}

/**
 * Adjusts color shade / luminance. factor < 1 darkens, factor > 1 lightens.
 */
export function shadeColor(hex: string, factor: number): string {
  const [r, g, b] = hexToRgb(hex);
  return rgbToHex(r * factor, g * factor, b * factor);
}

/**
 * Derives 3 calibrated luxury brand themes from extracted brand colors.
 */
export function deriveBrandTheme(
  dominantHex: string,
  accentHex: string,
  mode: 'dark' | 'light' | 'bold' | 'vibrant'
): BrandTheme {
  const [dr, dg, db] = hexToRgb(dominantHex);
  const domLum = getRelativeLuminance(dr, dg, db);

  if (mode === 'dark') {
    // Deepen primary brand color into rich, atmospheric dark canvas (luminance ~12%)
    const deepBg = domLum > 0.3 ? shadeColor(dominantHex, 0.15) : shadeColor(dominantHex, 0.38);
    const [br, bg, bb] = hexToRgb(deepBg);
    const bgLum = getRelativeLuminance(br, bg, bb);
    const finalBg = bgLum > 0.12 ? mixColors(deepBg, '#070B10', 0.7) : deepBg;
    // Slightly lighter shade (luminance ~18%) for curved sheet / surface
    const surface = mixColors(finalBg, '#FFFFFF', 0.08);

    return {
      name: 'Brand Dark',
      backgroundColor: finalBg,
      surfaceColor: surface,
      primaryColor: '#FFFFFF',
      accentColor: accentHex,
    };
  }

  if (mode === 'light') {
    // Warm alabaster / ivory background
    const tintedBg = '#FAF8F5';
    // Deep darkened shade of primaryBrandHex for high contrast text
    const darkPrimary = domLum < 0.2 ? dominantHex : shadeColor(dominantHex, 0.25);

    return {
      name: 'Brand Light',
      backgroundColor: tintedBg,
      surfaceColor: '#FFFFFF',
      primaryColor: darkPrimary,
      accentColor: accentHex,
    };
  }

  // 'bold' or 'vibrant': Uses exact extracted brand color as dominant canvas
  const bg = dominantHex;
  const isLight = domLum > 0.45;
  const surface = isLight ? mixColors(bg, '#000000', 0.06) : mixColors(bg, '#FFFFFF', 0.12);
  const primary = isLight ? '#0F172A' : '#FFFFFF';

  return {
    name: mode === 'vibrant' ? 'Brand Vibrant' : 'Brand Bold',
    backgroundColor: bg,
    surfaceColor: surface,
    primaryColor: primary,
    accentColor: isLight ? mixColors(accentHex, '#000000', 0.25) : accentHex,
  };
}

/**
 * Client-side White-Background Removal using HTML5 Canvas.
 * Detects near-white pixels connected to image edges and removes background alpha,
 * returning a transparent PNG data URL.
 */
export async function processLogoDataUrl(
  dataUrl: string,
  removeWhiteBg: boolean
): Promise<string> {
  if (!removeWhiteBg || !dataUrl || typeof document === 'undefined') {
    return dataUrl;
  }

  return new Promise<string>((resolve) => {
    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';

      const timer = setTimeout(() => resolve(dataUrl), 2000);

      img.onload = () => {
        clearTimeout(timer);
        try {
          const w = img.naturalWidth || img.width;
          const h = img.naturalHeight || img.height;
          if (!w || !h) {
            resolve(dataUrl);
            return;
          }

          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d', { willReadFrequently: true });
          if (!ctx) {
            resolve(dataUrl);
            return;
          }

          ctx.drawImage(img, 0, 0, w, h);
          const imgData = ctx.getImageData(0, 0, w, h);
          const data = imgData.data;

          // Helper to check if pixel is near-white
          const isNearWhite = (r: number, g: number, b: number) => r > 238 && g > 238 && b > 238;

          // BFS flood-fill from all 4 borders to remove outer white background
          const visited = new Uint8Array(w * h);
          const queue: number[] = [];

          // Enqueue top and bottom borders
          for (let x = 0; x < w; x++) {
            // top
            const idxTop = 0 * w + x;
            if (isNearWhite(data[idxTop * 4], data[idxTop * 4 + 1], data[idxTop * 4 + 2])) {
              queue.push(idxTop);
              visited[idxTop] = 1;
            }
            // bottom
            const idxBottom = (h - 1) * w + x;
            if (isNearWhite(data[idxBottom * 4], data[idxBottom * 4 + 1], data[idxBottom * 4 + 2])) {
              queue.push(idxBottom);
              visited[idxBottom] = 1;
            }
          }

          // Enqueue left and right borders
          for (let y = 0; y < h; y++) {
            const idxLeft = y * w + 0;
            if (!visited[idxLeft] && isNearWhite(data[idxLeft * 4], data[idxLeft * 4 + 1], data[idxLeft * 4 + 2])) {
              queue.push(idxLeft);
              visited[idxLeft] = 1;
            }
            const idxRight = y * w + (w - 1);
            if (!visited[idxRight] && isNearWhite(data[idxRight * 4], data[idxRight * 4 + 1], data[idxRight * 4 + 2])) {
              queue.push(idxRight);
              visited[idxRight] = 1;
            }
          }

          // Flood fill outer white areas
          let head = 0;
          while (head < queue.length) {
            const curr = queue[head++];
            const cx = curr % w;
            const cy = Math.floor(curr / w);

            // Set alpha to 0 for connected white background
            data[curr * 4 + 3] = 0;

            const neighbors = [
              cy > 0 ? (cy - 1) * w + cx : -1,
              cy < h - 1 ? (cy + 1) * w + cx : -1,
              cx > 0 ? cy * w + (cx - 1) : -1,
              cx < w - 1 ? cy * w + (cx + 1) : -1,
            ];

            for (const n of neighbors) {
              if (n >= 0 && !visited[n]) {
                const nr = data[n * 4];
                const ng = data[n * 4 + 1];
                const nb = data[n * 4 + 2];
                if (isNearWhite(nr, ng, nb)) {
                  visited[n] = 1;
                  queue.push(n);
                }
              }
            }
          }

          // If no outer border white was found, fall back to global near-white alpha zeroing
          if (queue.length === 0) {
            for (let i = 0; i < data.length; i += 4) {
              if (data[i] > 242 && data[i + 1] > 242 && data[i + 2] > 242) {
                data[i + 3] = 0;
              }
            }
          }

          ctx.putImageData(imgData, 0, 0);
          resolve(canvas.toDataURL('image/png'));
        } catch {
          resolve(dataUrl);
        }
      };

      img.onerror = () => {
        clearTimeout(timer);
        resolve(dataUrl);
      };

      img.src = dataUrl;
    } catch {
      resolve(dataUrl);
    }
  });
}

/**
 * Extracts dominant, primary, and accent colors from an image Data URL using
 * real chromatic pixel clustering (skips transparent, near-white, and near-black pixels).
 * Falls back deterministically if offscreen canvas or browser runtime is unavailable.
 */
export async function extractColorsFromImageDataUrl(dataUrl: string): Promise<ExtractedPalette> {
  const fallbackDominant = '#0F1E2E';
  const fallbackAccent = '#C28B55';
  const fallbackThemes = {
    dark: deriveBrandTheme(fallbackDominant, fallbackAccent, 'dark'),
    light: deriveBrandTheme(fallbackDominant, fallbackAccent, 'light'),
    bold: deriveBrandTheme(fallbackDominant, fallbackAccent, 'bold'),
    vibrant: deriveBrandTheme(fallbackDominant, fallbackAccent, 'vibrant'),
  };

  const fallback: ExtractedPalette = {
    background: fallbackThemes.dark.backgroundColor,
    primary: fallbackThemes.dark.primaryColor,
    accent: fallbackAccent,
    swatches: ['#0F1E2E', '#172B3E', '#C28B55', '#F4F7F9'],
    dominantHex: fallbackDominant,
    accentHex: fallbackAccent,
    themes: fallbackThemes,
  };

  if (!dataUrl || typeof document === 'undefined') {
    return fallback;
  }

  return new Promise<ExtractedPalette>((resolve) => {
    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';

      const timer = setTimeout(() => {
        resolve(fallback);
      }, 1500);

      img.onload = () => {
        clearTimeout(timer);
        try {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d', { willReadFrequently: true });
          if (!ctx) {
            resolve(fallback);
            return;
          }

          const size = 64;
          canvas.width = size;
          canvas.height = size;
          ctx.drawImage(img, 0, 0, size, size);

          const imageData = ctx.getImageData(0, 0, size, size);
          const data = imageData.data;
          const colorCounts: Record<string, { count: number; r: number; g: number; b: number; saturation: number }> = {};

          for (let i = 0; i < data.length; i += 4) {
            const alpha = data[i + 3];
            // Strictly discard transparent pixels (A < 140)
            if (alpha < 140) continue;

            const rawR = data[i];
            const rawG = data[i + 1];
            const rawB = data[i + 2];

            // Strictly discard white/near-white pixels (R > 225 && G > 225 && B > 225)
            if (rawR > 225 && rawG > 225 && rawB > 225) continue;
            // Discard near-black pixels
            if (rawR < 15 && rawG < 15 && rawB < 15) continue;

            const max = Math.max(rawR, rawG, rawB);
            const min = Math.min(rawR, rawG, rawB);
            const saturation = max === 0 ? 0 : (max - min) / max;

            // Strictly discard neutral gray noise (saturation < 0.15)
            if (saturation < 0.15) continue;

            const lum = getRelativeLuminance(rawR, rawG, rawB);
            // Weight each remaining pixel by saturation * luminance balance
            const lumBalance = Math.max(0.1, 1 - Math.abs(lum - 0.45) * 1.6);
            const weight = Math.max(1, Math.round(saturation * 12 * lumBalance));

            const r = quantize(rawR);
            const g = quantize(rawG);
            const b = quantize(rawB);
            const key = `${r},${g},${b}`;

            if (!colorCounts[key]) {
              colorCounts[key] = { count: 0, r, g, b, saturation };
            }
            colorCounts[key].count += weight;
          }

          const sorted = Object.values(colorCounts).sort((a, b) => b.count - a.count);
          if (sorted.length === 0) {
            resolve(fallback);
            return;
          }

          // Dominant brand color
          const dominant = sorted[0];
          const dominantHex = rgbToHex(dominant.r, dominant.g, dominant.b);
          const dominantLum = getRelativeLuminance(dominant.r, dominant.g, dominant.b);

          // Find an accent color distinct in hue and saturation
          let accent = sorted.find((c) => {
            const lum = getRelativeLuminance(c.r, c.g, c.b);
            const dist = Math.abs(lum - dominantLum);
            return dist > 0.18 && dist < 0.85;
          });

          if (!accent && sorted.length > 1) {
            accent = sorted[1];
          }

          const accentHex = accent ? rgbToHex(accent.r, accent.g, accent.b) : '#D4AF37';

          // Swatches collection
          const swatches = sorted.slice(0, 6).map((c) => rgbToHex(c.r, c.g, c.b));
          while (swatches.length < 4) {
            swatches.push(accentHex);
          }

          const themes = {
            dark: deriveBrandTheme(dominantHex, accentHex, 'dark'),
            light: deriveBrandTheme(dominantHex, accentHex, 'light'),
            bold: deriveBrandTheme(dominantHex, accentHex, 'bold'),
            vibrant: deriveBrandTheme(dominantHex, accentHex, 'vibrant'),
          };

          resolve({
            background: themes.dark.backgroundColor,
            primary: themes.dark.primaryColor,
            accent: accentHex,
            swatches,
            dominantHex,
            accentHex,
            themes,
          });
        } catch {
          resolve(fallback);
        }
      };

      img.onerror = () => {
        clearTimeout(timer);
        resolve(fallback);
      };

      img.src = dataUrl;
    } catch {
      resolve(fallback);
    }
  });
}
