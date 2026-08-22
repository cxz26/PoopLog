#!/usr/bin/env node
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";

const VIEWPORTS = [
  { w: 320, h: 800, name: "320px" },
  { w: 375, h: 800, name: "375px" },
  { w: 390, h: 800, name: "390px" },
  { w: 430, h: 800, name: "430px" },
  { w: 768, h: 1024, name: "768px" },
  { w: 1024, h: 800, name: "1024px" },
  { w: 1440, h: 900, name: "1440px" },
];

async function waitForServer(url, timeout = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try {
      const res = await fetch(url);
      if (res.ok) return true;
    } catch {}
    await sleep(500);
  }
  return false;
}

async function main() {
  console.log("=== Phase 3.1 Responsive QA ===");
  console.log("Starting Vite dev server on http://localhost:1420 ...");
  const vite = spawn("npm", ["run", "dev"], {
    cwd: process.cwd(),
    shell: true,
    stdio: "pipe",
  });
  let viteOutput = "";
  vite.stdout.on("data", (d) => (viteOutput += d.toString()));
  vite.stderr.on("data", (d) => (viteOutput += d.toString()));

  const ready = await waitForServer("http://localhost:1420", 30000);
  if (!ready) {
    console.error("Vite dev server failed to start within 30s");
    console.error(viteOutput.slice(-2000));
    vite.kill();
    process.exit(1);
  }
  console.log("Vite ready");

  const browser = await chromium.launch({ headless: true });
  const results = [];

  for (const vp of VIEWPORTS) {
    console.log(`\n--- Testing ${vp.name} (${vp.w}x${vp.h}) ---`);
    const context = await browser.newContext({ viewport: { width: vp.w, height: vp.h } });
    const page = await context.newPage();
    const errors = [];

    // Listen for console errors
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });

    try {
      await page.goto("http://localhost:1420", { waitUntil: "networkidle", timeout: 15000 });
      await page.waitForTimeout(1500); // allow DB mock and render

      // Take screenshot for manual inspection (saved to temp)
      const screenshotPath = `C:\\Users\\PC\\AppData\\Local\\Temp\\opencode\\qa-${vp.w}.png`;
      await page.screenshot({ path: screenshotPath, fullPage: true });
      console.log(`  Screenshot: ${screenshotPath}`);

      // 1. YES / NO controls
      const yesBtn = page.getByRole("button", { name: /YES/i }).first();
      const noBtn = page.getByRole("button", { name: /^NO$/i }).first();
      const yesVisible = await yesBtn.isVisible().catch(() => false);
      const noVisible = await noBtn.isVisible().catch(() => false);
      const yesBox = yesVisible ? await yesBtn.boundingBox() : null;
      const noBox = noVisible ? await noBtn.boundingBox() : null;

      let yesNoOk = yesVisible && noVisible;
      let yesNoDetails = `YES visible=${yesVisible} NO visible=${noVisible}`;
      if (yesBox && noBox) {
        // Check not clipped and have touch target >=44px
        const yesTouchOk = yesBox.height >= 44 && yesBox.width >= 44;
        const noTouchOk = noBox.height >= 44 && noBox.width >= 44;
        yesNoOk = yesNoOk && yesTouchOk && noTouchOk;
        yesNoDetails += ` | YES ${Math.round(yesBox.width)}x${Math.round(yesBox.height)} NO ${Math.round(noBox.width)}x${Math.round(noBox.height)} touch>=44 ${yesTouchOk && noTouchOk}`;
        // Check side-by-side or stacked but not overlapping
        const overlap = !(yesBox.x + yesBox.width <= noBox.x || noBox.x + noBox.width <= yesBox.x || yesBox.y + yesBox.height <= noBox.y || noBox.y + noBox.height <= yesBox.y);
        // For grid-cols-2 they should be side-by-side at all widths, so overlap is bad
        if (overlap) {
          // Check if they actually overlap visually (bad)
          yesNoDetails += " | OVERLAP DETECTED";
          yesNoOk = false;
        }
      }
      console.log(`  YES/NO: ${yesNoOk ? "✓" : "✗"} ${yesNoDetails}`);
      if (!yesNoOk) errors.push("YES/NO controls issue: " + yesNoDetails);

      // 2. Horizontal overflow
      const overflow = await page.evaluate(() => {
        const doc = document.documentElement;
        return {
          scrollWidth: doc.scrollWidth,
          clientWidth: doc.clientWidth,
          bodyScrollWidth: document.body.scrollWidth,
          bodyClientWidth: document.body.clientWidth,
          hasHorizontalScroll: doc.scrollWidth > doc.clientWidth + 1,
        };
      });
      const noHOverflow = !overflow.hasHorizontalScroll;
      console.log(`  Horizontal overflow: ${noHOverflow ? "✓" : "✗"} scrollWidth=${overflow.scrollWidth} clientWidth=${overflow.clientWidth} body ${overflow.bodyScrollWidth}/${overflow.bodyClientWidth}`);
      if (!noHOverflow) errors.push(`Horizontal overflow at ${vp.name}: scrollWidth ${overflow.scrollWidth} > clientWidth ${overflow.clientWidth}`);

      // 3. Open modal via YES
      if (yesVisible) {
        await yesBtn.click();
        await page.waitForTimeout(800);
        const modal = page.getByRole("dialog").first();
        const modalVisible = await modal.isVisible().catch(() => false);
        console.log(`  Modal after YES: ${modalVisible ? "✓ visible" : "✗ not visible"}`);
        if (!modalVisible) {
          errors.push("Modal not visible after YES at " + vp.name);
        } else {
          // Check Bristol selector (7 options)
          const bristolRadios = page.getByRole("radio", { name: /Type [1-7]/ });
          const bristolCount = await bristolRadios.count();
          console.log(`  Bristol selector: ${bristolCount} options (expected 7) ${bristolCount === 7 ? "✓" : "✗"}`);
          if (bristolCount !== 7) errors.push(`Bristol count ${bristolCount} !=7 at ${vp.name}`);

          // Check Save Now and Continue Adding Details
          const saveNow = page.getByRole("button", { name: /Save Now/i }).first();
          const continueBtn = page.getByRole("button", { name: /Continue Adding Details/i }).first();
          const saveVisible = await saveNow.isVisible().catch(() => false);
          const contVisible = await continueBtn.isVisible().catch(() => false);
          console.log(`  Save Now: ${saveVisible ? "✓" : "✗"} Continue: ${contVisible ? "✓" : "✗"}`);
          if (!saveVisible || !contVisible) errors.push("Save/Continue buttons missing at " + vp.name);

          // Check modal overflow and vertical scroll
          const modalScroll = await page.evaluate(() => {
            const dialog = document.querySelector('[role="dialog"]');
            if (!dialog) return null;
            const inner = dialog.querySelector(".overflow-y-auto") || dialog;
            return {
              scrollHeight: inner.scrollHeight,
              clientHeight: inner.clientHeight,
              canScroll: inner.scrollHeight > inner.clientHeight,
              dialogWidth: dialog.getBoundingClientRect().width,
              viewportWidth: window.innerWidth,
            };
          });
          if (modalScroll) {
            console.log(`  Modal scroll: scrollHeight=${modalScroll.scrollHeight} clientHeight=${modalScroll.clientHeight} canScroll=${modalScroll.canScroll} dialogWidth=${Math.round(modalScroll.dialogWidth)}/${modalScroll.viewportWidth}`);
            // At 320px dialog should be full width (minus padding), not clipped
            if (modalScroll.dialogWidth > vp.w + 2) {
              console.log(`  ✗ Modal wider than viewport`);
              errors.push(`Modal overflow at ${vp.name}: dialog ${modalScroll.dialogWidth} > viewport ${vp.w}`);
            }
            // Vertical scroll should be possible if content tall
            // We don't fail if not scrollable at large viewport, but check that at small viewport it can scroll if needed
          }

          // Click Continue Adding Details to reveal optional
          if (contVisible) {
            await continueBtn.click();
            await page.waitForTimeout(500);
            const sleepSection = page.getByText(/Sleep/i).first();
            const waterSection = page.getByText(/Water/i).first();
            const symptomsSection = page.getByText(/Symptoms/i).first();
            const sleepVisible = await sleepSection.isVisible().catch(() => false);
            const waterVisible = await waterSection.isVisible().catch(() => false);
            console.log(`  Optional after Continue: Sleep ${sleepVisible ? "✓" : "✗"} Water ${waterVisible ? "✓" : "✗"} Symptoms ${await symptomsSection.isVisible().catch(()=>false) ? "✓" : "✗"}`);
            if (!sleepVisible || !waterVisible) errors.push("Optional sections not visible after Continue at " + vp.name);

            // Check vertical scrolling after optional revealed
            const afterScroll = await page.evaluate(() => {
              const dialog = document.querySelector('[role="dialog"]');
              const inner = dialog?.querySelector(".overflow-y-auto");
              return inner ? { scrollHeight: inner.scrollHeight, clientHeight: inner.clientHeight } : null;
            });
            if (afterScroll) {
              console.log(`  After optional: scrollHeight=${afterScroll.scrollHeight} clientHeight=${afterScroll.clientHeight}`);
            }
          }

          // Close modal for next viewport
          const closeBtn = page.getByRole("button", { name: /^Close$/i }).first();
          if (await closeBtn.isVisible().catch(() => false)) {
            await closeBtn.click();
            await page.waitForTimeout(400);
          } else {
            await page.keyboard.press("Escape");
            await page.waitForTimeout(400);
          }
        }
      }

      // 4. Check for clipping of header/footer
      const headerVisible = await page.getByText("PoopLog").first().isVisible().catch(() => false);
      console.log(`  Header visible: ${headerVisible ? "✓" : "✗"}`);
      if (!headerVisible) errors.push("Header not visible at " + vp.name);

      results.push({ viewport: vp.name, ok: errors.length === 0, errors });
      if (errors.length > 0) {
        console.log(`  Errors at ${vp.name}:`);
        errors.forEach((e) => console.log(`    - ${e}`));
      } else {
        console.log(`  ✓ All checks passed at ${vp.name}`);
      }

      await context.close();
    } catch (e) {
      console.error(`  ✗ Exception at ${vp.name}:`, e.message);
      results.push({ viewport: vp.name, ok: false, errors: [String(e)] });
      await context.close().catch(() => {});
    }
  }

  await browser.close();
  vite.kill();
  // Wait a bit for vite to exit
  await sleep(1000);

  console.log("\n=== SUMMARY ===");
  for (const r of results) {
    console.log(`${r.ok ? "✓" : "✗"} ${r.viewport}: ${r.ok ? "PASS" : "FAIL"}${r.errors.length ? " — " + r.errors.join("; ") : ""}`);
  }
  const failed = results.filter((r) => !r.ok);
  if (failed.length > 0) {
    console.log(`\nFAILED: ${failed.length}/${results.length} viewports had issues`);
    process.exitCode = 1;
  } else {
    console.log(`\nPASS: All ${results.length} viewports verified`);
  }

  // Also verify Tauri app launches (release exe)
  console.log("\n=== Tauri app launch check ===");
  try {
    const { spawn: spawn2 } = await import("node:child_process");
    const exe = "C:\\Projects\\PoopLog\\src-tauri\\target\\release\\app.exe";
    const proc = spawn2(exe, [], { detached: false });
    await sleep(3000);
    const killed = proc.kill();
    console.log(`  Tauri app.exe launched, pid=${proc.pid}, killed=${killed} ✓`);
    // Check that exe exists and is executable
    const fs = await import("node:fs");
    const stat = fs.statSync(exe);
    console.log(`  app.exe size ${stat.size} bytes ✓`);
  } catch (e) {
    console.error("  Tauri launch check failed:", e.message);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
