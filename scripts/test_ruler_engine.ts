import {
  mmToScreenPx,
  screenPxToMm,
  inchToScreenPx,
  screenPxToInch,
  getTickIntervalConfig,
  getVisibleRulerTicks,
  formatRulerLabel,
  BASE_PX_PER_MM,
} from '../src/services/rulerEngine';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ Assertion Failed: ${message}`);
    process.exit(1);
  }
  console.log(`✅ Passed: ${message}`);
}

console.log('--- RUNNING RULER ENGINE TESTS ---');

// 1. Basic 100% zoom conversion
const px0 = mmToScreenPx(0, 1.0, 400);
assert(px0 === 400, 'Origin 0mm at panX=400 maps to screen 400px');

const mm0 = screenPxToMm(400, 1.0, 400);
assert(Math.abs(mm0 - 0) < 1e-6, 'Screen 400px at panX=400 maps to 0mm');

// 2. Physical 100mm document measurement at 100% zoom
const px100 = mmToScreenPx(100, 1.0, 0);
const expected100 = 100 * BASE_PX_PER_MM;
assert(Math.abs(px100 - expected100) < 1e-4, '100mm at 100% zoom is approx 377.95px');

// 3. Round-trip conversion accuracy
const testMms = [-50, -10.5, 0, 0.1, 5, 10, 25.4, 50, 100, 150];
for (const mm of testMms) {
  const px = mmToScreenPx(mm, 1.5, 250);
  const backMm = screenPxToMm(px, 1.5, 250);
  assert(Math.abs(mm - backMm) < 1e-6, `Round-trip for ${mm}mm at 150% zoom is exact`);
}

// 4. Negative coordinates outside document origin
const negMm = screenPxToMm(200, 1.0, 400);
assert(Math.abs(negMm - (-200 / BASE_PX_PER_MM)) < 1e-6, 'Screen 200px (left of 400px origin) is negative mm');
assert(negMm < 0, 'Left of document origin is strictly negative');

// 5. Zoom doubling
const pxAt1 = mmToScreenPx(50, 1.0, 0);
const pxAt2 = mmToScreenPx(50, 2.0, 0);
assert(Math.abs(pxAt2 - pxAt1 * 2) < 1e-6, 'At 200% zoom, screen pixel distance doubles exactly');

// 6. Dynamic intervals check
const zoom1Interval = getTickIntervalConfig('mm', 1.0);
assert(zoom1Interval.majorStep === 20 || zoom1Interval.majorStep === 10 || zoom1Interval.majorStep === 50, `100% zoom major step is sensible: ${zoom1Interval.majorStep}mm`);

const zoom4Interval = getTickIntervalConfig('mm', 4.0);
assert(zoom4Interval.majorStep < zoom1Interval.majorStep, 'At high zoom (400%), major step is smaller/denser');

const zoom025Interval = getTickIntervalConfig('mm', 0.25);
assert(zoom025Interval.majorStep > zoom1Interval.majorStep, 'At low zoom (25%), major step is larger');

// 7. Visible ticks generation
const visibleTicks = getVisibleRulerTicks({
  viewportLengthPx: 800,
  panOffset: 200,
  zoom: 1.0,
  unit: 'mm',
  docDimensionMm: 100,
});

assert(visibleTicks.length > 0, 'Generates visible ticks');
const originTick = visibleTicks.find(t => t.isOrigin);
assert(originTick !== undefined, 'Origin 0 tick exists');
assert(Math.abs(originTick!.screenPos - 200) < 1, 'Origin tick is exactly at panOffset (200px)');

const docEndTick = visibleTicks.find(t => Math.abs(t.unitValue - 100) < 1e-5);
assert(docEndTick !== undefined, '100mm document end tick exists');
const expectedDocEndPx = 200 + 100 * BASE_PX_PER_MM;
assert(Math.abs(docEndTick!.screenPos - expectedDocEndPx) < 1, '100mm tick aligns with document edge');

console.log('🎉 ALL RULER ENGINE TESTS PASSED SUCCESSFULLY!');
