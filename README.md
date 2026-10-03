# EE Toolkit

[![Tests](https://github.com/LukasDragseth/ee-toolkit/actions/workflows/test.yml/badge.svg)](https://github.com/LukasDragseth/ee-toolkit/actions/workflows/test.yml)

Browser-based calculators for everyday electrical engineering work. No install, no build step: open the page and go.

**Live app:** https://lukasdragseth.github.io/ee-toolkit/

## Tools

### Resistor color code
- Pick 4 or 5 band colors and see the resistance, tolerance and the real-world range the part could measure (for example 4.7 kΩ ±5% can be 4.47 kΩ to 4.94 kΩ).
- Type a value like `4.7k` and get its color bands back, plus the nearest standard E24 value you can actually buy.

### Ohm's law and power
- Enter any two of voltage, current, resistance and power, and get the other two (V = IR, P = VI).
- Recommends a resistor power rating with a 2× safety margin, so you know when a ¼ W part will run too hot.
- Snaps the computed resistance to the nearest standard E24 value.

Inputs accept engineering suffixes the way a schematic writes them: `4.7k`, `1M`, `10m` (milli), `22u`, and `4k7`.

## How it works

```
index.html        page layout
css/style.css     styling, with light and dark themes
js/calc.js        all the math, as pure functions with no DOM code
js/app.js         connects the page to calc.js
tests/            unit tests for calc.js
```

Keeping the math in `calc.js`, separate from the UI, means every formula is unit tested on its own. The tests check known resistor values, every E24 value round-tripping through encode and decode, and every pair of inputs to Ohm's law.

## Run it locally

Any static file server works, since the app uses JavaScript modules:

```sh
npm start          # serves the folder at http://localhost:8080
npm test           # runs the unit tests (Node 18+)
```

## Roadmap

- [x] Resistor color code (both directions)
- [x] Ohm's law and power
- [ ] LED current-limiting resistor sizer
- [ ] Voltage divider designer using standard resistor values
- [ ] Series and parallel resistor/capacitor combiner

## License

MIT
