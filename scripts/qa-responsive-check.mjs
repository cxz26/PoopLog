#!/usr/bin/env node
import { chromium } from "playwright";

const VIEWPORTS = [
  { w: 320, h: 800, name: "320px" },
  { w: 375, h: 800, name: "375px" },
  { w: 390, h: 800, name: "390px" },
  { w: 430, h: 800, name: "430px" },
  { w: 768, h: 1024, name: "768px" },
  { w: 1024, h: 800, name: "1024px" },
  { w: 1440, h: 900, name: "1440px" },
];

async function main() {
  console.log("=== Phase 3.1 Responsive QA (no spawn) ===");
  const browser = await chromium.launch({ headless: true });
  const results = [];

  for (const vp of VIEWPORTS) {
    console.log(`\n--- Testing ${vp.name} (${vp.w}x${vp.h}) ---`);
    const context = await browser.newContext({ viewport: { width: vp.w, height: vp.h } });
    const page = await context.newPage();
    const errors = [];

    try {
      await page.goto("http://localhost:1420", { waitUntil: "networkidle", timeout: 15000 });
      await page.waitForTimeout(1500);

      const screenshotPath = `C:\\Users\\PC\\AppData\\Local\\Temp\\opencode\\qa-${vp.w}.png`;
      await page.screenshot({ path: screenshotPath, fullPage: true });
      console.log(`  Screenshot: ${screenshotPath}`);

      const yesBtn = page.getByRole("button", { name: /YES/i }).first();
      const noBtn = page.getByRole("button", { name: /^NO$/i }).first();
      const yesVisible = await yesBtn.isVisible().catch(() => false);
      const noVisible = await noBtn.isVisible().catch(() => false);
      const yesBox = yesVisible ? await yesBtn.boundingBox() : null;
      const noBox = noVisible ? await noBtn.boundingBox() : null;

      let yesNoOk = yesVisible && noVisible;
      let details = `YES=${yesVisible} NO=${noVisible}`;
      if (yesBox && noBox) {
        const yesTouchOk = yesBox.height >= 44 && yesBox.width >= 44;
        const noTouchOk = noBox.height >= 44 && noBox.width >= 44;
        yesNoOk = yesNoOk && yesTouchOk && noTouchOk;
        details += ` | YES ${Math.round(yesBox.width)}x${Math.round(yesBox.height)} NO ${Math.round(noBox.width)}x${Math.round(noBox.height)} touch>=44 ${yesTouchOk && noTouchOk}`;
        const overlap = !(yesBox.x + yesBox.width <= noBox.x || noBox.x + noBox.width <= yesBox.x || yesBox.y + yesBox.height <= noBox.y || noBox.y + noBox.height <= yesBox.y);
        if (overlap) {
          details += " | OVERLAP";
          yesNoOk = false;
        }
      }
      console.log(`  YES/NO: ${yesNoOk ? "✓" : "✗"} ${details}`);
      if (!yesNoOk) errors.push("YES/NO: " + details);

      const overflow = await page.evaluate(() => {
        const doc = document.documentElement;
        return {
          scrollWidth: doc.scrollWidth,
          clientWidth: doc.clientWidth,
          hasHorizontalScroll: doc.scrollWidth > doc.clientWidth + 1,
        };
      });
      const noHOverflow = !overflow.hasHorizontalScroll;
      console.log(`  Horizontal overflow: ${noHOverflow ? "✓" : "✗"} ${overflow.scrollWidth}/${overflow.clientWidth}`);
      if (!noHOverflow) errors.push(`H overflow ${overflow.scrollWidth}>${overflow.clientWidth}`);

      if (yesVisible) {
        await yesBtn.click();
        await page.waitForTimeout(800);
        const modal = page.getByRole("dialog").first();
        const modalVisible = await modal.isVisible().catch(() => false);
        console.log(`  Modal after YES: ${modalVisible ? "✓" : "✗"}`);
        if (!modalVisible) errors.push("Modal not visible");
        else {
          const bristolRadios = page.getByRole("radio", { name: /Type [1-7]/ });
          const bristolCount = await bristolRadios.count();
          console.log(`  Bristol: ${bristolCount} (expected 7) ${bristolCount === 7 ? "✓" : "✗"}`);
          if (bristolCount !== 7) errors.push(`Bristol ${bristolCount} !=7`);

          const saveNow = page.getByRole("button", { name: /Save Now/i }).first();
          const contBtn = page.getByRole("button", { name: /Continue Adding Details/i }).first();
          const saveVisible = await saveNow.isVisible().catch(() => false);
          const contVisible = await contBtn.isVisible().catch(() => false);
          console.log(`  Save Now: ${saveVisible ? "✓" : "✗"} Continue: ${contVisible ? "✓" : "✗"}`);
          if (!saveVisible || !contVisible) errors.push("Save/Continue missing");

          const modalScroll = await page.evaluate(() => {
            const dialog = document.querySelector('[role="dialog"]');
            if (!dialog) return null;
            const inner = dialog.querySelector(".overflow-y-auto") || dialog;
            return {
              scrollHeight: inner.scrollHeight,
              clientHeight: inner.clientHeight,
              dialogWidth: dialog.getBoundingClientRect().width,
              viewportWidth: window.innerWidth,
            };
          });
          if (modalScroll) {
            console.log(`  Modal: scrollHeight=${modalScroll.scrollHeight} clientHeight=${modalScroll.clientHeight} dialogWidth=${Math.round(modalScroll.dialogWidth)}/${modalScroll.viewportWidth}`);
            if (modalScroll.dialogWidth > vp.w + 2) {
              errors.push(`Modal wider than viewport ${Math.round(modalScroll.dialogWidth)}>${vp.w}`);
            }
          }

          if (contVisible) {
            await contBtn.click();
            await page.waitForTimeout(500);
            const sleepVisible = await page.getByText(/Sleep/i).first().isVisible().catch(() => false);
            const waterVisible = await page.getByText(/Water/i).first().isVisible().catch(() => false);
            console.log(`  Optional after Continue: Sleep ${sleepVisible ? "✓" : "✗"} Water ${waterVisible ? "✓" : "✗"}`);
            if (!sleepVisible || !waterVisible) errors.push("Optional not visible");
          }

          const closeBtn = page.getByRole("button", { name: /^Close$/i }).first();
          if (await closeBtn.isVisible().catch(() => false)) {
            await closeBtn.click();
          } else {
            await page.keyboard.press("Escape");
          }
          await page.waitForTimeout(400);
        }
      }

      const headerVisible = await page.getByText("PoopLog").first().isVisible().catch(() => false);
      console.log(`  Header: ${headerVisible ? "✓" : "✗"}`);
      if (!headerVisible) errors.push("Header not visible");

      results.push({ viewport: vp.name, ok: errors.length === 0, errors });
      if (errors.length) {
        console.log(`  Errors at ${vp.name}:`);
        errors.forEach((e) => console.log(`    - ${e}`));
      } else console.log(`  ✓ All checks passed at ${vp.name}`);

      await context.close();
    } catch (e) {
      console.error(`  ✗ Exception at ${vp.name}:`, e.message);
      results.push({ viewport: vp.name, ok: false, errors: [String(e)] });
      await context.close().catch(() => {});
    }
  }

  await browser.close();

  console.log("\n=== SUMMARY ===");
  for (const r of results) console.log(`${r.ok ? "✓" : "✗"} ${r.viewport}: ${r.ok ? "PASS" : "FAIL"}${r.errors.length ? " — " + r.errors.join("; ") : ""}`);
  const failed = results.filter((r) => !r.ok);
  if (failed.length) {
    console.log(`\nFAILED: ${failed.length}/${results.length}`);
    process.exitCode = 1;
  } else console.log(`\nPASS: All ${results.length} viewports verified`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
