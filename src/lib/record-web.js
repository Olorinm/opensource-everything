import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright-core";
import { importComputerUseResearch } from "./computer-use.js";
import {
  coerceObject,
  ensureDir,
  pathExists,
  readJson,
  slugify,
  writeJson,
  writeText,
} from "./common.js";

const CHROME_CANDIDATES = [
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
];

export async function recordWebTraceFromInput(input, outputRoot) {
  const payload = coerceObject(input);
  const resolvedPlanPath = payload.planPath ? resolve(String(payload.planPath)) : "";
  const plan = resolvedPlanPath ? await readJson(resolvedPlanPath) : coerceObject(payload.plan);
  const root = resolve(outputRoot || process.cwd());
  const planName = String(plan.name || payload.name || plan.startUrl || payload.startUrl || "web-trace");
  const traceId = slugify(planName);
  const runDir = join(root, traceId);
  const screenshotsDir = join(runDir, "artifacts", "screenshots");
  const htmlDir = join(runDir, "artifacts", "html");
  const playwrightDir = join(runDir, "artifacts", "playwright");
  await ensureDir(screenshotsDir);
  await ensureDir(htmlDir);
  await ensureDir(playwrightDir);

  const browser = await chromium.launch({
    executablePath: await findChromeBinary(),
    headless: payload.headless !== false,
  });

  try {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1200 },
    });
    const page = await context.newPage();
    const tracePath = join(playwrightDir, "trace.zip");
    await context.tracing.start({ screenshots: true, snapshots: true });

    const startUrl = resolveStartUrl(String(payload.startUrl || plan.startUrl || ""), resolvedPlanPath);
    if (!startUrl) {
      throw new Error("recordWebTraceFromInput requires startUrl in the input or plan");
    }
    await page.goto(startUrl);
    await page.waitForLoadState("domcontentloaded");

    const observations = [];
    const actions = Array.isArray(plan.actions) ? plan.actions : [];
    for (let index = 0; index < actions.length; index += 1) {
      const action = coerceObject(actions[index]);
      await performAction(page, action);
      const observation = await captureObservation(page, action, index + 1, {
        screenshotsDir,
        htmlDir,
      });
      observations.push(observation);
    }

    if (!actions.length || lastActionType(actions) !== "observe") {
      observations.push(
        await captureObservation(
          page,
          {
            type: "observe",
            label: "final-state",
            notes: ["Auto-captured final state after the scripted actions."],
          },
          observations.length + 1,
          {
            screenshotsDir,
            htmlDir,
          },
        ),
      );
    }

    await context.tracing.stop({ path: tracePath });
    await context.close();

    const trace = {
      session: {
        id: traceId,
        source: {
          name: String(plan.session?.source?.name || plan.name || traceId),
          url: startUrl,
          capturedAt: new Date().toISOString(),
        },
        summary: String(
          plan.session?.summary ||
            plan.summary ||
            `Recorded ${observations.length} observations from ${startUrl}.`,
        ),
        notes: normalizeNotes(plan.session?.notes),
      },
      observations,
      docs: Array.isArray(plan.docs) ? plan.docs : [],
      notes: normalizeNotes(plan.notes),
    };

    const tracePathJson = join(runDir, "computer-use-trace.json");
    await writeJson(tracePathJson, trace);
    await writeText(join(runDir, "trace-plan.json"), `${JSON.stringify(plan, null, 2)}\n`);

    const sessionResult = await importComputerUseResearch(trace, root);
    return {
      trace,
      tracePath: tracePathJson,
      runDir,
      playwrightTracePath: tracePath,
      sessionPath: sessionResult.sessionPath,
      sessionDir: sessionResult.sessionDir,
    };
  } finally {
    await browser.close();
  }
}

function resolveStartUrl(startUrl, planPath) {
  const raw = String(startUrl || "").trim();
  if (!raw) {
    return "";
  }
  if (/^[a-z]+:\/\//i.test(raw)) {
    return raw;
  }
  if (!planPath) {
    return raw;
  }
  return pathToFileURL(resolve(dirname(planPath), raw)).href;
}

async function performAction(page, action) {
  const type = String(action.type || action.action || "observe");
  switch (type) {
    case "observe":
    case "screenshot":
      return;
    case "goto":
      await page.goto(String(action.url || action.value || ""));
      await page.waitForLoadState("domcontentloaded");
      return;
    case "click": {
      const locator = resolveLocator(page, action.target);
      await locator.click();
      await settle(page, action);
      return;
    }
    case "fill": {
      const locator = resolveLocator(page, action.target);
      await locator.fill(String(action.value || ""));
      await settle(page, action);
      return;
    }
    case "press": {
      if (action.target) {
        await resolveLocator(page, action.target).click();
      }
      await page.keyboard.press(String(action.key || action.value || "Enter"));
      await settle(page, action);
      return;
    }
    case "wait":
      await page.waitForTimeout(Number(action.ms || action.value || 500));
      return;
    default:
      throw new Error(`Unsupported web trace action: ${type}`);
  }
}

async function captureObservation(page, action, index, dirs) {
  const title = await page.title();
  const url = page.url();
  const pageId = slugify(title || url || `page-${index}`);
  const label = slugify(action.label || `${index}-${action.type || action.action || "observe"}`);
  const screenshotAbsPath = join(dirs.screenshotsDir, `${String(index).padStart(2, "0")}-${label}.png`);
  const htmlAbsPath = join(dirs.htmlDir, `${String(index).padStart(2, "0")}-${label}.html`);

  await page.screenshot({ path: screenshotAbsPath, fullPage: true });
  await writeText(htmlAbsPath, await page.content());

  const summary = await page.evaluate(() => {
    const headings = [...document.querySelectorAll("h1, h2, h3")]
      .map((node) => node.textContent?.trim())
      .filter(Boolean)
      .slice(0, 6);
    const bodyLines = (document.body?.innerText || "")
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .slice(0, 12);
    const active = document.activeElement;
    const focusedElement = active
      ? [
          active.tagName?.toLowerCase() || "",
          active.id ? `#${active.id}` : "",
          active.getAttribute?.("placeholder") ? `[${active.getAttribute("placeholder")}]` : "",
          active.getAttribute?.("aria-label") ? `{${active.getAttribute("aria-label")}}` : "",
        ]
          .filter(Boolean)
          .join("")
      : "";
    const states = ["default"];
    if (document.body?.innerText?.toLowerCase().includes("loading")) states.push("loading");
    if (document.body?.innerText?.toLowerCase().includes("error")) states.push("error");
    if (document.querySelector("form")) states.push("form");
    const components = [];
    if (document.querySelector("nav")) components.push("top-nav");
    if (document.querySelector("header")) components.push("hero");
    if (document.querySelector("form")) components.push("form");
    if (document.querySelector("footer")) components.push("footer");
    if (document.querySelector("button, a")) components.push("cta");
    return {
      headings,
      bodyLines,
      focusedElement,
      states,
      components,
    };
  });

  return {
    pageId,
    pageTitle: title,
    pageUrl: url,
    pagePurpose: summary.headings[0] || "",
    action: String(action.type || action.action || "observe"),
    target: describeTarget(action.target),
    expectedResult: String(action.expectedResult || ""),
    observedResult: summary.headings[0] || summary.bodyLines[0] || title || url,
    screenshotPath: screenshotAbsPath,
    screenshotLabel: label,
    htmlPath: htmlAbsPath,
    focusedElement: summary.focusedElement,
    components: summary.components,
    states: summary.states,
    copy: summary.bodyLines,
    notes: normalizeNotes(action.notes),
    flow: coerceObject(action.flow),
  };
}

function resolveLocator(page, rawTarget) {
  const target = coerceObject(rawTarget);
  if (target.selector) {
    return page.locator(String(target.selector));
  }
  if (target.role) {
    return page.getByRole(String(target.role), {
      name: String(target.name || ""),
      exact: Boolean(target.exact),
    });
  }
  if (target.text) {
    return page.getByText(String(target.text), { exact: Boolean(target.exact) });
  }
  if (target.placeholder) {
    return page.getByPlaceholder(String(target.placeholder), { exact: Boolean(target.exact) });
  }
  if (target.label) {
    return page.getByLabel(String(target.label), { exact: Boolean(target.exact) });
  }
  if (target.testId) {
    return page.getByTestId(String(target.testId));
  }
  throw new Error("Action target must provide selector, role, text, placeholder, label, or testId");
}

async function settle(page, action) {
  const waitFor = Number(action.waitForMs || 250);
  await page.waitForTimeout(waitFor);
  await page.waitForLoadState("domcontentloaded").catch(() => {});
}

async function findChromeBinary() {
  for (const candidate of CHROME_CANDIDATES) {
    if (await pathExists(candidate)) {
      return candidate;
    }
  }
  throw new Error("Could not find a Chrome/Chromium binary for web trace recording.");
}

function describeTarget(rawTarget) {
  const target = coerceObject(rawTarget);
  return String(
    target.selector ||
      target.text ||
      target.placeholder ||
      target.label ||
      target.name ||
      target.testId ||
      "",
  );
}

function normalizeNotes(value) {
  return Array.isArray(value) ? value.map((item) => String(item)).filter(Boolean) : [];
}

function lastActionType(actions) {
  const last = actions.at(-1);
  return String(last?.type || last?.action || "");
}
