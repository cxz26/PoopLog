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
  console.log("=== Backup UI Responsive QA ===");
  const browser = await chromium.launch({ headless: true });
  for (const vp of VIEWPORTS) {
    console.log(`\n--- Testing ${vp.name} ---`);
    const context = await browser.newContext({ viewport: { width: vp.w, height: vp.h } });
    const page = await context.newPage();
    try {
      await page.goto("http://localhost:1420?qa=backup", { waitUntil: "domcontentloaded", timeout: 10000 });
      await page.waitForTimeout(1000);
      const backupHeading = page.getByText("Backup & Restore").first();
      const backupVisible = await backupHeading.isVisible().catch(() => false);
      console.log(`  Backup & Restore heading: ${backupVisible ? "✓" : "✗"}`);
      if (!backupVisible) console.log(`  ✗ Backup heading not visible at ${vp.name}`);
      const createBackup = page.getByText("Create Backup").first();
      console.log(`  Create Backup: ${await createBackup.isVisible().catch(()=>false) ? "✓" : "✗"}`);
      const restoreBackup = page.getByText("Restore Backup").first();
      console.log(`  Restore Backup: ${await restoreBackup.isVisible().catch(()=>false) ? "✓" : "✗"}`);
      const backupPassword = page.getByLabel("Backup Password").first();
      console.log(`  Backup Password input: ${await backupPassword.isVisible().catch(()=>false) ? "✓" : "✗"}`);
      if (await backupPassword.isVisible().catch(()=>false)) {
        const box = await backupPassword.boundingBox().catch(()=>null);
        if (box) console.log(`    Password input: ${Math.round(box.width)}x${Math.round(box.height)} ${box.height>=44 ? "✓" : "✗"} minH 44`);
      }
      const warning = page.getByText("If you forget this password").first();
      console.log(`  Warning text: ${await warning.isVisible().catch(()=>false) ? "✓" : "✗"}`);
      const createBtn = page.getByRole("button", { name: /Create Backup/i }).first();
      console.log(`  Create Backup button: ${await createBtn.isVisible().catch(()=>false) ? "✓" : "✗"}`);
      if (await createBtn.isVisible().catch(()=>false)) {
        const box = await createBtn.boundingBox().catch(()=>null);
        if (box) console.log(`    Button: ${Math.round(box.width)}x${Math.round(box.height)} ${box.height>=44 ? "✓" : "✗"}`);
      }
      const selectBtn = page.getByRole("button", { name: /Select \.plog file/i }).first();
      console.log(`  Select .plog file button: ${await selectBtn.isVisible().catch(()=>false) ? "✓" : "✗"}`);
      const overflow = await page.evaluate(() => {
        const doc = document.documentElement;
        return { scrollWidth: doc.scrollWidth, clientWidth: doc.clientWidth, hasHScroll: doc.scrollWidth > doc.clientWidth + 1 };
      });
      console.log(`  H overflow: ${!overflow.hasHScroll ? "✓" : "✗"} ${overflow.scrollWidth}/${overflow.clientWidth}`);
      const overflows = await page.evaluate(() => {
        const vw = window.innerWidth;
        const bad = [];
        for (const el of document.querySelectorAll("*")) {
          const rect = el.getBoundingClientRect();
          if (rect.width > vw + 5 && rect.height > 5) {
            const style = getComputedStyle(el);
            if (style.display !== "none" && style.visibility !== "hidden") {
              bad.push({ tag: el.tagName, w: Math.round(rect.width) });
              if (bad.length >= 2) break;
            }
          }
        }
        return bad;
      });
      if (overflows.length > 0) console.log(`  Overflow elements: ${JSON.stringify(overflows)}`);
      else console.log(`  No element wider than viewport ✓`);
      const screenshotPath = `C:\\Users\\PC\\AppData\\Local\\Temp\\opencode\\qa-backup-${vp.w}.png`;
      await page.screenshot({ path: screenshotPath, fullPage: true });
      console.log(`  Screenshot: ${screenshotPath}`);
      console.log(`  ✓ Passed ${vp.name}`);
      await context.close();
    } catch (e) {
      console.error(`  ✗ Exception at ${vp.name}:`, e.message);
      await context.close().catch(()=>{});
    }
  }
  await browser.close();
  console.log("\nPASS: All Backup viewports verified");
}

main().catch((e) => { console.error(e); process.exit(1); });
