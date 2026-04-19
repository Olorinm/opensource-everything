import { execFile } from "node:child_process";
import { writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import { captureReferenceData } from "./capture.js";
import {
  coerceObject,
  ensureDir,
  normalizeArray,
  pathExists,
  readText,
  slugify,
  uniqueStrings,
  writeJson,
  writeText,
} from "./common.js";

const execFileAsync = promisify(execFile);
const CHROME_CANDIDATES = [
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
];

export async function captureWebReference(input, outputRoot) {
  const payload = coerceObject(input);
  const root = resolve(outputRoot || process.cwd());
  const sourceName = String(payload.name || payload.sourceName || payload.url || payload.htmlPath || "web-capture");
  const html = await loadHtml(payload);
  const analysis = analyzeHtml(html, {
    url: String(payload.url || ""),
    name: sourceName,
  });

  const screenshotPath =
    String(payload.screenshotPath || "") ||
    (payload.url ? await tryCaptureScreenshot(String(payload.url), root, analysis.page.id) : "");

  const sessionInput = {
    source: {
      name: sourceName,
      url: String(payload.url || ""),
      capturedAt: new Date().toISOString(),
    },
    summary: analysis.summary,
    docs: [
      {
        title: "HTML summary",
        kind: "web-capture",
        content: analysis.docSummary,
      },
      {
        title: "Readable text",
        kind: "web-copy",
        content: analysis.readableText,
      },
    ],
    pages: [
      {
        ...analysis.page,
        screenshots: screenshotPath
          ? [
              {
                path: screenshotPath,
                label: "captured-default",
              },
            ]
          : [],
      },
    ],
    flows: analysis.flows,
    notes: analysis.notes,
  };

  const result = await captureReferenceData(sessionInput, root);
  const sourceDir = join(result.sessionDir, "artifacts", "source");
  await ensureDir(sourceDir);
  await writeText(join(sourceDir, "page.html"), html);
  await writeText(join(sourceDir, "page.txt"), analysis.readableText);
  await writeJson(join(sourceDir, "page-analysis.json"), analysis.json);

  return {
    ...result,
    analysis,
    sourceHtmlPath: join(sourceDir, "page.html"),
    sourceTextPath: join(sourceDir, "page.txt"),
  };
}

async function loadHtml(payload) {
  if (typeof payload.html === "string" && payload.html.trim()) {
    return payload.html;
  }

  if (payload.htmlPath) {
    return readText(resolve(String(payload.htmlPath)));
  }

  if (payload.url) {
    const response = await fetch(String(payload.url), {
      headers: {
        "user-agent": "opensource-everything/0.2.0",
      },
    });
    if (!response.ok) {
      throw new Error(`Failed to fetch ${payload.url}: ${response.status} ${response.statusText}`);
    }
    return response.text();
  }

  throw new Error("captureWebReference requires url, htmlPath, or html");
}

function analyzeHtml(html, meta = {}) {
  const title = extractOne(html, /<title[^>]*>([\s\S]*?)<\/title>/i);
  const description = extractMetaContent(html, "description");
  const headings = extractAll(html, /<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/gi);
  const buttons = extractAll(html, /<(button|a)[^>]*>([\s\S]*?)<\/\1>/gi, 2)
    .map(cleanInlineText)
    .filter((value) => value.length > 1);
  const inputs = extractAll(html, /<(input|textarea|select)\b[^>]*(placeholder="([^"]*)")?[^>]*>/gi, 3)
    .map(cleanInlineText)
    .filter(Boolean);
  const readableText = stripHtml(html);
  const copy = uniqueStrings([
    ...headings,
    ...buttons,
    ...inputs,
    ...readableText
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 3)
      .slice(0, 12),
  ]).slice(0, 12);

  const components = inferComponents(html, { headings, buttons, inputs });
  const states = inferStates(html);
  const pageId = slugify(meta.url || title || meta.name || "captured-page");
  const docSummary = [
    title ? `title: ${title}` : "",
    description ? `description: ${description}` : "",
    headings.length ? `headings: ${headings.slice(0, 5).join(" | ")}` : "",
    buttons.length ? `actions: ${buttons.slice(0, 6).join(" | ")}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const primaryAction = buttons[0] || "";
  const flows = primaryAction
    ? [
        {
          name: slugify(`${primaryAction}-flow`),
          goal: `Reach the UI triggered by ${primaryAction}`,
          steps: [
            {
              action: "click",
              target: primaryAction,
              expectedResult: "The next visible state should match the captured reference.",
            },
          ],
        },
      ]
    : [];

  const notes = uniqueStrings([
    description,
    buttons.length ? `Detected ${buttons.length} clickable actions in the captured HTML.` : "",
    inputs.length ? `Detected ${inputs.length} input-like controls.` : "",
    !buttons.length ? "No obvious CTA was detected. Review the page manually." : "",
  ]);

  return {
    summary:
      description ||
      headings[0] ||
      title ||
      `Captured ${meta.url || meta.name || "page"} for later cloning.`,
    docSummary,
    readableText,
    notes,
    flows,
    page: {
      id: pageId,
      title: title || String(meta.name || ""),
      url: String(meta.url || ""),
      purpose: description || headings[0] || "Captured web page",
      components,
      states,
      copy,
      notes,
    },
    json: {
      title,
      description,
      headings,
      buttons,
      inputs,
      components,
      states,
      copy,
      url: String(meta.url || ""),
    },
  };
}

function inferComponents(html, signals) {
  const components = [];
  const checks = [
    ["top-nav", /<nav\b|class="[^"]*(nav|navbar)[^"]*"/i],
    ["hero", /class="[^"]*(hero|banner|masthead)[^"]*"|<header\b/i],
    ["form", /<form\b/i],
    ["footer", /<footer\b/i],
    ["pricing", /\bpricing\b|\bplans?\b/i],
    ["feature-grid", /\bfeatures?\b|grid/i],
    ["cta", /\b(start|get started|try|download|sign up|continue)\b/i],
  ];

  for (const [name, pattern] of checks) {
    if (pattern.test(html) || signals.buttons.some((item) => pattern.test(item)) || signals.headings.some((item) => pattern.test(item))) {
      components.push(name);
    }
  }

  if (signals.inputs.length) {
    components.push("input-field");
  }

  return uniqueStrings(components);
}

function inferStates(html) {
  const states = ["default"];
  const lowered = html.toLowerCase();
  if (lowered.includes("loading")) {
    states.push("loading");
  }
  if (lowered.includes("error") || lowered.includes("invalid")) {
    states.push("error");
  }
  if (lowered.includes("empty")) {
    states.push("empty");
  }
  return uniqueStrings(states);
}

async function tryCaptureScreenshot(url, outputRoot, slug) {
  const chromePath = await findChromeBinary();
  if (!chromePath) {
    return "";
  }

  const tmpDir = join(outputRoot, "_web-capture");
  await ensureDir(tmpDir);
  const targetPath = join(tmpDir, `${slug || "capture"}.png`);

  try {
    await execFileAsync(chromePath, [
      "--headless=new",
      "--disable-gpu",
      "--hide-scrollbars",
      `--screenshot=${targetPath}`,
      "--window-size=1440,1400",
      url,
    ]);
    return (await pathExists(targetPath)) ? targetPath : "";
  } catch {
    return "";
  }
}

async function findChromeBinary() {
  for (const candidate of CHROME_CANDIDATES) {
    if (await pathExists(candidate)) {
      return candidate;
    }
  }
  return "";
}

function extractMetaContent(html, name) {
  return cleanInlineText(
    extractOne(
      html,
      new RegExp(`<meta[^>]+name=["']${escapeForRegex(name)}["'][^>]+content=["']([^"']*)["'][^>]*>`, "i"),
    ) ||
      extractOne(
        html,
        new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+name=["']${escapeForRegex(name)}["'][^>]*>`, "i"),
      ),
  );
}

function extractOne(text, pattern) {
  const match = text.match(pattern);
  return cleanInlineText(match?.[1] || "");
}

function extractAll(text, pattern, group = 1) {
  const values = [];
  let match;
  while ((match = pattern.exec(text))) {
    values.push(cleanInlineText(match[group] || ""));
  }
  pattern.lastIndex = 0;
  return uniqueStrings(values);
}

function stripHtml(html) {
  return decodeEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
      .replace(/<[^>]+>/g, "\n"),
  )
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 60)
    .join("\n");
}

function cleanInlineText(value) {
  return decodeEntities(String(value || "").replace(/\s+/g, " ").trim());
}

function decodeEntities(text) {
  return text
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function escapeForRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
