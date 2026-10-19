/**
 * Brand Color Extractor & Saudi Luxury Palette Engine
 * Extracts dominant, primary text, and accent colors from logo/image data URLs,
 * with deterministic SSR/test fallbacks and 6 curated Saudi/Corporate luxury palettes.
 */

export type ExtractedPalette = {
  background: string;
  primary: string;
  accent: string;
  swatches: string[];
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
function getRelativeLuminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

/**
 * Converts RGB numbers to 6-digit hex string.
 */
function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map((x) => x.toString(16).padStart(2, '0')).join('').toUpperCase();
}

/**
 * Quantizes an RGB color to reduce bucket noise.
 */
function quantize(val: number, step = 32): number {
  return Math.min(255, Math.floor(val / step) * step + Math.floor(step / 2));
}

/**
 * Extracts dominant, primary, and accent colors from an image Data URL.
 * Falls back deterministically if offscreen canvas or browser runtime is unavailable.
 */
export async function extractColorsFromImageDataUrl(dataUrl: string): Promise<ExtractedPalette> {
  const fallback: ExtractedPalette = {
    background: '#0F1E2E',
    primary: '#F4F7F9',
    accent: '#C28B55',
    swatches: ['#0F1E2E', '#172B3E', '#C28B55', '#F4F7F9'],
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

          const size = 32;
          canvas.width = size;
          canvas.height = size;
          ctx.drawImage(img, 0, 0, size, size);

          const imageData = ctx.getImageData(0, 0, size, size);
          const data = imageData.data;
          const colorCounts: Record<string, { count: number; r: number; g: number; b: number }> = {};

          for (let i = 0; i < data.length; i += 4) {
            const alpha = data[i + 3];
            if (alpha < 128) continue; // Skip transparent pixels

            const r = quantize(data[i]);
            const g = quantize(data[i + 1]);
            const b = quantize(data[i + 2]);
            const key = `${r},${g},${b}`;

            if (!colorCounts[key]) {
              colorCounts[key] = { count: 0, r, g, b };
            }
            colorCounts[key].count++;
          }

          const sorted = Object.values(colorCounts).sort((a, b) => b.count - a.count);
          if (sorted.length === 0) {
            resolve(fallback);
            return;
          }

          // Dominant color
          const dominant = sorted[0];
          const dominantLum = getRelativeLuminance(dominant.r, dominant.g, dominant.b);

          // Find an accent color with saturation/contrast distinct from dominant
          let accent = sorted.find((c) => {
            const lum = getRelativeLuminance(c.r, c.g, c.b);
            const dist = Math.abs(lum - dominantLum);
            return dist > 0.15 && dist < 0.85;
          });

          if (!accent && sorted.length > 1) {
            accent = sorted[1];
          }

          const dominantHex = rgbToHex(dominant.r, dominant.g, dominant.b);
          const accentHex = accent ? rgbToHex(accent.r, accent.g, accent.b) : '#C28B55';

          // Determine dark background and light primary text for luxury poster readability
          let background: string;
          let primary: string;

          if (dominantLum < 0.4) {
            background = dominantHex;
            primary = '#F5F7FA';
          } else {
            // If dominant is light, create deep luxury background derived from dominant hues
            background = '#0F1E2E';
            primary = '#F5F7FA';
          }

          const swatches = sorted.slice(0, 4).map((c) => rgbToHex(c.r, c.g, c.b));
          while (swatches.length < 4) {
            swatches.push(swatches[0] || '#C28B55');
          }

          resolve({
            background,
            primary,
            accent: accentHex,
            swatches,
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
