import { join, resolve } from "node:path";
import { buildFixturePlan } from "./fixture.js";
import { buildCloneSpec } from "./spec.js";
import { generatePlaywrightFixturesFromInput } from "./playwright.js";
import { loadSession } from "./reference.js";
import { ensureDir, writeJson, writeText } from "./common.js";

export async function scaffoldCloneLoop(sessionInput, outputDir, options = {}) {
  const { session, sessionPath } = await loadSession(sessionInput);
  const root = resolve(outputDir || process.cwd(), session.id || "clone-loop");
  const referenceDir = join(root, "reference");
  const generatedDir = join(root, "generated");

  await ensureDir(referenceDir);
  await ensureDir(generatedDir);

  const spec = buildCloneSpec(session);
  const fixtures = buildFixturePlan(session, {
    sourceKind: "session",
    derivedFrom: sessionPath,
  });
  const candidateManifest = buildCandidateManifestTemplate(session);

  const referenceSessionPath = join(referenceDir, "session.json");
  const specMarkdownPath = join(referenceDir, "clone-spec.md");
  const specJsonPath = join(referenceDir, "clone-spec.json");
  const fixtureMarkdownPath = join(referenceDir, "fixture-plan.md");
  const fixtureJsonPath = join(referenceDir, "fixture-plan.json");
  const candidateManifestPath = join(root, "candidate-manifest.json");
  const guidePath = join(root, "CLONE_LOOP.md");
  const promptPath = join(root, "replication-prompt.md");

  await writeJson(referenceSessionPath, session);
  await writeText(specMarkdownPath, spec.markdown);
  await writeJson(specJsonPath, spec.json);
  await writeText(fixtureMarkdownPath, fixtures.markdown);
  await writeJson(fixtureJsonPath, fixtures.json);
  await writeJson(candidateManifestPath, candidateManifest);

  const playwright = await generatePlaywrightFixturesFromInput(
    { session },
    join(root, "playwright"),
    {
      candidateBaseUrl: options.candidateBaseUrl,
    },
  );

  await writeText(
    guidePath,
    [
      "# Clone Loop",
      "",
      "Use this directory as the working packet for an implementation loop.",
      "",
      "## Order",
      "",
      "1. Read `reference/clone-spec.md`.",
      "2. Build the candidate app.",
      "3. Fill in `candidate-manifest.json` with the pages, flows, and screenshot paths you actually implemented.",
      "4. Run screenshot diff and verification against the reference session.",
      "5. Run the generated Playwright suite and fix the gaps.",
      "",
      "## Useful commands",
      "",
      `- spec source: ${referenceSessionPath}`,
      `- fixture plan: ${fixtureJsonPath}`,
      `- playwright tests: ${playwright.testFilePath}`,
      options.devCommand ? `- dev command: ${String(options.devCommand)}` : "- dev command: add your own project command here",
      "",
      "## Verification",
      "",
      "- `node ./src/cli.js diff <reference-session> <candidate-manifest>`",
      "- `node ./src/cli.js verify <reference-session> <candidate-manifest>`",
      "- `npx playwright test` inside the generated `playwright/` folder",
      "",
    ].join("\n"),
  );

  await writeText(promptPath, buildReplicationPrompt(session, options));

  return {
    root,
    files: [
      referenceSessionPath,
      specMarkdownPath,
      specJsonPath,
      fixtureMarkdownPath,
      fixtureJsonPath,
      candidateManifestPath,
      guidePath,
      promptPath,
      playwright.testFilePath,
      playwright.configPath,
      playwright.readmePath,
    ],
  };
}

function buildCandidateManifestTemplate(session) {
  return {
    summary: `Candidate manifest for ${session.source?.name || session.id}`,
    pages: (Array.isArray(session.pages) ? session.pages : []).map((page) => ({
      id: page.id,
      title: page.title,
      components: page.components,
      states: page.states,
      copy: page.copy,
      screenshots: (Array.isArray(page.screenshots) ? page.screenshots : []).map((shot) => ({
        label: shot.label,
        path: `./screenshots/${page.id}-${shot.label || "default"}.png`,
      })),
    })),
    flows: (Array.isArray(session.flows) ? session.flows : []).map((flow) => ({
      name: flow.name,
      implemented: false,
      notes: "",
    })),
  };
}

function buildReplicationPrompt(session, options = {}) {
  const pageNames = (Array.isArray(session.pages) ? session.pages : [])
    .map((page) => page.title || page.id)
    .join(", ");
  const flowNames = (Array.isArray(session.flows) ? session.flows : [])
    .map((flow) => flow.name)
    .join(", ");

  return [
    `# Replication Prompt: ${session.source?.name || session.id}`,
    "",
    "Recreate the reference product using the files in this directory.",
    "",
    "## What matters",
    "",
    `- pages: ${pageNames || "none recorded"}`,
    `- flows: ${flowNames || "none recorded"}`,
    "- preserve the captured copy, states, and visual hierarchy",
    "- do not treat the screenshots as decoration; treat them as acceptance criteria",
    "",
    "## Working files",
    "",
    "- `reference/clone-spec.md`",
    "- `reference/fixture-plan.md`",
    "- `candidate-manifest.json`",
    "- `playwright/tests/ose.generated.spec.ts`",
    "",
    options.candidateBaseUrl ? `Candidate base URL: ${String(options.candidateBaseUrl)}` : "",
    options.devCommand ? `Suggested dev command: ${String(options.devCommand)}` : "",
    "",
  ]
    .filter(Boolean)
    .join("\n");
}
