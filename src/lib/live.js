import { join, resolve } from "node:path";
import { captureWebReference } from "./web.js";
import { generateCandidateManifestFromSession } from "./manifest.js";
import { diffReferenceArtifacts } from "./diff.js";
import { verifyClone } from "./verify.js";
import { writeJson, writeText } from "./common.js";

export async function verifyLiveWebClone(referenceInput, candidateUrl, outputDir, options = {}) {
  const root = resolve(outputDir || process.cwd());
  const captureRoot = join(root, "candidate-live");
  const capture = await captureWebReference(
    {
      url: candidateUrl,
      name: options.name || `candidate-${candidateUrl}`,
    },
    captureRoot,
  );

  const manifest = await generateCandidateManifestFromSession(
    capture.sessionPath,
    join(capture.sessionDir, "candidate-manifest.generated.json"),
  );

  const diff = await diffReferenceArtifacts(referenceInput, manifest.manifestPath, root);
  const verification = await verifyClone(referenceInput, manifest.manifestPath, root);

  const summary = {
    candidateUrl,
    captureSessionPath: capture.sessionPath,
    candidateManifestPath: manifest.manifestPath,
    diffScore: diff.report.score,
    verificationScore: verification.report.score,
    gaps: verification.report.gaps,
  };

  const markdownPath = join(root, "live-web-verify.md");
  const jsonPath = join(root, "live-web-verify.json");

  await writeText(
    markdownPath,
    [
      `# Live Web Verify`,
      "",
      `- candidateUrl: ${candidateUrl}`,
      `- captureSessionPath: ${capture.sessionPath}`,
      `- candidateManifestPath: ${manifest.manifestPath}`,
      `- diffScore: ${diff.report.score}%`,
      `- verificationScore: ${verification.report.score}%`,
      "",
      "## Gaps",
      summary.gaps.length ? summary.gaps.map((gap) => `- ${gap}`).join("\n") : "- None detected.",
      "",
    ].join("\n"),
  );
  await writeJson(jsonPath, summary);

  return {
    summary,
    markdownPath,
    jsonPath,
    capture,
    manifest,
    diff,
    verification,
  };
}
