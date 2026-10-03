// UI wiring. All the math lives in calc.js.
import {
  DIGIT_COLORS,
  MULTIPLIER_COLORS,
  TOLERANCE_COLORS,
  decodeBands,
  encodeBands,
  formatSI,
  parseSI,
  nearestStandard,
  ohmsLaw,
  recommendPowerRating,
} from './calc.js';

// Display colors for each band.
const SWATCH = {
  black: '#1a1a1a', brown: '#7b4a2a', red: '#d32f2f', orange: '#f57c00',
  yellow: '#fbc02d', green: '#388e3c', blue: '#1976d2', violet: '#7b1fa2',
  grey: '#9e9e9e', white: '#fafafa', gold: '#c9a227', silver: '#b0b7bf',
  none: 'transparent',
};

const $ = (sel) => document.querySelector(sel);

// ---------------------------------------------------------------------------
// Tabs
// ---------------------------------------------------------------------------

document.querySelectorAll('[role="tab"]').forEach((tab) => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('[role="tab"]').forEach((t) => {
      const selected = t === tab;
      t.setAttribute('aria-selected', String(selected));
      document.getElementById(t.dataset.tab).hidden = !selected;
    });
  });
});

// ---------------------------------------------------------------------------
// Color code: bands -> value
// ---------------------------------------------------------------------------

const DEFAULT_BANDS = {
  4: ['yellow', 'violet', 'red', 'gold'], // 4.7 kΩ ±5%
  5: ['yellow', 'violet', 'black', 'brown', 'brown'], // 4.7 kΩ ±1%
};

function bandOptions(count) {
  const digitBands = count - 2;
  const options = [];
  for (let i = 0; i < digitBands; i++) options.push({ label: `Digit ${i + 1}`, colors: DIGIT_COLORS });
  options.push({ label: 'Multiplier', colors: Object.keys(MULTIPLIER_COLORS) });
  options.push({ label: 'Tolerance', colors: Object.keys(TOLERANCE_COLORS) });
  return options;
}

function buildBandSelects() {
  const count = Number($('#band-count').value);
  const container = $('#band-selects');
  container.innerHTML = '';

  bandOptions(count).forEach((band, i) => {
    const label = document.createElement('label');
    label.textContent = band.label;
    const select = document.createElement('select');
    select.className = 'band-select';
    for (const color of band.colors) {
      const opt = document.createElement('option');
      opt.value = color;
      opt.textContent = color;
      select.append(opt);
    }
    select.value = DEFAULT_BANDS[count][i];
    select.addEventListener('change', updateDecode);
    label.append(select);
    container.append(label);
  });
  updateDecode();
}

function drawResistor(bands) {
  const group = $('#band-rects');
  group.innerHTML = '';
  // Spread the value bands on the left and put tolerance apart on the right,
  // like a real resistor.
  const xs = bands.length === 4 ? [90, 120, 150, 220] : [85, 110, 135, 160, 225];
  bands.forEach((color, i) => {
    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('x', xs[i]);
    rect.setAttribute('y', 14);
    rect.setAttribute('width', 14);
    rect.setAttribute('height', 52);
    rect.setAttribute('fill', SWATCH[color]);
    group.append(rect);
  });
}

function updateDecode() {
  const bands = [...document.querySelectorAll('.band-select')].map((s) => s.value);
  drawResistor(bands);
  try {
    const r = decodeBands(bands);
    $('#decode-result').innerHTML =
      `<strong>${formatSI(r.ohms, 'Ω')}</strong> ±${r.tolerance}%` +
      `<span class="sub">Actual value can be ${formatSI(r.min, 'Ω')} to ${formatSI(r.max, 'Ω')}</span>`;
  } catch (err) {
    $('#decode-result').textContent = err.message;
  }
}

$('#band-count').addEventListener('change', () => {
  buildBandSelects();
  updateEncode();
});

// ---------------------------------------------------------------------------
// Color code: value -> bands
// ---------------------------------------------------------------------------

function swatches(bands) {
  return bands
    .map((c) => `<span><span class="swatch" style="background:${SWATCH[c]}"></span>${c}</span>`)
    .join('');
}

function updateEncode() {
  const out = $('#encode-result');
  const ohms = parseSI($('#encode-input').value);
  if (!(ohms > 0)) {
    out.textContent = 'Enter a resistance like 220, 4.7k or 1M.';
    return;
  }
  try {
    const count = Number($('#band-count').value);
    const { bands, ohms: shown } = encodeBands(ohms, count);
    const std = nearestStandard(ohms, 'E24');
    let html = `<div class="bands">${swatches(bands)}</div>`;
    if (shown !== ohms) html += `<span class="sub">Rounded to ${formatSI(shown, 'Ω')} to fit ${count} bands.</span>`;
    if (std !== shown) html += `<span class="sub">Nearest standard (E24) value: ${formatSI(std, 'Ω')}</span>`;
    out.innerHTML = html;
  } catch (err) {
    out.textContent = err.message;
  }
}

$('#encode-input').addEventListener('input', updateEncode);

// ---------------------------------------------------------------------------
// Ohm's law
// ---------------------------------------------------------------------------

const ohmInputs = [...document.querySelectorAll('[data-ohm]')];

function updateOhms() {
  const out = $('#ohm-result');
  const values = {};
  for (const input of ohmInputs) {
    const text = input.value.trim();
    values[input.dataset.ohm] = text === '' ? NaN : parseSI(text);
    input.classList.toggle('invalid', text !== '' && Number.isNaN(values[input.dataset.ohm]));
  }

  const filled = Object.values(values).filter(Number.isFinite).length;
  if (filled < 2) {
    out.textContent = 'Enter two values to solve for the rest.';
    return;
  }

  try {
    const r = ohmsLaw(values);
    const rating = recommendPowerRating(r.P);
    const ratingText = rating
      ? `Use a resistor rated ${rating >= 1 ? rating + ' W' : '1/' + 1 / rating + ' W'} or more.`
      : 'That is more power than a standard resistor handles. Use a power resistor or heatsink.';

    out.innerHTML = `
      <table>
        <tr><th>Voltage</th><td>${formatSI(r.V, 'V')}</td></tr>
        <tr><th>Current</th><td>${formatSI(r.I, 'A')}</td></tr>
        <tr><th>Resistance</th><td>${formatSI(r.R, 'Ω')}</td></tr>
        <tr><th>Power</th><td>${formatSI(r.P, 'W')}</td></tr>
      </table>
      <span class="sub">${ratingText}</span>`;
    if (Number.isFinite(r.R) && r.R > 0) {
      out.innerHTML += `<span class="sub">Nearest standard (E24) resistor: ${formatSI(nearestStandard(r.R), 'Ω')}</span>`;
    }
  } catch (err) {
    out.textContent = err.message;
  }
}

ohmInputs.forEach((input) => input.addEventListener('input', updateOhms));
$('#ohm-clear').addEventListener('click', () => {
  ohmInputs.forEach((input) => (input.value = ''));
  updateOhms();
});

// ---------------------------------------------------------------------------
// Start up
// ---------------------------------------------------------------------------

buildBandSelects();
updateEncode();
updateOhms();
