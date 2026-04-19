import { dirname, resolve } from "node:path";
import { readJson } from "./common.js";
import { normalizeReferenceSession } from "./session.js";

export async function captureReferenceSession(inputPath, outputRoot) {
  const source = await readJson(resolve(inputPath));
  return captureReferenceData(source, outputRoot || dirname(inputPath));
}

export async function captureReferenceData(input, outputRoot) {
  const root = resolve(outputRoot || process.cwd());
  return normalizeReferenceSession(input, root);
}
