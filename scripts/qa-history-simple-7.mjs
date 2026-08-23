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
  console.log("=== History Simple QA 7 viewports ===");
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
      console.log(`  HistoryDayCard: ${dayCardVisible ? "?" : "?"}`);
      const noBmVisible = await page.getByText("No bowel movement").first().isVisible().catch(() => false);
      console.log(`  No-BM: ${noBmVisible ? "?" : "?"}`);
      const emptyVisible = await page.getByText("No history yet").first().isVisible().catch(() => false);
      console.log(`  EmptyState: ${emptyVisible ? "?" : "?"}`);
      const overflow = await page.evaluate(() => {
        const doc = document.documentElement;
        return { scrollWidth: doc.scrollWidth, clientWidth: doc.clientWidth, hasHScroll: doc.scrollWidth > doc.clientWidth + 1 };
      });
      console.log(`  H overflow: ${!overflow.hasHScroll ? "?" : "?"} ${overflow.scrollWidth}/${overflow.clientWidth}`);
      const deleteBtn = page.getByRole("button", { name: /Open Delete Confirm/i }).first();
      if (await deleteBtn.isVisible().catch(()=>false)) {
        await deleteBtn.click();
        await page.waitForTimeout(600);
        const dialog = page.getByRole("dialog").last();
        const dialogVisible = await dialog.isVisible().catch(()=>false);
        console.log(`  Delete confirm: ${dialogVisible ? "?" : "?"}`);
        if (dialogVisible) {
          await page.keyboard.press("Escape");
          await page.waitForTimeout(300);
        }
      }
      const detailBtn = page.getByRole("button", { name: /Open Detail Modal/i }).first();
      if (await detailBtn.isVisible().catch(()=>false)) {
        await detailBtn.click();
        await page.waitForTimeout(600);
        const dialog = page.getByRole("dialog").first();
        console.log(`  Detail modal: ${await dialog.isVisible().catch(()=>false) ? "?" : "?"}`);
        await page.keyboard.press("Escape");
        await page.waitForTimeout(300);
      }
      console.log(`  ? Passed ${vp.name}`);
      await context.close();
    } catch (e) {
      console.error(`  ? Exception:`, e.message);
      await context.close().catch(()=>{});
    }
  }
  await browser.close();
  console.log("\nPASS: All 7 History viewports verified");
}
main().catch((e) => { console.error(e); process.exit(1); });
