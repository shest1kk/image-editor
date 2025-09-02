/**
 * Утилиты для конвертации цветов между различными цветовыми пространствами
 * Включает поддержку RGB, XYZ, Lab, OKLch
 */

/**
 * Извлекает RGB значения из строки формата rgb(r, g, b)
 * @param {string} rgbString - Строка формата "rgb(255, 128, 64)"
 * @returns {object} - Объект {r, g, b} со значениями 0-255
 */
export function extractRGB(rgbString) {
  if (!rgbString) return { r: 0, g: 0, b: 0 };
  
  const match = rgbString.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
  if (!match) return { r: 0, g: 0, b: 0 };
  
  return {
    r: parseInt(match[1], 10),
    g: parseInt(match[2], 10),
    b: parseInt(match[3], 10)
  };
}

/**
 * Конвертирует RGB в XYZ цветовое пространство
 * @param {object} rgb - Объект {r, g, b} со значениями 0-255
 * @returns {string} - Строка формата "X: 41.24, Y: 21.26, Z: 1.93"
 */
export function rgbToXyz(rgb) {
  if (!rgb || typeof rgb !== 'object') return '';
  
  // Нормализуем RGB значения к диапазону 0-1
  let r = rgb.r / 255.0;
  let g = rgb.g / 255.0;
  let b = rgb.b / 255.0;

  // Применяем гамма-коррекцию (sRGB)
  r = r > 0.04045 ? Math.pow((r + 0.055) / 1.055, 2.4) : r / 12.92;
  g = g > 0.04045 ? Math.pow((g + 0.055) / 1.055, 2.4) : g / 12.92;
  b = b > 0.04045 ? Math.pow((b + 0.055) / 1.055, 2.4) : b / 12.92;

  // Конвертируем в XYZ используя матрицу D65
  const x = (r * 0.4124564 + g * 0.3575761 + b * 0.1804375) * 100;
  const y = (r * 0.2126729 + g * 0.7151522 + b * 0.0721750) * 100;
  const z = (r * 0.0193339 + g * 0.1191920 + b * 0.9503041) * 100;

  return `X: ${x.toFixed(2)}, Y: ${y.toFixed(2)}, Z: ${z.toFixed(2)}`;
}

/**
 * Конвертирует RGB в Lab цветовое пространство
 * @param {object} rgb - Объект {r, g, b} со значениями 0-255
 * @returns {string} - Строка формата "L: 53.23, a: 80.11, b: 67.22"
 */
export function rgbToLab(rgb) {
  if (!rgb || typeof rgb !== 'object') return '';
  
  // Сначала конвертируем в XYZ
  let r = rgb.r / 255.0;
  let g = rgb.g / 255.0;
  let b = rgb.b / 255.0;

  r = r > 0.04045 ? Math.pow((r + 0.055) / 1.055, 2.4) : r / 12.92;
  g = g > 0.04045 ? Math.pow((g + 0.055) / 1.055, 2.4) : g / 12.92;
  b = b > 0.04045 ? Math.pow((b + 0.055) / 1.055, 2.4) : b / 12.92;

  const x = (r * 0.4124564 + g * 0.3575761 + b * 0.1804375) * 100;
  const y = (r * 0.2126729 + g * 0.7151522 + b * 0.0721750) * 100;
  const z = (r * 0.0193339 + g * 0.1191920 + b * 0.9503041) * 100;

  // Нормализуем по D65 illuminant
  const xn = x / 95.047;
  const yn = y / 100.000;
  const zn = z / 108.883;

  // Применяем функцию Lab
  const fx = xn > 0.008856 ? Math.pow(xn, 1/3) : (7.787 * xn + 16/116);
  const fy = yn > 0.008856 ? Math.pow(yn, 1/3) : (7.787 * yn + 16/116);
  const fz = zn > 0.008856 ? Math.pow(zn, 1/3) : (7.787 * zn + 16/116);

  const L = 116 * fy - 16;
  const a = 500 * (fx - fy);
  const bLab = 200 * (fy - fz);

  return `L: ${L.toFixed(2)}, a: ${a.toFixed(2)}, b: ${bLab.toFixed(2)}`;
}

/**
 * Конвертирует RGB в OKLch цветовое пространство
 * @param {object} rgb - Объект {r, g, b} со значениями 0-255
 * @returns {string} - Строка формата "L: 0.628, C: 0.258, h: 29.2°"
 */
export function rgbToOKLch(rgb) {
  if (!rgb || typeof rgb !== 'object') return '';
  
  // Нормализуем RGB значения к диапазону 0-1
  let r = rgb.r / 255.0;
  let g = rgb.g / 255.0;
  let b = rgb.b / 255.0;

  // Применяем гамма-коррекцию (sRGB)
  r = r > 0.04045 ? Math.pow((r + 0.055) / 1.055, 2.4) : r / 12.92;
  g = g > 0.04045 ? Math.pow((g + 0.055) / 1.055, 2.4) : g / 12.92;
  b = b > 0.04045 ? Math.pow((b + 0.055) / 1.055, 2.4) : b / 12.92;

  // Конвертируем в linear sRGB в OKLab
  const l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b;
  const m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b;
  const s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b;

  const l_ = Math.cbrt(l);
  const m_ = Math.cbrt(m);
  const s_ = Math.cbrt(s);

  const L = 0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_;
  const a = 1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_;
  const bOK = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_;

  // Конвертируем в LCh
  const C = Math.sqrt(a * a + bOK * bOK);
  let h = Math.atan2(bOK, a) * 180 / Math.PI;
  if (h < 0) h += 360;

  return `L: ${L.toFixed(3)}, C: ${C.toFixed(3)}, h: ${h.toFixed(1)}°`;
}

/**
 * Рассчитывает контраст между двумя цветами по WCAG 2.1
 * @param {object} rgb1 - Первый цвет {r, g, b}
 * @param {object} rgb2 - Второй цвет {r, g, b}
 * @returns {string} - Строка с коэффициентом контраста и оценкой
 */
export function calculateContrast(rgb1, rgb2) {
  if (!rgb1 || !rgb2) return '';

  // Функция для расчета относительной яркости
  function getLuminance(rgb) {
    const { r, g, b } = rgb;
    
    // Нормализуем значения к диапазону 0-1
    const rs = r / 255;
    const gs = g / 255;
    const bs = b / 255;

    // Применяем гамма-коррекцию
    const rLinear = rs <= 0.03928 ? rs / 12.92 : Math.pow((rs + 0.055) / 1.055, 2.4);
    const gLinear = gs <= 0.03928 ? gs / 12.92 : Math.pow((gs + 0.055) / 1.055, 2.4);
    const bLinear = bs <= 0.03928 ? bs / 12.92 : Math.pow((bs + 0.055) / 1.055, 2.4);

    // Рассчитываем относительную яркость
    return 0.2126 * rLinear + 0.7152 * gLinear + 0.0722 * bLinear;
  }

  const lum1 = getLuminance(rgb1);
  const lum2 = getLuminance(rgb2);

  // Контраст рассчитывается как (светлый + 0.05) / (темный + 0.05)
  const lighter = Math.max(lum1, lum2);
  const darker = Math.min(lum1, lum2);
  const contrastRatio = (lighter + 0.05) / (darker + 0.05);

  // Оценка контраста по WCAG 2.1
  let assessment = '';
  if (contrastRatio >= 7) {
    assessment = ' (AAA - отличный)';
  } else if (contrastRatio >= 4.5) {
    assessment = ' (AA - хороший)';
  } else if (contrastRatio >= 3) {
    assessment = ' (AA для крупного текста)';
  } else {
    assessment = ' (⚠️ недостаточный)';
  }

  return `${contrastRatio.toFixed(2)}:1${assessment}`;
}

/**
 * Форматирует RGB цвет с учетом формата изображения
 * @param {string} rgbString - RGB строка вида "rgb(r, g, b)"
 * @param {Object} originalFormat - Объект с метаданными исходного формата
 * @returns {string} - Отформатированная строка цвета
 */
export function formatColorForDisplay(rgbString, originalFormat) {
  if (!rgbString) return '';
  
  // Для GrayBit-7 показываем исходное 7-битное значение
  if (originalFormat && originalFormat.format === 'GrayBit-7') {
    const rgb = extractRGB(rgbString);
    // Конвертируем обратно в 7-битное значение (берем среднее R/G/B, поскольку это серый цвет)
    const gray7Bit = Math.round((rgb.r / 255) * 127);
    return `${rgbString} → Gray: ${gray7Bit}/127`;
  }
  
  return rgbString;
}
