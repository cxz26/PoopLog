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
  console.log("=== History Responsive QA ===");
  const browser = await chromium.launch({ headless: true });
  const results = [];

  for (const vp of VIEWPORTS) {
    console.log(`\n--- Testing ${vp.name} (${vp.w}x${vp.h}) ---`);
    const context = await browser.newContext({ viewport: { width: vp.w, height: vp.h } });
    const page = await context.newPage();
    const errors = [];

    try {
      await page.goto("http://localhost:1420?qa=1", { waitUntil: "networkidle", timeout: 15000 });
      await page.waitForTimeout(1000);

      // Scroll to History section
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(500);

      // Check HistoryDayCard exists
      const historyCards = page.locator("text=History — day cards").first();
      // Actually check for HistoryDayCard via text "2026-08-22"
      const dayCard = page.getByText("2026-08-22").first();
      const dayVisible = await dayCard.isVisible().catch(() => false);
      console.log(`  HistoryDayCard (2026-08-22): ${dayVisible ? "✓" : "✗"}`);
      if (!dayVisible) errors.push("HistoryDayCard not visible");

      // Check that day card shows 2 bowel movements
      const bmCount = page.getByText("2 bowel movements").first();
      const bmVisible = await bmCount.isVisible().catch(() => false);
      console.log(`  Day card count (2 bowel): ${bmVisible ? "✓" : "✗"}`);
      if (!bmVisible) errors.push("History day count not visible");

      // Check No bowel movement card
      const noBmCard = page.getByText("No bowel movement").first();
      const noBmVisible = await noBmCard.isVisible().catch(() => false);
      console.log(`  No-BM card: ${noBmVisible ? "✓" : "✗"}`);
      if (!noBmVisible) errors.push("No-BM card not visible");

      // Check EmptyState
      const emptyState = page.getByText("No history yet").first();
      const emptyVisible = await emptyState.isVisible().catch(() => false);
      console.log(`  EmptyState: ${emptyVisible ? "✓" : "✗"}`);
      if (!emptyVisible) errors.push("EmptyState not visible");

      // Test detail modal
      const detailBtn = page.getByRole("button", { name: /Open Detail Modal/i }).first();
      if (await detailBtn.isVisible().catch(() => false)) {
        await detailBtn.click();
        await page.waitForTimeout(600);
        const dialog = page.getByRole("dialog").first();
        const dialogVisible = await dialog.isVisible().catch(() => false);
        console.log(`  Detail modal: ${dialogVisible ? "✓" : "✗"}`);
        if (!dialogVisible) errors.push("Detail modal not visible");
        else {
          // Check detail content
          const detailTime = page.getByText("08:15").first();
          const detailBristol = page.getByText("Type 4").first();
          console.log(`  Detail content Time/Bristol: ${await detailTime.isVisible().catch(()=>false) ? "✓" : "✗"} / ${await detailBristol.isVisible().catch(()=>false) ? "✓" : "✗"}`);
          // Check delete dialog
          const deleteBtn = page.getByRole("button", { name: /Delete/i }).first();
          if (await deleteBtn.isVisible().catch(()=>false)) {
            await deleteBtn.click();
            await page.waitForTimeout(500);
            const confirmDialog = page.getByRole("dialog").last();
            const confirmVisible = await confirmDialog.isVisible().catch(()=>false);
            console.log(`  Delete confirm dialog: ${confirmVisible ? "✓" : "✗"}`);
            if (!confirmVisible) errors.push("Delete confirm not visible");
            else {
              const confirmBtn = page.getByRole("button", { name: /^Delete$/i }).first();
              const cancelBtn = page.getByRole("button", { name: /Cancel/i }).first();
              console.log(`  Confirm buttons: Delete ${await confirmBtn.isVisible().catch(()=>false) ? "✓" : "✗"} Cancel ${await cancelBtn.isVisible().catch(()=>false) ? "✓" : "✗"}`);
              // Check dialog fits viewport
              const dialogMetrics = await page.evaluate(() => {
                const dialogs = Array.from(document.querySelectorAll('[role="dialog"]'));
                const last = dialogs[dialogs.length - 1];
                if (!last) return null;
                const rect = last.getBoundingClientRect();
                return { width: rect.width, x: rect.x, viewport: window.innerWidth };
              });
              if (dialogMetrics) {
                console.log(`  Delete dialog: width=${Math.round(dialogMetrics.width)} x=${Math.round(dialogMetrics.x)} viewport=${dialogMetrics.viewport}`);
                if (dialogMetrics.width > vp.w + 4) errors.push(`Delete dialog overflow at ${vp.name}`);
              }
              // Close confirm
              await page.keyboard.press("Escape");
              await page.waitForTimeout(300);
            }
          }
          // Close detail modal
          await page.keyboard.press("Escape");
          await page.waitForTimeout(400);
        }
      }

      // Horizontal overflow check for History section
      const overflow = await page.evaluate(() => {
        const doc = document.documentElement;
        return { scrollWidth: doc.scrollWidth, clientWidth: doc.clientWidth, hasHScroll: doc.scrollWidth > doc.clientWidth + 1 };
      });
      console.log(`  H overflow: ${!overflow.hasHScroll ? "✓" : "✗"} ${overflow.scrollWidth}/${overflow.clientWidth}`);
      if (overflow.hasHScroll) errors.push(`H overflow ${overflow.scrollWidth}>${overflow.clientWidth}`);

      // Check that no History card is clipped
      const historyCard = page.locator("text=2026-08-22").first();
      if (await historyCard.isVisible().catch(()=>false)) {
        const box = await historyCard.boundingBox().catch(()=>null);
        if (box) console.log(`  History card bbox: ${Math.round(box.width)}x${Math.round(box.height)} at ${Math.round(box.x)},${Math.round(box.y)}`);
      }

      results.push({ viewport: vp.name, ok: errors.length === 0, errors });
      if (errors.length) {
        console.log(`  Errors at ${vp.name}:`);
        errors.forEach((e) => console.log(`    - ${e}`));
      } else console.log(`  ✓ All History checks passed at ${vp.name}`);

      await context.close();
    } catch (e) {
      console.error(`  ✗ Exception at ${vp.name}:`, e.message);
      results.push({ viewport: vp.name, ok: false, errors: [String(e)] });
      await context.close().catch(() => {});
    }
  }

  await browser.close();

  console.log("\n=== HISTORY SUMMARY ===");
  for (const r of results) console.log(`${r.ok ? "✓" : "✗"} ${r.viewport}: ${r.ok ? "PASS" : "FAIL"}${r.errors.length ? " — " + r.errors.join("; ") : ""}`);
  const failed = results.filter((r) => !r.ok);
  if (failed.length) {
    console.log(`\nFAILED: ${failed.length}/${results.length}`);
    process.exitCode = 1;
  } else console.log(`\nPASS: All ${results.length} History viewports verified`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
