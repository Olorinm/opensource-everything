import { join, resolve } from "node:path";
import { loadSession } from "./reference.js";
import { writeJson } from "./common.js";

export async function generateCandidateManifestFromSession(sessionInput, outputPath) {
  const { session, sessionDir } = await loadSession(sessionInput);
  const manifest = buildCandidateManifestFromSession(session);
  const manifestPath = outputPath
    ? resolve(outputPath)
    : join(sessionDir, "candidate-manifest.generated.json");
  await writeJson(manifestPath, manifest);
  return {
    manifest,
    manifestPath,
  };
}

export function buildCandidateManifestFromSession(session) {
  return {
    summary: session.summary || `Candidate manifest derived from ${session.source?.name || session.id}`,
    pages: (Array.isArray(session.pages) ? session.pages : []).map((page) => ({
      id: page.id,
      title: page.title,
      components: page.components,
      states: page.states,
      copy: page.copy,
      screenshots: (Array.isArray(page.screenshots) ? page.screenshots : []).map((shot) => ({
        path: shot.path,
        label: shot.label,
        sha256: shot.metadata?.sha256 || "",
      })),
    })),
    flows: (Array.isArray(session.flows) ? session.flows : []).map((flow) => ({
      name: flow.name,
      implemented: true,
      notes: flow.goal || "",
    })),
  };
}
