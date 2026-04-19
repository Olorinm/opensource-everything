import { join, resolve } from "node:path";
import { generateFixturesFromInput } from "./fixture.js";
import { coerceObject, readJson, slugify, writeJson, writeText } from "./common.js";
import { loadSession } from "./reference.js";

export async function generatePlaywrightFixturesFromInput(input, outputDir, options = {}) {
  const payload = coerceObject(input);
  const targetDir = resolve(outputDir || process.cwd());
  const candidateBaseUrl = String(options.candidateBaseUrl || payload.candidateBaseUrl || "");
  const fixtureResult = payload.fixturePlanPath
    ? {
        json: await readJson(resolve(payload.fixturePlanPath)),
      }
    : payload.fixturePlan
      ? { json: payload.fixturePlan }
      : await generateFixturesFromInput(payload);

  const session = await maybeLoadSession(payload);
  const generated = buildPlaywrightFixtures(fixtureResult.json, {
    session,
    candidateBaseUrl,
  });

  const testsDir = join(targetDir, "tests");
  const testFilePath = join(testsDir, "ose.generated.spec.ts");
  const configPath = join(targetDir, "playwright.config.ts");
  const readmePath = join(targetDir, "PLAYWRIGHT.md");
  const metaPath = join(targetDir, "playwright.generated.json");

  await writeText(testFilePath, generated.testFile);
  await writeText(configPath, generated.configFile);
  await writeText(readmePath, generated.readme);
  await writeJson(metaPath, generated.json);

  return {
    ...generated,
    testFilePath,
    configPath,
    readmePath,
    metaPath,
  };
}

export function buildPlaywrightFixtures(planInput, options = {}) {
  const plan = coerceObject(planInput);
  const session = coerceObject(options.session);
  const pageMap = new Map(
    (Array.isArray(session.pages) ? session.pages : []).map((page) => [String(page.id), page]),
  );
  const candidateBaseUrl = String(options.candidateBaseUrl || "");
  const fixtures = Array.isArray(plan.fixtures) ? plan.fixtures : [];

  const tests = fixtures.map((fixture) => buildFixtureTest(fixture, pageMap, candidateBaseUrl));
  const configFile = [
    "import { defineConfig } from '@playwright/test';",
    "",
    "export default defineConfig({",
    "  testDir: './tests',",
    "  fullyParallel: false,",
    "  use: {",
    candidateBaseUrl ? `    baseURL: ${JSON.stringify(candidateBaseUrl)},` : "",
    "    trace: 'retain-on-failure',",
    "  },",
    "});",
    "",
  ]
    .filter(Boolean)
    .join("\n");

  const helperLines = [
    "import { test, expect } from '@playwright/test';",
    "",
    `const OSE_BASE_URL = process.env.OSE_BASE_URL || ${JSON.stringify(candidateBaseUrl)};`,
    "",
    "function mapReferenceUrl(referenceUrl?: string): string | undefined {",
    "  if (!referenceUrl) return OSE_BASE_URL || undefined;",
    "  if (!OSE_BASE_URL) return referenceUrl;",
    "  try {",
    "    const original = new URL(referenceUrl);",
    "    const target = new URL(OSE_BASE_URL);",
    "    target.pathname = original.pathname;",
    "    target.search = original.search;",
    "    target.hash = original.hash;",
    "    return target.toString();",
    "  } catch {",
    "    return OSE_BASE_URL;",
    "  }",
    "}",
    "",
  ];

  const testFile = [...helperLines, ...tests].join("\n");
  const readme = [
    "# Playwright Output",
    "",
    "These tests were generated from the fixture plan.",
    "",
    "- copy checks and visual baselines are ready to run",
    "- flow and state probes may still need manual selectors or state triggers",
    "- set `OSE_BASE_URL` if the candidate app runs on a different host than the reference",
    "",
    "Typical usage:",
    "",
    "```bash",
    "npx playwright test",
    "```",
    "",
  ].join("\n");

  return {
    testFile,
    configFile,
    readme,
    json: {
      fixtureCount: fixtures.length,
      candidateBaseUrl,
      fixtures: fixtures.map((fixture) => ({
        id: fixture.id,
        kind: fixture.kind,
        name: fixture.name,
      })),
    },
  };
}

async function maybeLoadSession(payload) {
  if (payload.sessionPath) {
    const { session } = await loadSession(payload.sessionPath);
    return session;
  }
  if (payload.session) {
    return payload.session;
  }
  return null;
}

function buildFixtureTest(fixtureInput, pageMap, candidateBaseUrl) {
  const fixture = coerceObject(fixtureInput);
  const target = coerceObject(fixture.target);
  const page = pageMap.get(String(target.pageId || ""));
  const pageTitle = page?.title || String(target.pageId || fixture.name || "page");
  const targetUrl = page?.url ? `mapReferenceUrl(${JSON.stringify(page.url)})` : "mapReferenceUrl(undefined)";
  const testName = JSON.stringify(`${fixture.name || fixture.id} [${fixture.kind || "fixture"}]`);
  const copyAssertions = (Array.isArray(page?.copy) ? page.copy : [])
    .slice(0, 4)
    .map(
      (line) =>
        `  await expect(page.getByText(${JSON.stringify(line)}, { exact: false }).first()).toBeVisible();`,
    );

  if (fixture.kind === "copy-integrity") {
    return [
      `test(${testName}, async ({ page }) => {`,
      "  const targetUrl = " + targetUrl + ";",
      "  test.skip(!targetUrl, 'No URL available for this fixture.');",
      "  await page.goto(targetUrl!);",
      ...(copyAssertions.length
        ? copyAssertions
        : ["  test.fixme(true, 'No copy strings were available for this page.');"]),
      "});",
      "",
    ].join("\n");
  }

  if (fixture.kind === "visual-baseline") {
    return [
      `test(${testName}, async ({ page }) => {`,
      "  const targetUrl = " + targetUrl + ";",
      "  test.skip(!targetUrl, 'No URL available for this fixture.');",
      "  await page.goto(targetUrl!);",
      `  await expect(page).toHaveScreenshot(${JSON.stringify(`${slugify(pageTitle)}-baseline.png`)}, { fullPage: true });`,
      "});",
      "",
    ].join("\n");
  }

  if (fixture.kind === "flow-smoke") {
    return [
      `test.fixme(${testName}, async ({ page }) => {`,
      "  const targetUrl = " + targetUrl + ";",
      "  test.skip(!targetUrl && !OSE_BASE_URL, 'No target URL available for this flow.');",
      "  if (targetUrl) {",
      "    await page.goto(targetUrl);",
      "  }",
      `  // TODO: wire real selectors for flow ${JSON.stringify(String(target.flowName || fixture.id || ""))}`,
      ...(Array.isArray(fixture.steps) ? fixture.steps.map((step) => `  // ${String(step)}`) : []),
      "});",
      "",
    ].join("\n");
  }

  if (fixture.kind === "state-probe" || fixture.kind === "input-robustness") {
    return [
      `test.fixme(${testName}, async ({ page }) => {`,
      "  const targetUrl = " + targetUrl + ";",
      "  test.skip(!targetUrl, 'No URL available for this fixture.');",
      "  await page.goto(targetUrl!);",
      ...(Array.isArray(fixture.steps) ? fixture.steps.map((step) => `  // ${String(step)}`) : []),
      "});",
      "",
    ].join("\n");
  }

  return [
    `test.fixme(${testName}, async () => {`,
    `  // Unsupported fixture kind: ${String(fixture.kind || "unknown")}`,
    candidateBaseUrl ? `  // Candidate base URL: ${candidateBaseUrl}` : "",
    "});",
    "",
  ]
    .filter(Boolean)
    .join("\n");
}
