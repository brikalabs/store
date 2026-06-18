import { chromium } from "@playwright/test";

const URL = "http://localhost:3000/plugins/@brika/plugin-clock?tab=supply-chain";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
await page.goto(URL, { waitUntil: "networkidle" });

// Click the README.md file row in the tree.
await page.getByText("README.md", { exact: true }).first().click();
await page.waitForTimeout(1200);

const info = await page.evaluate(() => {
  const content = document.querySelector('[data-slot="code-block-content"]');
  const header = document.querySelector('[data-slot="code-block-header"]');
  const gutter = content?.firstElementChild;
  const wrapper = content?.parentElement;
  const code = document.querySelector('[data-slot="code-block-code"]');
  const grab = (el) => {
    if (!el) return null;
    const s = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    return {
      bg: s.backgroundColor,
      bgImage: s.backgroundImage,
      pos: s.position,
      rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
    };
  };
  return {
    header: grab(header),
    wrapper: grab(wrapper),
    content: grab(content),
    gutter: grab(gutter),
    code: grab(code),
  };
});
console.log(JSON.stringify(info, null, 2));

// Screenshot just the file-browser card.
const card = page.locator("section:has-text('Files') >> div.rounded-xl").first();
await card.screenshot({ path: "e2e/viewer-shot.png" });
await browser.close();
