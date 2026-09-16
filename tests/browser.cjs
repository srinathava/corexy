// Optional verification: requires Playwright and a local Chrome installation.
// CHROME_PATH can select a different Chromium executable. No web server is needed.
const { chromium } = require('playwright');
const { pathToFileURL } = require('node:url');
const path = require('node:path');
const { tmpdir } = require('node:os');
const assert = require('node:assert/strict');

(async () => {
  const browser = await chromium.launch({
    ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : { channel: 'chrome' }),
    headless: true,
  });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1250 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(pathToFileURL(path.resolve(__dirname, '../index.html')).href);
    const input = async (id, value) => page.locator(id).evaluate((el, v) => {
      el.value = v; el.dispatchEvent(new Event('input', { bubbles: true }));
    }, value);
    const model = () => page.evaluate(() => {
      const svg = document.querySelector('#mechanism');
      const transform = document.querySelector('#carriage').transform.baseVal.consolidate().matrix;
      const marker = document.querySelector('#markers-a circle');
      return {
        x: +svg.dataset.x, y: +svg.dataset.y,
        length: document.querySelector('#belt-a').getTotalLength(),
        markerError: Math.hypot(+marker.getAttribute('cx') - transform.e, +marker.getAttribute('cy') - transform.f),
      };
    });
    const initial = await model();
    assert.equal(await page.locator('#secondary').isDisabled(), true);
    assert.equal(await page.locator('#control-secondary').isVisible(), false);
    assert.equal(await page.locator('#animate').isVisible(), false);
    await input('#motor-a', 85);
    assert.equal((await model()).x, 85);
    assert.equal((await model()).y, 0);
    assert.ok((await model()).markerError < .04, 'Initial painted marker stays on its clamped material point');
    await page.locator('#play').click();
    await page.waitForTimeout(200);
    await page.locator('#play').click();
    const paused = await model();
    await page.waitForTimeout(100);
    assert.deepEqual(await model(), paused, 'Pause freezes the mechanism');
    await page.locator('#reset').click();
    assert.equal((await model()).x, 0);
    await page.screenshot({ path: path.join(tmpdir(), 'corexy-stage-0.png'), fullPage: true });
    for (let stage = 1; stage <= 6; stage++) {
      await page.locator('#next').click();
      if (stage === 1) await page.waitForTimeout(1250);
      assert.equal(await page.locator('#step-count').textContent(), `${stage + 1} / 7`);
      assert.equal(await page.locator('#control-secondary').isVisible(), stage >= 2);
      assert.equal(await page.locator('#animate').isVisible(), stage === 1);
      if (stage === 1) {
        for (let replay = 0; replay < 2; replay++) {
          await page.locator('#animate').click();
          assert.equal(await page.locator('#motor-a').isDisabled(), true);
          assert.equal(await page.locator('#animate').isDisabled(), true);
          await page.waitForFunction(() => !document.querySelector('#animate').disabled);
          assert.equal(await page.locator('#motor-a').isDisabled(), false);
          assert.equal((await model()).y, 0);
        }
      }
      const current = await model();
      assert.ok(Math.abs(current.length - initial.length) < .06, `Same settled belt length in stage ${stage}`);
      if (stage < 2) {
        await input('#motor-a', -100);
        assert.equal((await model()).x, -100);
        assert.equal((await model()).y, 0);
      } else if (stage < 5) {
        assert.equal(await page.locator('#motor-a').isDisabled(), stage < 4);
        for (const a of stage === 4 ? [-120, 0, 120] : [0]) {
          if (stage === 4) await input('#motor-a', a);
          for (const y of [-120, -60, 0, 60, 120]) {
            await input('#secondary', y);
            const m = await model();
            assert.ok(Math.abs(m.x + m.y - a) < 1e-8, 'Locked motor-to-clamp material length');
            assert.ok(Math.abs(m.length - initial.length) < .06, 'Inextensible closed loop');
            assert.ok(m.markerError < .05, 'Material marker stays attached while route deforms');
          }
        }
      } else {
        for (const a of [-120, 0, 120]) for (const b of [-120, 0, 120]) {
          await input('#motor-a', a); await input('#secondary', b);
          const m = await model();
          assert.equal(m.x + m.y, a);
          assert.equal(m.x - m.y, b);
          assert.ok(Math.abs(m.length - initial.length) < .06);
          assert.ok(m.markerError < .05);
        }
      }
      await page.locator('#reset').click();
      if ([1, 2, 4, 6].includes(stage)) await page.screenshot({ path: path.join(tmpdir(), `corexy-stage-${stage}.png`), fullPage: true });
    }
    // Coupling starts at the existing pose, preserving a nonzero offset.
    await input('#motor-a', 60); await input('#secondary', -20);
    const beforeMode = await model();
    await page.locator('[data-mode="x"]').click();
    await page.waitForTimeout(250);
    assert.deepEqual(await model(), beforeMode, 'Selecting a mode neither moves nor autoplays');
    await input('#motor-a', 100);
    assert.equal((await model()).y, 40);
    assert.equal(await page.locator('#secondary').inputValue(), '20');
    await input('#secondary', 60);
    assert.equal(await page.locator('#motor-a').inputValue(), '120');
    assert.equal(await page.locator('#secondary').inputValue(), '40');
    assert.equal((await model()).y, 40, 'Both sliders stop together at the upper limit');
    await input('#secondary', -120);
    assert.equal(await page.locator('#motor-a').inputValue(), '-40');
    assert.equal((await model()).y, 40);
    await page.locator('#play').click();
    await page.waitForTimeout(300);
    assert.ok(Math.abs((await model()).y - 40) < 1e-8, 'Explicit playback preserves the locked difference');
    await page.locator('#play').click();
    await page.locator('[data-mode="free"]').click();
    await input('#motor-a', 60); await input('#secondary', -20);
    const beforeY = await model();
    await page.locator('[data-mode="y"]').click();
    await page.waitForTimeout(150);
    assert.deepEqual(await model(), beforeY);
    await input('#motor-a', 100);
    assert.equal(await page.locator('#secondary').inputValue(), '-60');
    assert.equal((await model()).x, 20);
    await input('#secondary', 20);
    assert.equal(await page.locator('#motor-a').inputValue(), '20');
    await input('#secondary', 120);
    assert.equal(await page.locator('#motor-a').inputValue(), '-80');
    await input('#motor-a', 120);
    assert.equal(await page.locator('#secondary').inputValue(), '-80');
    assert.equal((await model()).x, 20, 'Opposite motion preserves the sum at both limits');
    await page.locator('#play').click();
    await page.waitForTimeout(300);
    assert.ok(Math.abs((await model()).x - 20) < 1e-8);
    await page.locator('#play').click();
    await page.locator('[data-mode="a"]').click();
    assert.equal(await page.locator('#secondary').isDisabled(), true);
    const heldB = await page.locator('#secondary').inputValue();
    await input('#motor-a', 0);
    assert.equal(await page.locator('#secondary').inputValue(), heldB);
    await page.locator('[data-mode="b"]').click();
    assert.equal(await page.locator('#motor-a').isDisabled(), true);
    await page.locator('[data-mode="free"]').click();
    assert.equal(await page.locator('#motor-a').isDisabled(), false);
    assert.equal(await page.locator('#secondary').isDisabled(), false);
    await page.locator('#reveal').click();
    assert.match(await page.locator('#equation').textContent(), /x = \(A \+ B\) \/ 2/);
    // Dragging the single-guide carriage projects onto its one remaining freedom.
    await page.locator('#back').click(); await page.locator('#back').click();
    const bounds = await page.locator('#carriage').boundingBox();
    await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
    await page.mouse.down(); await page.mouse.move(bounds.x + bounds.width / 2 + 45, bounds.y + bounds.height / 2 - 10, { steps: 5 }); await page.mouse.up();
    assert.ok(Math.abs((await model()).x + (await model()).y) < 1e-8);
    assert.notEqual((await model()).x, 0);
    // A mobile viewport must not produce page-level horizontal scrolling.
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.screenshot({ path: path.join(tmpdir(), 'corexy-mobile.png'), fullPage: true });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.waitForFunction(() => document.querySelector('#play').disabled);
    assert.equal(await page.locator('#play').isDisabled(), true);
    await input('#motor-a', 40);
    assert.equal(Math.round((await model()).x + (await model()).y), 40);
    await page.locator('#next').click(); await page.locator('#next').click();
    await page.locator('[data-mode="y"]').click();
    assert.equal((await model()).y, 0, 'Reduced-motion mode selection also preserves position');
    await input('#motor-a', 80);
    assert.equal((await model()).x, 0);
    assert.equal((await model()).y, 80);
    assert.deepEqual(errors, [], 'No browser runtime errors');
    console.log('PASS: all 7 stages, constant belt length, material tracers, motor constraints, play/pause/reset, projected dragging, linked slider modes and limits, mobile layout, reduced motion.');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
