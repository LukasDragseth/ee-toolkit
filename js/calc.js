// Pure calculation functions. No DOM code lives here, so everything can be
// unit tested with Node and reused by any page in the app.

// ---------------------------------------------------------------------------
// Number formatting and parsing (engineering / SI prefixes)
// ---------------------------------------------------------------------------

const SI_PREFIXES = [
  { exp: 9, symbol: 'G' },
  { exp: 6, symbol: 'M' },
  { exp: 3, symbol: 'k' },
  { exp: 0, symbol: '' },
  { exp: -3, symbol: 'm' },
  { exp: -6, symbol: 'µ' },
  { exp: -9, symbol: 'n' },
  { exp: -12, symbol: 'p' },
];

/**
 * Format a number with an SI prefix, e.g. formatSI(4700, 'Ω') -> "4.7 kΩ".
 * Values are rounded to `digits` significant figures.
 */
export function formatSI(value, unit = '', digits = 3) {
  if (!Number.isFinite(value)) return '—';
  if (value === 0) return `0 ${unit}`.trim();

  const sign = value < 0 ? '-' : '';
  let abs = Math.abs(value);
  // Round first so values like 999.96 roll over to the next prefix (1 k).
  abs = Number(abs.toPrecision(digits));

  const prefix =
    SI_PREFIXES.find((p) => abs >= 10 ** p.exp) ?? SI_PREFIXES[SI_PREFIXES.length - 1];
  const scaled = Number((abs / 10 ** prefix.exp).toPrecision(digits));
  return `${sign}${scaled} ${prefix.symbol}${unit}`.trim();
}

const PARSE_MULTIPLIERS = {
  G: 1e9, M: 1e6, k: 1e3, K: 1e3, m: 1e-3, u: 1e-6, µ: 1e-6, n: 1e-9, p: 1e-12,
};

/**
 * Parse user input such as "4.7k", "220", "1M", "10m" or "4k7" into a number.
 * Returns NaN for anything it does not understand. Note that "m" means milli
 * and "M" means mega, just like on a schematic.
 */
export function parseSI(text) {
  const s = String(text).trim().replace(/[ΩVAW]$/i, '').trim();
  if (s === '') return NaN;

  // Schematic style: the prefix replaces the decimal point ("4k7" = 4.7k).
  const rkm = s.match(/^(\d+)([GMkKmuµnpR])(\d+)$/);
  if (rkm) {
    const mult = rkm[2] === 'R' ? 1 : PARSE_MULTIPLIERS[rkm[2]];
    return Number(`${rkm[1]}.${rkm[3]}`) * mult;
  }

  const m = s.match(/^([-+]?\d*\.?\d+(?:e[-+]?\d+)?)\s*([GMkKmuµnp]?)$/);
  if (!m) return NaN;
  return Number(m[1]) * (m[2] ? PARSE_MULTIPLIERS[m[2]] : 1);
}

// ---------------------------------------------------------------------------
// Resistor color codes
// ---------------------------------------------------------------------------

// Digit value of each color band (bands 1-2, or 1-3 on 5-band resistors).
export const DIGIT_COLORS = [
  'black', 'brown', 'red', 'orange', 'yellow',
  'green', 'blue', 'violet', 'grey', 'white',
];

// Power-of-ten for the multiplier band. Gold and silver divide.
export const MULTIPLIER_COLORS = {
  black: 0, brown: 1, red: 2, orange: 3, yellow: 4,
  green: 5, blue: 6, violet: 7, grey: 8, white: 9,
  gold: -1, silver: -2,
};

// Tolerance band, in percent.
export const TOLERANCE_COLORS = {
  brown: 1, red: 2, green: 0.5, blue: 0.25,
  violet: 0.1, grey: 0.05, gold: 5, silver: 10, none: 20,
};

/**
 * Decode a list of band colors into a resistance.
 * Accepts 4 bands (digit, digit, multiplier, tolerance) or
 * 5 bands (digit, digit, digit, multiplier, tolerance).
 */
export function decodeBands(bands) {
  if (bands.length !== 4 && bands.length !== 5) {
    throw new Error('A resistor has 4 or 5 bands');
  }
  const digitBands = bands.slice(0, bands.length - 2);
  const [multiplierBand, toleranceBand] = bands.slice(-2);

  let digits = 0;
  for (const color of digitBands) {
    const d = DIGIT_COLORS.indexOf(color);
    if (d === -1) throw new Error(`"${color}" is not a valid digit color`);
    digits = digits * 10 + d;
  }

  const exp = MULTIPLIER_COLORS[multiplierBand];
  if (exp === undefined) throw new Error(`"${multiplierBand}" is not a valid multiplier color`);

  const tolerance = TOLERANCE_COLORS[toleranceBand];
  if (tolerance === undefined) throw new Error(`"${toleranceBand}" is not a valid tolerance color`);

  // Round away floating point noise from 10 ** -2 etc.
  const ohms = Number((digits * 10 ** exp).toPrecision(12));
  return {
    ohms,
    tolerance,
    min: ohms * (1 - tolerance / 100),
    max: ohms * (1 + tolerance / 100),
  };
}

/**
 * Turn a resistance into its color bands (the reverse of decodeBands).
 * The value is rounded to 2 significant digits for 4 bands or 3 for 5 bands.
 */
export function encodeBands(ohms, bandCount = 4, toleranceColor = bandCount === 4 ? 'gold' : 'brown') {
  if (!(ohms > 0)) throw new Error('Resistance must be greater than zero');
  const sig = bandCount - 2;

  // Pick the exponent so the digits form a whole number with `sig` digits.
  let exp = Math.floor(Math.log10(ohms)) - (sig - 1);
  let digits = Math.round(ohms / 10 ** exp);
  if (digits >= 10 ** sig) {
    // Rounding pushed us to an extra digit (e.g. 9.96 -> 100), shift once.
    digits = Math.round(digits / 10);
    exp += 1;
  }

  if (exp < -2 || exp > 9) {
    throw new Error('Value is outside the range a color code can show (0.1 Ω to 999 GΩ)');
  }

  const multiplierColor = Object.keys(MULTIPLIER_COLORS).find((c) => MULTIPLIER_COLORS[c] === exp);
  const digitColors = String(digits).padStart(sig, '0').split('').map((d) => DIGIT_COLORS[Number(d)]);

  return {
    bands: [...digitColors, multiplierColor, toleranceColor],
    ohms: Number((digits * 10 ** exp).toPrecision(12)),
  };
}

// ---------------------------------------------------------------------------
// Standard (E-series) resistor values
// ---------------------------------------------------------------------------

export const E_SERIES = {
  E12: [1.0, 1.2, 1.5, 1.8, 2.2, 2.7, 3.3, 3.9, 4.7, 5.6, 6.8, 8.2],
  E24: [
    1.0, 1.1, 1.2, 1.3, 1.5, 1.6, 1.8, 2.0, 2.2, 2.4, 2.7, 3.0,
    3.3, 3.6, 3.9, 4.3, 4.7, 5.1, 5.6, 6.2, 6.8, 7.5, 8.2, 9.1,
  ],
};

/**
 * Find the closest standard resistor value you can actually buy.
 * Closeness is measured as a ratio, which is how tolerances work.
 */
export function nearestStandard(ohms, series = 'E24') {
  if (!(ohms > 0)) throw new Error('Resistance must be greater than zero');
  const decade = 10 ** Math.floor(Math.log10(ohms));
  // Check this decade plus the first value of the next one (e.g. 9.7k -> 10k).
  const candidates = [...E_SERIES[series].map((v) => v * decade), 10 * decade];

  let best = candidates[0];
  for (const c of candidates) {
    if (Math.abs(Math.log(c / ohms)) < Math.abs(Math.log(best / ohms))) best = c;
  }
  return Number(best.toPrecision(3));
}

// ---------------------------------------------------------------------------
// Ohm's law and power
// ---------------------------------------------------------------------------

/**
 * Given any two of voltage (V), current (I), resistance (R) and power (P),
 * compute the other two. Pass the unknowns as undefined or NaN.
 *
 *   V = I * R      P = V * I = I² * R = V² / R
 */
export function ohmsLaw({ V, I, R, P }) {
  const known = (x) => Number.isFinite(x);
  const count = [V, I, R, P].filter(known).length;
  if (count !== 2) throw new Error('Enter exactly two values');
  if (known(R) && R <= 0) throw new Error('Resistance must be greater than zero');
  if (known(P) && P < 0) throw new Error('Power cannot be negative');

  if (known(V) && known(I)) return { V, I, R: V / I, P: V * I };
  if (known(V) && known(R)) return { V, I: V / R, R, P: (V * V) / R };
  if (known(V) && known(P)) return { V, I: P / V, R: (V * V) / P, P };
  if (known(I) && known(R)) return { V: I * R, I, R, P: I * I * R };
  if (known(I) && known(P)) return { V: P / I, I, R: P / (I * I), P };
  // R and P known. Current direction can't be recovered, so assume positive.
  const I2 = Math.sqrt(P / R);
  return { V: I2 * R, I: I2, R, P };
}

// Common through-hole resistor power ratings, in watts.
export const POWER_RATINGS = [0.125, 0.25, 0.5, 1, 2, 3, 5, 10];

/**
 * Recommend a resistor power rating. The usual rule of thumb is to keep a
 * resistor at or below half its rating so it runs cool and lasts.
 * Returns null if even the largest rating here is too small.
 */
export function recommendPowerRating(watts, safetyFactor = 2) {
  const needed = Math.abs(watts) * safetyFactor;
  return POWER_RATINGS.find((r) => r >= needed) ?? null;
}
