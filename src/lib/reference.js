import { dirname, join, resolve } from "node:path";
import { readJson } from "./common.js";

export async function loadSession(sessionInput) {
  const resolved = resolve(sessionInput);
  const sessionPath = resolved.endsWith(".json") ? resolved : join(resolved, "session.json");
  const session = await readJson(sessionPath);
  return {
    session,
    sessionPath,
    sessionDir: resolved.endsWith(".json") ? dirname(resolved) : resolved,
  };
}

export function findCandidatePage(candidate, page) {
  const candidatePages = Array.isArray(candidate.pages) ? candidate.pages : [];
  return (
    candidatePages.find((item) => item.id === page.id) ||
    candidatePages.find((item) => item.title === page.title) ||
    null
  );
}
