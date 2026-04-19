import { join, resolve } from "node:path";
import { ensureDir, readJson, writeJson, writeText } from "./common.js";

export async function scaffoldWorkspace(targetDir, examplesDir) {
  const root = resolve(targetDir);
  await ensureDir(root);

  const referenceTemplate = await readJson(join(examplesDir, "reference-session.json"));
  const candidateTemplate = await readJson(join(examplesDir, "candidate-manifest.json"));
  const traceTemplate = await readJson(join(examplesDir, "computer-use-trace.json"));
  const fixtureRequestTemplate = await readJson(join(examplesDir, "fixture-request.json"));

  const referencePath = join(root, "reference-session.json");
  const candidatePath = join(root, "candidate-manifest.json");
  const tracePath = join(root, "computer-use-trace.json");
  const fixtureRequestPath = join(root, "fixture-request.json");
  const readmePath = join(root, "README.md");

  await writeJson(referencePath, referenceTemplate);
  await writeJson(candidatePath, candidateTemplate);
  await writeJson(tracePath, traceTemplate);
  await writeJson(fixtureRequestPath, fixtureRequestTemplate);
  await writeText(
    readmePath,
    [
      "# OpenSource Everything Workspace",
      "",
      "1. Edit `computer-use-trace.json` or `reference-session.json` with your captured evidence.",
      "2. Run `ose summarize-trace ./computer-use-trace.json --out ./output` to see what the trace already covers.",
      "3. Run `ose generate-fixtures --trace ./computer-use-trace.json --out ./output` to create reusable test probes.",
      "4. Run `ose import-trace ./computer-use-trace.json --out ./output` or `ose capture ./reference-session.json --out ./output`.",
      "5. Run `ose spec ./output/<session-id>` to generate the clone spec.",
      "6. Add implementation evidence to `candidate-manifest.json`.",
      "7. Run `ose diff` and `ose verify` against the generated session.",
      "",
    ].join("\n"),
  );

  return {
    root,
    files: [referencePath, candidatePath, tracePath, fixtureRequestPath, readmePath],
  };
}
