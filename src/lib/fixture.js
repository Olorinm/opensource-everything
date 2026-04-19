import { join, resolve } from "node:path";
import { coerceObject, readJson, slugify, uniqueStrings, writeJson, writeText } from "./common.js";
import { loadSession } from "./reference.js";

export async function generateFixturesFromInput(input, outputDir) {
  const payload = coerceObject(input);
  if (payload.sessionPath) {
    const { session } = await loadSession(payload.sessionPath);
    return generateFixturePlan(
      {
        session,
        sourceKind: "session",
        derivedFrom: String(payload.sessionPath),
      },
      outputDir,
    );
  }

  if (payload.tracePath) {
    const trace = await readJson(resolve(payload.tracePath));
    return generateFixturePlan(
      {
        trace,
        sourceKind: "trace",
        derivedFrom: String(payload.tracePath),
      },
      outputDir,
    );
  }

  if (payload.session || payload.trace) {
    return generateFixturePlan(
      {
        session: payload.session,
        trace: payload.trace,
        sourceKind: payload.trace ? "trace" : "session",
        derivedFrom: "inline-input",
      },
      outputDir,
    );
  }

  throw new Error("generateFixturesFromInput requires sessionPath, tracePath, session, or trace");
}

export async function generateFixturePlan(sourceInput, outputDir) {
  const source = coerceObject(sourceInput);
  const session = normalizeSessionFromSource(source);
  const plan = buildFixturePlan(session, {
    sourceKind: String(source.sourceKind || "session"),
    derivedFrom: String(source.derivedFrom || ""),
  });
  const targetDir = outputDir ? resolve(outputDir) : null;

  if (targetDir) {
    const markdownPath = join(targetDir, "fixture-plan.md");
    const jsonPath = join(targetDir, "fixture-plan.json");
    await writeText(markdownPath, plan.markdown);
    await writeJson(jsonPath, plan.json);
    return { ...plan, markdownPath, jsonPath };
  }

  return plan;
}

export function buildFixturePlan(sessionInput, metadata = {}) {
  const session = coerceObject(sessionInput);
  const source = coerceObject(session.source);
  const fixtures = [];

  for (const rawFlow of Array.isArray(session.flows) ? session.flows : []) {
    const flow = coerceObject(rawFlow);
    const flowName = String(flow.name || slugify(flow.goal || `flow-${fixtures.length + 1}`));
    fixtures.push({
      id: `${flowName}-smoke`,
      name: `${flowName} smoke flow`,
      kind: "flow-smoke",
      priority: "critical",
      target: {
        flowName,
      },
      purpose: `Confirm the primary ${flowName} path still completes after each implementation pass.`,
      steps: (Array.isArray(flow.steps) ? flow.steps : []).map((rawStep, index) => {
        const step = coerceObject(rawStep);
        return `${index + 1}. ${String(step.action || "observe")}${step.target ? ` -> ${step.target}` : ""}`;
      }),
      expectedSignals: [
        String(flow.goal || "Expected result should match the reference flow."),
        "Each step should produce the same visible state transition as the reference.",
      ],
      artifacts: ["trace", "screenshots"],
      tags: ["flow", "smoke"],
    });
  }

  for (const rawPage of Array.isArray(session.pages) ? session.pages : []) {
    const page = coerceObject(rawPage);
    const pageId = String(page.id || slugify(page.title || `page-${fixtures.length + 1}`));
    const screenshots = Array.isArray(page.screenshots) ? page.screenshots : [];
    const states = Array.isArray(page.states) ? page.states : [];
    const copy = Array.isArray(page.copy) ? page.copy : [];
    const components = Array.isArray(page.components) ? page.components : [];

    fixtures.push({
      id: `${pageId}-visual-baseline`,
      name: `${pageId} visual baseline`,
      kind: "visual-baseline",
      priority: screenshots.length ? "high" : "medium",
      target: {
        pageId,
      },
      purpose: `Capture a stable baseline for ${pageId} before chasing edge cases.`,
      steps: [
        `Open the ${pageId} surface.`,
        "Capture the default desktop screenshot.",
        "Capture any key responsive or panel variants that matter.",
      ],
      expectedSignals: [
        `Primary hierarchy matches the ${pageId} reference.`,
        "Critical CTA placement and visible copy match the source.",
      ],
      artifacts: ["screenshots", "diff"],
      tags: uniqueStrings(["visual", "baseline", ...components.slice(0, 3)]),
    });

    for (const state of states) {
      fixtures.push({
        id: `${pageId}-${slugify(state)}-state`,
        name: `${pageId} ${state} state`,
        kind: "state-probe",
        priority: state === "default" ? "medium" : "high",
        target: {
          pageId,
        },
        purpose: `Verify the ${state} state exists and behaves like the reference.`,
        steps: [
          `Open the ${pageId} surface.`,
          `Trigger or simulate the ${state} state.`,
          "Record the resulting UI, copy, and layout stability.",
        ],
        expectedSignals: [
          state === "default"
            ? "The default state matches the reference with no extra loading or error artifacts."
            : `${state} is visibly distinct from the default state.`,
          "Primary controls stay usable and layout-stable.",
        ],
        artifacts: ["trace", "screenshots"],
        tags: ["state", slugify(state)],
      });
    }

    if (copy.length) {
      fixtures.push({
        id: `${pageId}-copy-integrity`,
        name: `${pageId} copy integrity`,
        kind: "copy-integrity",
        priority: "medium",
        target: {
          pageId,
        },
        purpose: `Check that the most important copy strings on ${pageId} still match the source.`,
        steps: copy.slice(0, 6).map((line) => `Assert visible copy contains: ${line}`),
        expectedSignals: ["Critical CTA and explanatory copy remain intact."],
        artifacts: ["trace"],
        tags: ["copy"],
      });
    }

    const inputSignals = [...components, ...copy].filter((entry) =>
      /input|field|email|password|search-input|search-bar|form/i.test(String(entry)),
    );
    if (inputSignals.length) {
      fixtures.push({
        id: `${pageId}-input-robustness`,
        name: `${pageId} input robustness`,
        kind: "input-robustness",
        priority: "high",
        target: {
          pageId,
          component: String(inputSignals[0]),
        },
        purpose: `Stress the main input path on ${pageId} with empty, invalid, and valid data.`,
        steps: [
          "Try empty input.",
          "Try malformed input.",
          "Try a valid input that should pass.",
          "Confirm error, loading, and success transitions are all visible and stable.",
        ],
        expectedSignals: [
          "Validation feedback matches the reference tone and placement.",
          "Submission controls remain reachable and stable.",
        ],
        artifacts: ["trace", "screenshots"],
        tags: ["input", "validation"],
      });
    }
  }

  const json = {
    id: `${slugify(source.name || session.id || "product")}-fixture-plan`,
    source: {
      name: String(source.name || session.id || ""),
      kind: String(metadata.sourceKind || "session"),
      derivedFrom: String(metadata.derivedFrom || ""),
    },
    summary: `Generated ${fixtures.length} fixtures from ${Array.isArray(session.pages) ? session.pages.length : 0} pages and ${Array.isArray(session.flows) ? session.flows.length : 0} flows.`,
    fixtures,
    recommendations: buildRecommendations(session, fixtures),
  };

  const markdown = [
    `# Fixture Plan: ${json.source.name || json.id}`,
    "",
    json.summary,
    "",
    "## Recommendations",
    json.recommendations.length
      ? json.recommendations.map((item) => `- ${item}`).join("\n")
      : "- No recommendations generated.",
    "",
    "## Fixtures",
    fixtures.length
      ? fixtures
          .map((fixture) =>
            [
              `### ${fixture.name}`,
              `- id: ${fixture.id}`,
              `- kind: ${fixture.kind}`,
              `- priority: ${fixture.priority}`,
              `- purpose: ${fixture.purpose}`,
              fixture.steps.length ? `- steps: ${fixture.steps.join(" | ")}` : "",
              fixture.expectedSignals.length
                ? `- expected: ${fixture.expectedSignals.join(" | ")}`
                : "",
              fixture.artifacts.length ? `- artifacts: ${fixture.artifacts.join(", ")}` : "",
              fixture.tags.length ? `- tags: ${fixture.tags.join(", ")}` : "",
            ]
              .filter(Boolean)
              .join("\n"),
          )
          .join("\n\n")
      : "_No fixtures generated._",
    "",
  ].join("\n");

  return { markdown, json };
}

function normalizeSessionFromSource(source) {
  if (source.session) {
    return source.session;
  }

  const trace = coerceObject(source.trace);
  const session = coerceObject(trace.session);
  const observations = Array.isArray(trace.observations) ? trace.observations : [];
  const pages = [];
  const pageMap = new Map();
  const flows = new Map();

  for (const rawObservation of observations) {
    const observation = coerceObject(rawObservation);
    const pageId = String(
      observation.pageId ||
        slugify(observation.pageTitle || observation.pageUrl || `page-${pageMap.size + 1}`),
    );
    if (!pageMap.has(pageId)) {
      pageMap.set(pageId, {
        id: pageId,
        title: String(observation.pageTitle || ""),
        url: String(observation.pageUrl || ""),
        purpose: String(observation.pagePurpose || ""),
        components: [],
        states: [],
        copy: [],
        screenshots: [],
      });
      pages.push(pageMap.get(pageId));
    }

    const page = pageMap.get(pageId);
    page.components = uniqueStrings([...(page.components || []), ...(Array.isArray(observation.components) ? observation.components : [])]);
    page.states = uniqueStrings([...(page.states || []), ...(Array.isArray(observation.states) ? observation.states : [])]);
    page.copy = uniqueStrings([...(page.copy || []), ...(Array.isArray(observation.copy) ? observation.copy : [])]);
    if (observation.screenshotPath) {
      page.screenshots.push({
        path: String(observation.screenshotPath),
        label: String(observation.screenshotLabel || ""),
      });
    }

    const flow = coerceObject(observation.flow);
    if (flow.name || flow.goal) {
      const flowName = String(flow.name || slugify(flow.goal || `flow-${flows.size + 1}`));
      if (!flows.has(flowName)) {
        flows.set(flowName, {
          name: flowName,
          goal: String(flow.goal || ""),
          steps: [],
        });
      }
      flows.get(flowName).steps.push({
        action: String(observation.action || "observe"),
        target: String(observation.target || observation.focusedElement || ""),
        expectedResult: String(observation.expectedResult || observation.observedResult || ""),
      });
    }
  }

  return {
    id: String(session.id || slugify(coerceObject(session.source).name || "trace-session")),
    source: coerceObject(session.source),
    pages,
    flows: [...flows.values()],
  };
}

function buildRecommendations(session, fixtures) {
  const recommendations = [];
  const pageCount = Array.isArray(session.pages) ? session.pages.length : 0;
  const flowCount = Array.isArray(session.flows) ? session.flows.length : 0;

  if (pageCount > 1) {
    recommendations.push("Run critical flows across multiple pages before spending time on final polish.");
  }
  if (flowCount === 0) {
    recommendations.push("Capture at least one end-to-end flow trace before implementation starts.");
  }
  if (!fixtures.some((fixture) => fixture.kind === "input-robustness")) {
    recommendations.push("Add explicit input and validation probes if the product contains forms or editable fields.");
  }
  recommendations.push("Keep fixture ids stable so repeated verification runs are easy to diff.");

  return recommendations;
}
