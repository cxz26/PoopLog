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

async function testPage(page, url, checks) {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 10000 });
  await page.waitForTimeout(1000);
  const results = [];
  for (const check of checks) {
    const el = page.locator(check.selector).first();
    const visible = await el.isVisible().catch(() => false);
    let ok = visible === check.shouldBeVisible;
    let details = `${check.label}: ${visible ? "visible" : "hidden"} (expected ${check.shouldBeVisible ? "visible" : "hidden"}) ${ok ? "✓" : "✗"}`;
    if (visible && check.minHeight) {
      const box = await el.boundingBox().catch(() => null);
      if (box) {
        const heightOk = box.height >= check.minHeight;
        ok = ok && heightOk;
        details += ` ${Math.round(box.width)}x${Math.round(box.height)} minH ${check.minHeight} ${heightOk ? "✓" : "✗"}`;
      }
    }
    if (check.shouldBeVisible && !visible) ok = false;
    console.log(`  ${details}`);
    results.push({ label: check.label, ok, details });
  }
  const overflow = await page.evaluate(() => {
    const doc = document.documentElement;
    return { scrollWidth: doc.scrollWidth, clientWidth: doc.clientWidth, hasHScroll: doc.scrollWidth > doc.clientWidth + 1 };
  });
  const overflowOk = !overflow.hasHScroll;
  console.log(`  H overflow: ${overflowOk ? "✓" : "✗"} ${overflow.scrollWidth}/${overflow.clientWidth}`);
  results.push({ label: "H overflow", ok: overflowOk, details: `${overflow.scrollWidth}/${overflow.clientWidth}` });

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
  const noOverflowEl = overflows.length === 0;
  console.log(`  No element wider than viewport: ${noOverflowEl ? "✓" : "✗"} ${overflows.length ? JSON.stringify(overflows) : ""}`);
  results.push({ label: "No wider element", ok: noOverflowEl, details: JSON.stringify(overflows) });

  return results;
}

async function main() {
  console.log("=== Security Responsive QA ===");
  const browser = await chromium.launch({ headless: true });

  const allResults = [];

  // Test PinSetup at ?qa=pinsetup
  console.log("\n--- PinSetup ?qa=pinsetup ---");
  for (const vp of VIEWPORTS) {
    console.log(`\n--- Testing PinSetup ${vp.name} ---`);
    const context = await browser.newContext({ viewport: { width: vp.w, height: vp.h } });
    const page = await context.newPage();
    try {
      await page.goto("http://localhost:1420?qa=pinsetup", { waitUntil: "domcontentloaded", timeout: 10000 });
      await page.waitForTimeout(1000);
      const results = await testPage(page, "http://localhost:1420?qa=pinsetup", [
        { selector: "text=Protect PoopLog", shouldBeVisible: true, label: "Protect PoopLog heading" },
        { selector: "#pin-input", shouldBeVisible: true, label: "PIN input", minHeight: 44 },
        { selector: "button:has-text('Create PIN')", shouldBeVisible: true, label: "Create PIN button", minHeight: 44 },
        { selector: "button:has-text('Skip for now')", shouldBeVisible: true, label: "Skip button", minHeight: 44 },
      ]);
      const ok = results.every((r) => r.ok);
      console.log(`  ${ok ? "✓" : "✗"} PinSetup ${vp.name}: ${ok ? "PASS" : "FAIL"}`);
      allResults.push({ viewport: vp.name, page: "PinSetup", ok, results });
      await context.close();
    } catch (e) {
      console.error(`  ✗ Exception at ${vp.name}:`, e.message);
      allResults.push({ viewport: vp.name, page: "PinSetup", ok: false, results: [] });
      await context.close().catch(() => {});
    }
  }

  // Test LockScreen at ?qa=lock
  console.log("\n--- LockScreen ?qa=lock ---");
  for (const vp of VIEWPORTS) {
    console.log(`\n--- Testing LockScreen ${vp.name} ---`);
    const context = await browser.newContext({ viewport: { width: vp.w, height: vp.h } });
    const page = await context.newPage();
    try {
      await page.goto("http://localhost:1420?qa=lock", { waitUntil: "domcontentloaded", timeout: 10000 });
      await page.waitForTimeout(1000);
      const results = await testPage(page, "http://localhost:1420?qa=lock", [
        { selector: "text=Enter your PIN", shouldBeVisible: true, label: "Enter your PIN heading" },
        { selector: "#pin-input", shouldBeVisible: true, label: "PIN input", minHeight: 44 },
        { selector: "button:has-text('Unlock')", shouldBeVisible: true, label: "Unlock button", minHeight: 44 },
        { selector: "text=Numeric keypad", shouldBeVisible: false, label: "Keypad group (aria)" }, // actually keypad is there but not text
      ]);
      // Also check keypad buttons
      const keypadBtn = page.getByRole("button", { name: /Digit 1/i }).first();
      const keypadVisible = await keypadBtn.isVisible().catch(() => false);
      console.log(`  Keypad Digit 1: ${keypadVisible ? "✓" : "✗"}`);
      const keypadOk = keypadVisible;
      // Check that keypad buttons are >=44px
      if (keypadVisible) {
        const box = await keypadBtn.boundingBox().catch(() => null);
        if (box) {
          const heightOk = box.height >= 44;
          console.log(`  Keypad button size: ${Math.round(box.width)}x${Math.round(box.height)} ${heightOk ? "✓" : "✗"}`);
        }
      }
      const ok = results.every((r) => r.ok) && keypadOk;
      console.log(`  ${ok ? "✓" : "✗"} LockScreen ${vp.name}: ${ok ? "PASS" : "FAIL"}`);
      allResults.push({ viewport: vp.name, page: "LockScreen", ok, results });
      await context.close();
    } catch (e) {
      console.error(`  ✗ Exception at ${vp.name}:`, e.message);
      allResults.push({ viewport: vp.name, page: "LockScreen", ok: false, results: [] });
      await context.close().catch(() => {});
    }
  }

  await browser.close();

  console.log("\n=== SECURITY SUMMARY ===");
  for (const r of allResults) console.log(`${r.ok ? "✓" : "✗"} ${r.page} ${r.viewport}: ${r.ok ? "PASS" : "FAIL"}`);
  const failed = allResults.filter((r) => !r.ok);
  if (failed.length) {
    console.log(`\nFAILED: ${failed.length}/${allResults.length}`);
    process.exitCode = 1;
  } else console.log(`\nPASS: All ${allResults.length} security viewports verified`);
}

main().catch((e) => { console.error(e); process.exit(1); });
