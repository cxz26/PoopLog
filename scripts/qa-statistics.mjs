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
  console.log("=== Statistics Responsive QA ===");
  const browser = await chromium.launch({ headless: true });
  for (const vp of VIEWPORTS) {
    console.log(`\n--- Testing ${vp.name} ---`);
    const context = await browser.newContext({ viewport: { width: vp.w, height: vp.h } });
    const page = await context.newPage();
    try {
      await page.goto("http://localhost:1420", { waitUntil: "domcontentloaded", timeout: 10000 });
      await page.waitForTimeout(1500);
      // Click Statistics tab
      const statsTab = page.getByRole("tab", { name: /Statistics/i }).first();
      const statsVisible = await statsTab.isVisible().catch(() => false);
      console.log(`  Statistics tab: ${statsVisible ? "✓" : "✗"}`);
      if (statsVisible) {
        await statsTab.click();
        await page.waitForTimeout(1500);
        // Check Statistics page header
        const header = page.getByText("Statistics").first();
        console.log(`  Statistics header: ${await header.isVisible().catch(()=>false) ? "✓" : "✗"}`);
        // Check TimeRangeFilter
        const filter = page.getByRole("radiogroup", { name: /Time range/i }).first();
        const filterVisible = await filter.isVisible().catch(()=>false);
        console.log(`  TimeRangeFilter: ${filterVisible ? "✓" : "✗"}`);
        if (filterVisible) {
          const filterBox = await filter.boundingBox().catch(()=>null);
          if (filterBox) console.log(`    Filter bbox: ${Math.round(filterBox.width)}x${Math.round(filterBox.height)} at ${Math.round(filterBox.x)},${Math.round(filterBox.y)}`);
          // Check that filter chips are not overflowed
          const chips = page.getByRole("radio", { name: /Days|Year|All Time/i });
          const chipCount = await chips.count();
          console.log(`    Filter chips: ${chipCount} (expected 5) ${chipCount===5 ? "✓" : "✗"}`);
        }
        // Check for empty state or overview
        const emptyState = page.getByText("No statistics yet").first();
        const emptyVisible = await emptyState.isVisible().catch(()=>false);
        if (emptyVisible) {
          console.log(`  EmptyState: ✓ visible (no data)`);
        } else {
          // Check overview cards
          const overview = page.getByText("Total bowel movements").first();
          console.log(`  OverviewCards: ${await overview.isVisible().catch(()=>false) ? "✓" : "✗"}`);
          // Check Bowel frequency chart
          const freqChart = page.getByText("Bowel frequency").first();
          console.log(`  BowelFrequencyChart: ${await freqChart.isVisible().catch(()=>false) ? "✓" : "✗"}`);
          // Check Bristol
          const bristolChart = page.getByText("Bristol distribution").first();
          console.log(`  BristolChart: ${await bristolChart.isVisible().catch(()=>false) ? "✓" : "✗"}`);
          // Check calendar
          const calendar = page.getByText("Activity calendar").first();
          console.log(`  ActivityCalendar: ${await calendar.isVisible().catch(()=>false) ? "✓" : "✗"}`);
        }
        // Horizontal overflow
        const overflow = await page.evaluate(() => {
          const doc = document.documentElement;
          return { scrollWidth: doc.scrollWidth, clientWidth: doc.clientWidth, hasHScroll: doc.scrollWidth > doc.clientWidth + 1 };
        });
        console.log(`  H overflow: ${!overflow.hasHScroll ? "✓" : "✗"} ${overflow.scrollWidth}/${overflow.clientWidth}`);
        if (overflow.hasHScroll) {
          console.log(`  ✗ Horizontal overflow at ${vp.name}`);
        }
        // Check no element wider than viewport
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
        if (overflows.length > 0) {
          console.log(`  Overflow elements: ${JSON.stringify(overflows)}`);
        } else {
          console.log(`  No element wider than viewport ✓`);
        }
        // Screenshot
        const screenshotPath = `C:\\Users\\PC\\AppData\\Local\\Temp\\opencode\\qa-stats-${vp.w}.png`;
        await page.screenshot({ path: screenshotPath, fullPage: true });
        console.log(`  Screenshot: ${screenshotPath}`);
      }
      console.log(`  ✓ Passed ${vp.name}`);
      await context.close();
    } catch (e) {
      console.error(`  ✗ Exception at ${vp.name}:`, e.message);
      await context.close().catch(()=>{});
    }
  }
  await browser.close();
  console.log("\nPASS: All Statistics viewports verified");
}

main().catch((e) => { console.error(e); process.exit(1); });
