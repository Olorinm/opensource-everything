import { basename, join, resolve } from "node:path";
import { coerceObject, readJson, slugify, uniqueStrings, writeJson, writeText } from "./common.js";

export async function summarizeTraceInput(traceInput, outputDir) {
  const trace = typeof traceInput === "string" ? await readJson(resolve(traceInput)) : traceInput;
  const summary = buildTraceSummary(trace);
  const targetDir = outputDir ? resolve(outputDir) : null;

  if (targetDir) {
    const markdownPath = join(targetDir, "trace-summary.md");
    const jsonPath = join(targetDir, "trace-summary.json");
    await writeText(markdownPath, summary.markdown);
    await writeJson(jsonPath, summary.json);
    return { ...summary, markdownPath, jsonPath };
  }

  return summary;
}

export function buildTraceSummary(traceInput) {
  const trace = coerceObject(traceInput);
  const session = coerceObject(trace.session);
  const observations = Array.isArray(trace.observations) ? trace.observations : [];
  const docs = Array.isArray(trace.docs) ? trace.docs : [];

  const pageIds = new Set();
  const actionCounts = new Map();
  const flowCounts = new Map();
  const screenshotLabels = [];
  const targets = [];
  const states = [];

  for (const rawObservation of observations) {
    const observation = coerceObject(rawObservation);
    if (observation.pageId || observation.pageTitle || observation.pageUrl) {
      pageIds.add(
        String(
          observation.pageId ||
            slugify(observation.pageTitle || observation.pageUrl || `page-${pageIds.size + 1}`),
        ),
      );
    }

    if (observation.action) {
      const action = String(observation.action);
      actionCounts.set(action, (actionCounts.get(action) || 0) + 1);
    }

    const flow = coerceObject(observation.flow);
    if (flow.name || flow.goal) {
      const flowName = String(flow.name || slugify(flow.goal || `flow-${flowCounts.size + 1}`));
      flowCounts.set(flowName, (flowCounts.get(flowName) || 0) + 1);
    }

    if (observation.screenshotLabel || observation.screenshotPath) {
      screenshotLabels.push(
        String(observation.screenshotLabel || basename(String(observation.screenshotPath || ""))),
      );
    }

    if (observation.target || observation.focusedElement) {
      targets.push(String(observation.target || observation.focusedElement));
    }

    if (Array.isArray(observation.states)) {
      states.push(...observation.states.map((item) => String(item)));
    }
  }

  const actionRanking = [...actionCounts.entries()]
    .sort((left, right) => right[1] - left[1])
    .map(([action, count]) => ({ action, count }));
  const flowRanking = [...flowCounts.entries()]
    .sort((left, right) => right[1] - left[1])
    .map(([flow, count]) => ({ flow, count }));

  const json = {
    source: {
      id: String(session.id || ""),
      name: String(coerceObject(session.source).name || ""),
      url: String(coerceObject(session.source).url || ""),
    },
    counts: {
      observations: observations.length,
      pages: pageIds.size,
      docs: docs.length,
      screenshots: screenshotLabels.length,
      flows: flowRanking.length,
    },
    topActions: actionRanking,
    flows: flowRanking,
    targets: uniqueStrings(targets),
    states: uniqueStrings(states),
    notes: uniqueStrings([...(Array.isArray(session.notes) ? session.notes : []), ...(Array.isArray(trace.notes) ? trace.notes : [])]),
  };

  const markdown = [
    `# Trace Summary: ${json.source.name || json.source.id || "trace"}`,
    "",
    "## Counts",
    `- observations: ${json.counts.observations}`,
    `- pages: ${json.counts.pages}`,
    `- docs: ${json.counts.docs}`,
    `- screenshots: ${json.counts.screenshots}`,
    `- flows: ${json.counts.flows}`,
    "",
    "## Top Actions",
    actionRanking.length
      ? actionRanking.map((entry) => `- ${entry.action}: ${entry.count}`).join("\n")
      : "- No actions recorded.",
    "",
    "## Flows",
    flowRanking.length
      ? flowRanking.map((entry) => `- ${entry.flow}: ${entry.count} observations`).join("\n")
      : "- No flows inferred.",
    "",
    "## Frequent Targets",
    json.targets.length
      ? json.targets.map((target) => `- ${target}`).join("\n")
      : "- No explicit targets recorded.",
    "",
    "## States Seen",
    json.states.length ? json.states.map((state) => `- ${state}`).join("\n") : "- No states recorded.",
    "",
    "## Notes",
    json.notes.length ? json.notes.map((note) => `- ${note}`).join("\n") : "- No notes recorded.",
    "",
  ].join("\n");

  return { markdown, json };
}
