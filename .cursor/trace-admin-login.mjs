/**
 * TEMP: reproduce admin login → first sidebar click for PORTAL_AUTH_TRACE logs.
 */
import puppeteer from "puppeteer";

const base = process.env.BASE_URL ?? "http://localhost:3000";
const login = process.env.PORTAL_LOGIN ?? "DarwinOwner";
const password = process.env.PORTAL_PASSWORD ?? "ChangeMe123!";

const browser = await puppeteer.launch({ headless: true });
const page = await browser.newPage();

async function step(label) {
  console.log(`\n=== ${label} ===`);
  console.log("url:", page.url());
}

try {
  await page.goto(`${base}/portal/logout`, { waitUntil: "networkidle2" });
  await step("after logout");

  await page.goto(`${base}/admin/players`, { waitUntil: "networkidle2" });
  await step("unauth visit /admin/players (seed stale cache)");

  await page.goto(`${base}/portal/login`, { waitUntil: "networkidle2" });
  await page.type('input[name="login"]', login);
  await page.type('input[name="password"]', password);
  await Promise.all([
    page.waitForNavigation({ waitUntil: "networkidle2" }),
    page.click('button[type="submit"]'),
  ]);
  await step("after login submit");

  await page.waitForFunction(() => window.location.pathname.includes("/admin"), { timeout: 30000 });
  await step("landed on admin");

  const playersLink = await page.waitForSelector('a[href="/admin/players"]', { timeout: 15000 });
  await Promise.all([
    page.waitForNavigation({ waitUntil: "networkidle2" }),
    playersLink.click(),
  ]);
  await step("after first click Players");

  const onLogin = page.url().includes("/portal/login");
  console.log("bouncedToLogin:", onLogin);
} finally {
  await browser.close();
}
