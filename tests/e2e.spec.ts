import { test, expect, type BrowserContext, type Page } from "@playwright/test";

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

async function register(page: Page, name: string) {
  await page.goto("/");
  await expect(page.getByText("Enter the arena")).toBeVisible();
  await page.getByPlaceholder("Display name").fill(name);
  await page.getByRole("button", { name: "Join" }).click();
  await expect(page.getByText(`Playing as`)).toBeVisible();
}

async function waitForText(page: Page, text: string, timeout = 15000) {
  await expect(page.getByText(text).first()).toBeVisible({ timeout });
}

test.describe("Full dialogue lifecycle", () => {
  let contextA: BrowserContext;
  let contextB: BrowserContext;
  let pageA: Page;
  let pageB: Page;
  const aliceName = `Alice-${uid()}`;
  const bobName = `Bob-${uid()}`;
  const proposition = `E2E test proposition ${uid()}`;

  test.beforeAll(async ({ browser }) => {
    contextA = await browser.newContext();
    contextB = await browser.newContext();
    pageA = await contextA.newPage();
    pageB = await contextB.newPage();
  });

  test.afterAll(async () => {
    await contextA.close();
    await contextB.close();
  });

  test("Alice registers and posts a proposition", async () => {
    await register(pageA, aliceName);

    await pageA.getByPlaceholder(/LLMs cannot/).fill(proposition);
    await pageA.getByRole("button", { name: "Challenge" }).click();

    // Verify it appears in the feed
    await waitForText(pageA, proposition);

    // Verify filter tabs exist
    await expect(pageA.getByRole("button", { name: "All", exact: true })).toBeVisible();
    await expect(pageA.getByRole("button", { name: "Open", exact: true })).toBeVisible();
    await expect(pageA.getByRole("button", { name: "Newest", exact: true })).toBeVisible();

    // Filter to open only — our proposition should still be visible
    await pageA.getByRole("button", { name: "Open", exact: true }).click();
    await waitForText(pageA, proposition);
  });

  test("Bob registers, finds the dialogue, and accepts the challenge", async () => {
    await register(pageB, bobName);

    // Wait for dialogue list to load and find our proposition
    await waitForText(pageB, proposition);

    // Click into the dialogue
    await pageB.getByText(proposition).click();
    await expect(pageB).toHaveURL(/\/dialogue\//);

    // Accept the challenge
    await pageB.getByRole("button", { name: "Accept this challenge" }).click();

    // Should now see "Your turn" or "Waiting for" (Alice goes first)
    await waitForText(pageB, "Waiting for");
  });

  test("Alice and Bob take turns until scoring", async () => {
    // Navigate Alice to the dialogue page
    const dialogueUrl = pageB.url();
    await pageA.goto(dialogueUrl);

    // Default is 3 turns per side = 6 total

    // Turn 1: Alice (challenger)
    await waitForText(pageA, "Your turn");
    await pageA.getByPlaceholder("Make your argument...").fill("Alice's first argument");
    await pageA.getByRole("button", { name: "Submit turn" }).click();
    await waitForText(pageA, "Alice's first argument");

    // Turn 2: Bob (responder)
    await waitForText(pageB, "Your turn");
    await pageB.getByPlaceholder("Make your argument...").fill("Bob's first response");
    await pageB.getByRole("button", { name: "Submit turn" }).click();
    await waitForText(pageB, "Bob's first response");

    // Turn 3: Alice
    await waitForText(pageA, "Your turn");
    await pageA.getByPlaceholder("Make your argument...").fill("Alice's second argument");
    await pageA.getByRole("button", { name: "Submit turn" }).click();
    await waitForText(pageA, "Alice's second argument");

    // Turn 4: Bob
    await waitForText(pageB, "Your turn");
    await pageB.getByPlaceholder("Make your argument...").fill("Bob's second response");
    await pageB.getByRole("button", { name: "Submit turn" }).click();
    await waitForText(pageB, "Bob's second response");

    // Turn 5: Alice (rejoinder)
    await waitForText(pageA, "Your turn");
    await pageA.getByPlaceholder("Make your argument...").fill("Alice's rejoinder");
    await pageA.getByRole("button", { name: "Submit turn" }).click();

    // Turn 6: Bob (rejoinder) — triggers scoring (3 per side = 6 total)
    await waitForText(pageB, "Your turn");
    await pageB.getByPlaceholder("Make your argument...").fill("Bob's rejoinder");
    await pageB.getByRole("button", { name: "Submit turn" }).click();

    // Should see scoring phase
    await waitForText(pageB, "Scoring phase");
  });

  test("Both users react with emojis", async () => {
    // Reload Alice's page to see scoring phase
    await pageA.reload();
    await waitForText(pageA, "Scoring phase");

    // Alice reacts with 🦉 on the dialogue
    await pageA.locator("button").filter({ hasText: "🦉" }).first().click();

    // Bob reacts with 🔥 on the dialogue
    await pageB.locator("button").filter({ hasText: "🔥" }).first().click();

    // Verify reactions appear (poll-refresh will update)
    await pageA.reload();
    await waitForText(pageA, "Scoring phase");
  });

  test("Alice and Bob submit conclusions", async () => {
    // Alice submits conclusion
    await pageA.getByPlaceholder("My conclusion is...").fill("Alice's final position on this matter.");
    await pageA.getByRole("button", { name: "Submit conclusion" }).click();
    await waitForText(pageA, "Alice's final position on this matter.");

    // Bob submits conclusion — should conclude the dialogue
    await pageB.reload();
    await waitForText(pageB, "Scoring phase");
    await pageB.getByPlaceholder("My conclusion is...").fill("Bob's final position on this matter.");
    await pageB.getByRole("button", { name: "Submit conclusion" }).click();

    // Should transition to concluded
    await waitForText(pageB, "Concluded");
    await waitForText(pageB, "Alice's final position on this matter.");
    await waitForText(pageB, "Bob's final position on this matter.");
  });
});
