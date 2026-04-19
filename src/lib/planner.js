import { dirname, join, resolve } from "node:path";
import { buildTraceSummary } from "./trace.js";
import { buildVerificationReport } from "./verify.js";
import { coerceObject, readJson, uniqueStrings, writeJson, writeText } from "./common.js";
import { loadSession } from "./reference.js";

export async function planCaptureFromInput(input, outputDir) {
  const payload = coerceObject(input);
  const session = payload.sessionPath
    ? (await loadSession(resolve(String(payload.sessionPath)))).session
    : payload.session;
  const trace = payload.tracePath ? await readJson(resolve(String(payload.tracePath))) : payload.trace;
  const summary = payload.summaryPath
    ? await readJson(resolve(String(payload.summaryPath)))
    : payload.summary || (trace ? buildTraceSummary(trace).json : null);
  const plan = buildCapturePlan({
    session,
    summary,
    goal: payload.goal,
    targetSurface: payload.targetSurface,
    productName: payload.productName,
    url: payload.url,
  });
  const targetDir = outputDir ? resolve(outputDir) : null;

  if (targetDir) {
    const markdownPath = join(targetDir, "capture-plan.md");
    const jsonPath = join(targetDir, "capture-plan.json");
    await writeText(markdownPath, plan.markdown);
    await writeJson(jsonPath, plan.json);
    return { ...plan, markdownPath, jsonPath };
  }

  return plan;
}

export function buildCapturePlan(input) {
  const payload = coerceObject(input);
  const session = coerceObject(payload.session);
  const summary = coerceObject(payload.summary);
  const pages = Array.isArray(session.pages) ? session.pages : [];
  const flows = Array.isArray(session.flows) ? session.flows : [];
  const docs = Array.isArray(session.docs) ? session.docs : [];
  const pageCount = pages.length || Number(coerceObject(summary.counts).pages || 0);
  const flowCount = flows.length || Number(coerceObject(summary.counts).flows || 0);
  const screenshotCount =
    pages.reduce((count, page) => count + (Array.isArray(page.screenshots) ? page.screenshots.length : 0), 0) ||
    Number(coerceObject(summary.counts).screenshots || 0);
  const docsCount = docs.length || Number(coerceObject(summary.counts).docs || 0);
  const surface = inferTargetSurface(payload, session, summary);
  const target = {
    name: String(payload.productName || coerceObject(session.source).name || coerceObject(summary.source).name || "target"),
    url: String(payload.url || coerceObject(session.source).url || coerceObject(summary.source).url || ""),
    surface,
    goal: String(payload.goal || session.summary || ""),
  };

  const missingEvidence = [];
  if (!pageCount) {
    missingEvidence.push("No clear page or window inventory yet.");
  }
  if (!flowCount) {
    missingEvidence.push("No primary user flow has been captured yet.");
  }
  if (!screenshotCount) {
    missingEvidence.push("No screenshot baseline has been saved yet.");
  }

  const pagesWithoutScreenshots = pages
    .filter((page) => !Array.isArray(page.screenshots) || !page.screenshots.length)
    .map((page) => page.title || page.id)
    .slice(0, 2);
  if (pagesWithoutScreenshots.length) {
    missingEvidence.push(`Add screenshots for ${pagesWithoutScreenshots.join(" and ")}.`);
  }

  const pagesWithoutStates = pages
    .filter((page) => !Array.isArray(page.states) || !page.states.length)
    .map((page) => page.title || page.id)
    .slice(0, 2);
  if (pagesWithoutStates.length) {
    missingEvidence.push(`State coverage is thin for ${pagesWithoutStates.join(" and ")}.`);
  }

  const nextSteps = buildCaptureSteps({
    target,
    pageCount,
    flowCount,
    screenshotCount,
    docsCount,
    missingEvidence,
  });

  const json = {
    target,
    coverage: {
      pages: pageCount,
      flows: flowCount,
      screenshots: screenshotCount,
      docs: docsCount,
    },
    missingEvidence: missingEvidence.slice(0, 4),
    nextSteps,
  };

  const markdown = [
    `# Capture Plan: ${target.name}`,
    "",
    `Surface: ${target.surface}`,
    target.goal ? `Goal: ${target.goal}` : "",
    "",
    "## Missing Evidence",
    json.missingEvidence.length ? json.missingEvidence.map((item) => `- ${item}`).join("\n") : "- Current evidence is usable.",
    "",
    "## Next Steps",
    nextSteps
      .map((step, index) => `${index + 1}. ${step.tool}: ${step.focus}${step.reason ? ` (${step.reason})` : ""}`)
      .join("\n"),
    "",
  ]
    .filter(Boolean)
    .join("\n");

  return { markdown, json };
}

export async function planRepairFromInput(input, outputDir) {
  const payload = coerceObject(input);
  let report;

  if (payload.verificationReportPath) {
    report = await readJson(resolve(String(payload.verificationReportPath)));
  } else if (payload.verificationReport) {
    report = payload.verificationReport;
  } else if (payload.referenceSession && payload.candidateManifest) {
    const { session } = await loadSession(resolve(String(payload.referenceSession)));
    const candidateManifestPath = resolve(String(payload.candidateManifest));
    const candidate = await readJson(candidateManifestPath);
    const built = await buildVerificationReport(session, candidate, {
      candidateBaseDir: dirname(candidateManifestPath),
      outputDir: outputDir ? resolve(outputDir) : resolve(dirname(candidateManifestPath)),
    });
    report = built.json;
  } else {
    throw new Error(
      "planRepairFromInput requires verificationReportPath, verificationReport, or referenceSession + candidateManifest.",
    );
  }

  const plan = buildRepairPlan(report);
  const targetDir = outputDir ? resolve(outputDir) : null;

  if (targetDir) {
    const markdownPath = join(targetDir, "repair-plan.md");
    const jsonPath = join(targetDir, "repair-plan.json");
    await writeText(markdownPath, plan.markdown);
    await writeJson(jsonPath, plan.json);
    return { ...plan, markdownPath, jsonPath };
  }

  return plan;
}

export function buildRepairPlan(reportInput) {
  const report = coerceObject(reportInput);
  const pageFindings = Array.isArray(report.pageFindings) ? report.pageFindings : [];
  const flowFindings = Array.isArray(report.flowFindings) ? report.flowFindings : [];
  const priorities = [];

  for (const page of pageFindings) {
    const pageName = String(page.title || page.page || "page");
    if (!page.found) {
      priorities.push(priorityItem(100, "page", pageName, `Build the full ${pageName} surface before polishing.`));
      continue;
    }
    if (Array.isArray(page.missingStates) && page.missingStates.length) {
      priorities.push(
        priorityItem(80, "state", pageName, `Add the missing states on ${pageName}: ${page.missingStates.slice(0, 3).join(", ")}.`),
      );
    }
    if (Array.isArray(page.missingComponents) && page.missingComponents.length) {
      priorities.push(
        priorityItem(
          75,
          "component",
          pageName,
          `Add the missing components on ${pageName}: ${page.missingComponents.slice(0, 3).join(", ")}.`,
        ),
      );
    }
    if (Array.isArray(page.missingCopy) && page.missingCopy.length) {
      priorities.push(
        priorityItem(70, "copy", pageName, `Restore the missing copy on ${pageName}: ${page.missingCopy.slice(0, 2).join(" | ")}.`),
      );
    }
    const visualMismatches = Array.isArray(page.screenshotStatuses)
      ? page.screenshotStatuses.filter((item) => !String(item).includes(": exact "))
      : [];
    if (visualMismatches.length) {
      priorities.push(
        priorityItem(
          50,
          "visual",
          pageName,
          `Tighten the visual match on ${pageName}: ${visualMismatches[0]}.`,
        ),
      );
    }
  }

  for (const flow of flowFindings) {
    if (!flow.implemented) {
      priorities.push(
        priorityItem(90, "flow", String(flow.name || "flow"), `Implement the ${String(flow.name || "flow")} flow end to end.`),
      );
    }
  }

  const ranked = priorities
    .sort((left, right) => right.weight - left.weight)
    .slice(0, 5)
    .map(({ weight, ...item }) => item);

  const json = {
    score: Number(report.score || 0),
    summary:
      ranked[0]?.action ||
      "No obvious repair tasks remain. Run verification again after the next meaningful change.",
    priorities: ranked,
    nextVerification: ["verify_clone", "diff_reference_artifacts"],
  };

  const markdown = [
    `# Repair Plan`,
    "",
    `Score: ${json.score}%`,
    "",
    "## Priority Fixes",
    ranked.length
      ? ranked.map((item, index) => `${index + 1}. [${item.kind}] ${item.target}: ${item.action}`).join("\n")
      : "1. No obvious repair tasks remain. Re-run verification after the next candidate update.",
    "",
    "## Re-check",
    "- verify_clone",
    "- diff_reference_artifacts",
    "",
  ].join("\n");

  return { markdown, json };
}

function buildCaptureSteps(context) {
  const steps = [];
  const { target, pageCount, flowCount, screenshotCount, missingEvidence } = context;

  if (target.surface === "desktop") {
    steps.push({
      tool: "check_desktop_permissions",
      focus: "Confirm the host can capture screenshots and drive the approved desktop app.",
      reason: "Desktop capture only works after permission preflight passes.",
    });
    steps.push({
      tool: "record_desktop_trace",
      focus: "Record the shortest desktop flow that proves the main user outcome.",
      reason: flowCount ? "State coverage is the likely gap." : "A desktop flow is still missing.",
    });
  } else {
    if (!pageCount || !screenshotCount) {
      steps.push({
        tool: "capture_web_reference",
        focus: "Capture the key page or entry screen with copy and screenshot baseline.",
        reason: "The static surface is still under-documented.",
      });
    }
    if (!flowCount || missingEvidence.some((item) => item.includes("State coverage"))) {
      steps.push({
        tool: "record_web_trace",
        focus: "Record the primary user journey and at least one state change.",
        reason: "Interactive coverage is still thin.",
      });
    }
  }

  steps.push({
    tool: "summarize_trace",
    focus: "Check whether the latest capture actually closed the evidence gap.",
    reason: "Do not move on with a thin trace.",
  });
  steps.push({
    tool: "generate_fixtures",
    focus: "Turn the captured evidence into a compact verification checklist.",
    reason: "This becomes the next build gate.",
  });

  return steps.slice(0, 4);
}

function inferTargetSurface(payload, session, summary) {
  const explicit = String(payload.targetSurface || "").trim().toLowerCase();
  if (explicit === "web" || explicit === "desktop" || explicit === "mixed") {
    return explicit;
  }

  const sessionSource = coerceObject(session.source);
  const pageUrls = (Array.isArray(session.pages) ? session.pages : []).map((page) => String(page.url || ""));
  if (sessionSource.url || pageUrls.some(Boolean) || coerceObject(summary.source).url) {
    return "web";
  }

  const summaryTargets = uniqueStrings(Array.isArray(summary.targets) ? summary.targets : []).join(" ").toLowerCase();
  if (/(window|menu|shortcut|textedit|finder|desktop|native)/.test(summaryTargets)) {
    return "desktop";
  }

  return "web";
}

function priorityItem(weight, kind, target, action) {
  return {
    weight,
    kind,
    target,
    action,
  };
}
