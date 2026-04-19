import { join, resolve } from "node:path";
import {
  coerceObject,
  copyMaybe,
  ensureDir,
  fileInfo,
  normalizeArray,
  uniqueStrings,
  writeJson,
  slugify,
} from "./common.js";

export async function normalizeReferenceSession(input, outputRoot) {
  const source = coerceObject(input.source);
  const id = String(input.id || slugify(source.name || source.url || "reference-session"));
  const sessionDir = resolve(outputRoot, id);
  const screenshotsDir = join(sessionDir, "artifacts", "screenshots");

  await ensureDir(screenshotsDir);

  const pages = [];
  for (const rawPage of normalizeArray(input.pages)) {
    const page = coerceObject(rawPage);
    const screenshots = [];
    for (const rawScreenshot of normalizeArray(page.screenshots)) {
      const screenshot = coerceObject(rawScreenshot);
      if (!screenshot.path) {
        continue;
      }
      const copiedPath = await copyMaybe(screenshot.path, screenshotsDir);
      screenshots.push({
        label: String(screenshot.label || ""),
        path: `artifacts/screenshots/${copiedPath.split("/").pop()}`,
        metadata: await fileInfo(copiedPath),
      });
    }
    pages.push({
      id: String(page.id || slugify(page.title || page.url || `page-${pages.length + 1}`)),
      title: String(page.title || ""),
      url: String(page.url || ""),
      purpose: String(page.purpose || ""),
      components: uniqueStrings(page.components),
      states: uniqueStrings(page.states),
      copy: uniqueStrings(page.copy),
      screenshots,
      notes: uniqueStrings(page.notes),
    });
  }

  const session = {
    id,
    source: {
      name: String(source.name || ""),
      url: String(source.url || ""),
      capturedAt: String(source.capturedAt || new Date().toISOString()),
    },
    summary: String(input.summary || ""),
    docs: normalizeArray(input.docs).map((rawDoc) => {
      const doc = coerceObject(rawDoc);
      return {
        title: String(doc.title || ""),
        kind: String(doc.kind || "notes"),
        content: String(doc.content || ""),
      };
    }),
    pages,
    flows: normalizeArray(input.flows).map((rawFlow, index) => {
      const flow = coerceObject(rawFlow);
      return {
        name: String(flow.name || slugify(flow.goal || `flow-${index + 1}`)),
        goal: String(flow.goal || ""),
        steps: normalizeArray(flow.steps).map((rawStep) => {
          const step = coerceObject(rawStep);
          return {
            action: String(step.action || ""),
            target: String(step.target || ""),
            expectedResult: String(step.expectedResult || ""),
          };
        }),
      };
    }),
    notes: uniqueStrings(input.notes),
  };

  const sessionPath = join(sessionDir, "session.json");
  await writeJson(sessionPath, session);
  return { session, sessionPath, sessionDir };
}
