import { describe, expect, it } from 'vitest';
import { colorAppearance, isColor, quickColors } from './palette';
import { assertDocument, emptyDocument } from './document';

function linearChannels(hex: string) {
  return [1, 3, 5].map((index) => {
    const channel = parseInt(hex.slice(index, index + 2), 16) / 255;
    return channel <= 0.04045
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4;
  });
}
function luminance(hex: string) {
  const [r, g, b] = linearChannels(hex);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

describe('continuous muted colors', () => {
  it('retains perceptual lightness and chroma throughout the full sRGB hue circle with readable ink', () => {
    for (let hue = 0; hue < 360; hue += 0.5) {
      const { fill, ink } = colorAppearance(hue);
      const [r, g, b] = linearChannels(fill);
      const l = Math.cbrt(
        0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b,
      );
      const m = Math.cbrt(
        0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b,
      );
      const s = Math.cbrt(
        0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b,
      );
      const lightness = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
      const a = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
      const bb = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
      expect(Math.abs(lightness - 0.79)).toBeLessThan(0.002);
      expect(Math.abs(Math.hypot(a, bb) - 0.085)).toBeLessThan(0.002);
      expect(
        (luminance(fill) + 0.05) / (luminance(ink) + 0.05),
      ).toBeGreaterThan(4.5);
    }
  });

  it('accepts non-preset fractional hues and distinct presets from the same range', () => {
    const doc = emptyDocument();
    expect(() =>
      assertDocument({
        ...doc,
        sections: [{ ...doc.sections[0], color: 87.4 }],
      }),
    ).not.toThrow();
    expect(
      new Set(quickColors.map(({ color }) => colorAppearance(color).fill)).size,
    ).toBe(4);
    expect(colorAppearance(87.4).fill).not.toBe(colorAppearance(90).fill);
    expect(colorAppearance(0)).toEqual(colorAppearance(360));
  });

  it.each([NaN, Infinity, -Infinity, -0.1, 360, 400, 'apricot', null])(
    'rejects invalid hue %s',
    (value) => {
      expect(isColor(value)).toBe(false);
    },
  );

  it.each([NaN, Infinity, -1, 360])(
    'rejects invalid document hue %s',
    (color) => {
      const doc = emptyDocument();
      expect(() =>
        assertDocument({ ...doc, sections: [{ ...doc.sections[0], color }] }),
      ).toThrow('Invalid color');
    },
  );
});
