import { resolve } from "node:path";
import { captureReferenceData } from "./capture.js";
import { coerceObject, normalizeArray, slugify, uniqueStrings } from "./common.js";

export async function importComputerUseResearch(input, outputRoot) {
  const payload = coerceObject(input);
  const sessionMeta = coerceObject(payload.session);
  const pages = new Map();
  const flows = new Map();
  const sessionNotes = [...uniqueStrings(payload.notes), ...uniqueStrings(sessionMeta.notes)];

  normalizeArray(payload.observations).forEach((rawObservation, index) => {
    const observation = coerceObject(rawObservation);
    const pageId = String(
      observation.pageId ||
        slugify(observation.pageTitle || observation.pageUrl || `page-${index + 1}`),
    );
    const page = pages.get(pageId) || {
      id: pageId,
      title: String(observation.pageTitle || ""),
      url: String(observation.pageUrl || ""),
      purpose: String(observation.pagePurpose || ""),
      components: [],
      states: [],
      copy: [],
      screenshots: [],
      notes: [],
    };

    page.title = page.title || String(observation.pageTitle || "");
    page.url = page.url || String(observation.pageUrl || "");
    page.purpose = page.purpose || String(observation.pagePurpose || "");
    page.components = uniqueStrings([...page.components, ...normalizeArray(observation.components)]);
    page.states = uniqueStrings([...page.states, ...normalizeArray(observation.states)]);
    page.copy = uniqueStrings([...page.copy, ...normalizeArray(observation.copy)]);
    page.notes = uniqueStrings([
      ...page.notes,
      ...uniqueStrings(observation.notes),
      observation.observedResult ? String(observation.observedResult) : "",
    ]);

    if (observation.screenshotPath) {
      page.screenshots.push({
        path: String(observation.screenshotPath),
        label: String(observation.screenshotLabel || `step-${index + 1}`),
      });
    }

    pages.set(pageId, page);

    const flowMeta = coerceObject(observation.flow);
    const flowName = String(
      flowMeta.name || slugify(flowMeta.goal || observation.flowName || `flow-${index + 1}`),
    );

    if (observation.action || flowMeta.goal || observation.target || observation.expectedResult) {
      const flow = flows.get(flowName) || {
        name: flowName,
        goal: String(flowMeta.goal || observation.flowGoal || ""),
        steps: [],
      };
      flow.goal = flow.goal || String(flowMeta.goal || observation.flowGoal || "");
      flow.steps.push({
        action: String(observation.action || ""),
        target: String(observation.target || observation.focusedElement || ""),
        expectedResult: String(
          observation.expectedResult || observation.observedResult || observation.result || "",
        ),
      });
      flows.set(flowName, flow);
    }
  });

  const session = {
    id: sessionMeta.id,
    source: coerceObject(sessionMeta.source),
    summary: String(sessionMeta.summary || payload.summary || ""),
    docs: normalizeArray(payload.docs),
    pages: [...pages.values()],
    flows: [...flows.values()],
    notes: sessionNotes,
  };

  const root = resolve(outputRoot || process.cwd());
  return captureReferenceData(session, root);
}
