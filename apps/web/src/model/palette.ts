// A color is a hue in degrees. Every hue shares the same perceptual lightness
// and chroma; these values stay inside sRGB across the entire hue circle.
export type Color = number;
export const COLOR_LIGHTNESS = 0.79;
export const COLOR_CHROMA = 0.085;
export const DEFAULT_COLOR: Color = 50;
export const quickColors = [
  { name: 'Peach', color: DEFAULT_COLOR },
  { name: 'Lavender', color: 300 },
  { name: 'Sea blue', color: 210 },
  { name: 'Sage', color: 145 },
] as const;

export function isColor(color: unknown): color is Color {
  return (
    typeof color === 'number' &&
    Number.isFinite(color) &&
    color >= 0 &&
    color < 360
  );
}

// Convert OKLCH to sRGB at the appearance boundary, so components, previews
// and gradient stops use identical colors in every browser.
function hex(lightness: number, chroma: number, hue: Color): string {
  const angle = (hue * Math.PI) / 180;
  const a = chroma * Math.cos(angle),
    b = chroma * Math.sin(angle);
  const l = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (lightness - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const channels = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
  return (
    '#' +
    channels
      .map((channel) => {
        const value =
          channel <= 0.0031308
            ? 12.92 * channel
            : 1.055 * channel ** (1 / 2.4) - 0.055;
        return Math.round(Math.max(0, Math.min(1, value)) * 255)
          .toString(16)
          .padStart(2, '0');
      })
      .join('')
  );
}

export function colorAppearance(color: Color): { fill: string; ink: string } {
  return {
    fill: hex(COLOR_LIGHTNESS, COLOR_CHROMA, color),
    ink: hex(0.35, 0.04, color),
  };
}

export const hueGradient = `linear-gradient(to right, ${Array.from(
  { length: 73 },
  (_, index) => `${colorAppearance(index * 5).fill} ${(index / 72) * 100}%`,
).join(', ')})`;
