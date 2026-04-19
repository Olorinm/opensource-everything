import { dirname, join, resolve } from "node:path";
import { readJson, writeJson, writeText } from "./common.js";
import { buildArtifactDiff } from "./diff.js";
import { findCandidatePage, loadSession } from "./reference.js";

export async function verifyClone(referenceInput, candidateManifestInput, outputDir) {
  const { session, sessionDir } = await loadSession(referenceInput);
  const candidateManifestPath = resolve(candidateManifestInput);
  const candidate = await readJson(candidateManifestPath);
  const targetDir = resolve(outputDir || sessionDir);
  const report = await buildVerificationReport(session, candidate, {
    candidateBaseDir: dirname(candidateManifestPath),
    outputDir: targetDir,
  });
  const markdownPath = join(targetDir, "verification-report.md");
  const jsonPath = join(targetDir, "verification-report.json");
  await writeText(markdownPath, report.markdown);
  await writeJson(jsonPath, report.json);
  return { report, markdownPath, jsonPath };
}

export async function buildVerificationReport(session, candidate, options = {}) {
  const referencePages = session.pages;
  const pageFindings = [];
  let earned = 0;
  let possible = 0;

  for (const page of referencePages) {
    const candidatePage = findCandidatePage(candidate, page);
    const finding = {
      page: page.id,
      title: page.title,
      found: Boolean(candidatePage),
      missingComponents: [],
      missingStates: [],
      missingCopy: [],
      screenshotStatuses: [],
    };
    possible += 1;
    if (candidatePage) {
      earned += 1;
      const candidateComponents = new Set(normalizeStrings(candidatePage.components));
      const candidateStates = new Set(normalizeStrings(candidatePage.states));
      const candidateCopy = new Set(normalizeStrings(candidatePage.copy));
      finding.missingComponents = page.components.filter((item) => !candidateComponents.has(item));
      finding.missingStates = page.states.filter((item) => !candidateStates.has(item));
      finding.missingCopy = page.copy.filter((item) => !candidateCopy.has(item));
      possible += page.components.length + page.states.length + page.copy.length;
      earned += page.components.length - finding.missingComponents.length;
      earned += page.states.length - finding.missingStates.length;
      earned += page.copy.length - finding.missingCopy.length;
    }
    pageFindings.push(finding);
  }

  const referenceFlows = session.flows;
  const candidateFlows = Array.isArray(candidate.flows) ? candidate.flows : [];
  const flowFindings = referenceFlows.map((flow) => {
    const candidateFlow = candidateFlows.find((item) => item.name === flow.name);
    possible += 1;
    if (candidateFlow && candidateFlow.implemented) {
      earned += 1;
      return {
        name: flow.name,
        implemented: true,
        notes: String(candidateFlow.notes || ""),
      };
    }
    return {
      name: flow.name,
      implemented: false,
      notes: String(candidateFlow?.notes || ""),
    };
  });

  const artifactDiff = await buildArtifactDiff(session, candidate, options);
  possible += artifactDiff.json.pageFindings.reduce(
    (sum, page) => sum + page.screenshots.length,
    0,
  );
  earned += artifactDiff.json.pageFindings.reduce(
    (sum, page) =>
      sum +
      page.screenshots.reduce(
        (pageSum, shot) => pageSum + Number(shot.similarity || 0) / 100,
        0,
      ),
    0,
  );

  for (const pageFinding of pageFindings) {
    const screenshotPage = artifactDiff.json.pageFindings.find(
      (item) => item.page === pageFinding.page,
    );
    pageFinding.screenshotStatuses = screenshotPage
      ? screenshotPage.screenshots.map(
          (shot) => `${shot.referenceLabel}: ${shot.status} (${shot.similarity}%)`,
        )
      : [];
  }

  const score = possible === 0 ? 100 : Math.round((earned / possible) * 100);
  const gaps = [
    ...pageFindings.flatMap((finding) =>
      [
        !finding.found ? `Missing page: ${finding.page}` : "",
        ...finding.missingComponents.map((item) => `Missing component on ${finding.page}: ${item}`),
        ...finding.missingStates.map((item) => `Missing state on ${finding.page}: ${item}`),
        ...finding.missingCopy.map((item) => `Missing copy on ${finding.page}: ${item}`),
        ...finding.screenshotStatuses
          .filter((item) => !item.includes(": exact "))
          .map((item) => `Screenshot mismatch on ${finding.page}: ${item}`),
      ].filter(Boolean),
    ),
    ...flowFindings.filter((flow) => !flow.implemented).map((flow) => `Missing flow: ${flow.name}`),
  ];

  const markdown = [
    `# Verification Report: ${session.source.name || session.id}`,
    "",
    `## Score`,
    `${score}%`,
    "",
    "## Page Findings",
    ...pageFindings.map((finding) =>
      [
        `### ${finding.title || finding.page}`,
        `- found: ${finding.found ? "yes" : "no"}`,
        `- missing components: ${finding.missingComponents.length ? finding.missingComponents.join(", ") : "none"}`,
        `- missing states: ${finding.missingStates.length ? finding.missingStates.join(", ") : "none"}`,
        `- missing copy: ${finding.missingCopy.length ? finding.missingCopy.join(" | ") : "none"}`,
        `- screenshots: ${finding.screenshotStatuses.length ? finding.screenshotStatuses.join(" | ") : "none"}`,
      ].join("\n"),
    ),
    "",
    "## Flow Findings",
    ...flowFindings.map((flow) =>
      [`### ${flow.name}`, `- implemented: ${flow.implemented ? "yes" : "no"}`, flow.notes ? `- notes: ${flow.notes}` : ""]
        .filter(Boolean)
        .join("\n"),
    ),
    "",
    "## Gaps",
    gaps.length ? gaps.map((gap) => `- ${gap}`).join("\n") : "- No gaps detected by the manifest-based verifier.",
    "",
  ].join("\n");

  return {
    score,
    gaps,
    markdown,
    json: {
      score,
      pageFindings,
      flowFindings,
      artifactDiff: artifactDiff.json,
      gaps,
    },
  };
}

function normalizeStrings(value) {
  return Array.isArray(value) ? value.map((item) => String(item).trim()).filter(Boolean) : [];
}
