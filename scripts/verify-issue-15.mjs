/**
 * Headed Playwright verification for issue #15:
 * "Sender sees own messages twice (optimistic append + NATS echo)"
 *
 * Steps:
 * 1. Open Alice's window — settings panel: name=Alice, topic=chat, connect.
 * 2. Open Bob's window   — settings panel: name=Bob,   topic=chat, connect.
 * 3. Alice types "Hello from Alice" and sends.
 * 4. Verify Alice sees the message exactly ONCE.
 * 5. Verify Bob sees the message exactly ONCE.
 */

import { chromium } from "playwright";

const APP_URL = "http://localhost:5173";
const TIMEOUT = 8000;

const browser = await chromium.launch({ headless: false, slowMo: 400 });

async function openChatWindow(name, topic) {
  const page = await browser.newPage();
  await page.setViewportSize({ width: 600, height: 700 });
  await page.goto(APP_URL);

  // Wait for the settings panel to appear (has a Name label or input)
  await page.waitForLoadState("networkidle");

  // Clear and set the name field (first input)
  const inputs = page.locator("input");
  await inputs.first().fill(name);

  // Clear and set the topic field (second input)
  await inputs.nth(1).fill(topic);

  // Click Connect
  await page.getByRole("button", { name: /connect/i }).click();

  // Wait for the chat send button to appear
  await page.getByRole("button", { name: /send/i }).waitFor({ timeout: TIMEOUT });
  console.log(`  ${name} connected.`);

  return page;
}

console.log("Opening Alice's window...");
const alice = await openChatWindow("Alice", "chat");

console.log("Opening Bob's window...");
const bob = await openChatWindow("Bob", "chat");

// Give NATS subscriptions time to settle
await alice.waitForTimeout(800);

const MSG = "Hello from Alice";

console.log(`Alice sends "${MSG}"...`);
const aliceInput = alice.getByPlaceholder(/message/i);
await aliceInput.fill(MSG);
await aliceInput.press("Enter");

// Wait up to TIMEOUT for Bob to see at least one copy
console.log("Waiting for Bob to receive the message...");
await bob.locator("p").filter({ hasText: MSG }).first().waitFor({ timeout: TIMEOUT });

// Short pause to let any duplicates arrive
await alice.waitForTimeout(1000);

// Count message paragraphs containing the text in each window
const aliceCount = await alice.locator("p").filter({ hasText: MSG }).count();
const bobCount = await bob.locator("p").filter({ hasText: MSG }).count();

console.log(`\n=== Results ===`);
console.log(`Alice sees "${MSG}": ${aliceCount} time(s) — expected 1`);
console.log(`Bob   sees "${MSG}": ${bobCount} time(s) — expected 1`);

const aliceOk = aliceCount === 1;
const bobOk = bobCount === 1;

if (aliceOk && bobOk) {
  console.log("\n✅ PASS: Issue #15 is fixed — no duplicate messages.");
} else {
  console.log("\n❌ FAIL: Duplicate messages detected!");
  if (!aliceOk) console.log(`   Alice sees the message ${aliceCount}x (expected 1)`);
  if (!bobOk) console.log(`   Bob   sees the message ${bobCount}x (expected 1)`);
}

// Pause so the user can see the result in the browser
await alice.waitForTimeout(5000);

await browser.close();
process.exit(aliceOk && bobOk ? 0 : 1);
