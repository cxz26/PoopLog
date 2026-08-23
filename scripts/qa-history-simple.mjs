#!/usr/bin/env node
import { chromium } from "playwright";

const VIEWPORTS = [
  { w: 320, h: 800, name: "320px" },
  { w: 1440, h: 900, name: "1440px" },
];

async function main() {
  console.log("=== History Simple QA ===");
  const browser = await chromium.launch({ headless: true });
  for (const vp of VIEWPORTS) {
    console.log(`\n--- Testing ${vp.name} ---`);
    const context = await browser.newContext({ viewport: { width: vp.w, height: vp.h } });
    const page = await context.newPage();
    try {
      await page.goto("http://localhost:1420?qa=1", { waitUntil: "domcontentloaded", timeout: 10000 });
      await page.waitForTimeout(1500);
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(500);
      const dayCardVisible = await page.getByText("2026-08-22").first().isVisible().catch(() => false);
      console.log(`  HistoryDayCard 2026-08-22: ${dayCardVisible ? "✓" : "✗"}`);
      const noBmVisible = await page.getByText("No bowel movement").first().isVisible().catch(() => false);
      console.log(`  No-BM: ${noBmVisible ? "✓" : "✗"}`);
      const emptyVisible = await page.getByText("No history yet").first().isVisible().catch(() => false);
      console.log(`  EmptyState: ${emptyVisible ? "✓" : "✗"}`);
      const overflow = await page.evaluate(() => {
        const doc = document.documentElement;
        return { scrollWidth: doc.scrollWidth, clientWidth: doc.clientWidth, hasHScroll: doc.scrollWidth > doc.clientWidth + 1 };
      });
      console.log(`  H overflow: ${!overflow.hasHScroll ? "✓" : "✗"} ${overflow.scrollWidth}/${overflow.clientWidth}`);
      const screenshotPath = `C:\\Users\\PC\\AppData\\Local\\Temp\\opencode\\qa-history-${vp.w}.png`;
      await page.screenshot({ path: screenshotPath, fullPage: true });
      console.log(`  Screenshot: ${screenshotPath}`);
      // Test delete confirm
      const deleteBtn = page.getByRole("button", { name: /Open Delete Confirm/i }).first();
      if (await deleteBtn.isVisible().catch(()=>false)) {
        await deleteBtn.click();
        await page.waitForTimeout(600);
        const dialog = page.getByRole("dialog").last();
        const dialogVisible = await dialog.isVisible().catch(()=>false);
        console.log(`  Delete confirm: ${dialogVisible ? "✓" : "✗"}`);
        if (dialogVisible) {
          const deleteConfirmBtn = page.getByRole("button", { name: /^Delete$/i }).first();
          console.log(`  Delete button in dialog: ${await deleteConfirmBtn.isVisible().catch(()=>false) ? "✓" : "✗"}`);
          await page.keyboard.press("Escape");
          await page.waitForTimeout(300);
        }
      }
      await context.close();
    } catch (e) {
      console.error(`  ✗ Exception:`, e.message);
      await context.close().catch(()=>{});
    }
  }
  await browser.close();
  console.log("\nDone");
}

main().catch((e) => { console.error(e); process.exit(1); });
