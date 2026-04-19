#!/usr/bin/env node

import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  captureReferenceData,
  captureReferenceSession,
  captureWebReference,
  checkDesktopAutomationPermissions,
  diffReferenceArtifacts,
  recordDesktopTraceFromInput,
  recordWebTraceFromInput,
  scaffoldEditorLoop,
  generateCandidateManifestFromSession,
  generatePlaywrightFixturesFromInput,
  generateFixturesFromInput,
  generateCloneSpec,
  getToolCatalog,
  importComputerUseResearch,
  planCaptureFromInput,
  planRepairFromInput,
  loadSkills,
  verifyEditorClone,
  verifyLiveWebClone,
  scaffoldCloneLoop,
  scaffoldWorkspace,
  summarizeTraceInput,
  verifyClone,
} from "./index.js";
import { readJson } from "./lib/common.js";
import { startMcpServer } from "./mcp/server.js";

const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_SKILLS_ROOT = resolve(PROJECT_ROOT, "skills");
const DEFAULT_EXAMPLES_ROOT = resolve(PROJECT_ROOT, "examples");

async function main(argv) {
  const args = argv.slice(2);
  const command = args[0];

  if (!command || command === "--help" || command === "-h" || command === "help") {
    printHelp();
    return;
  }

  switch (command) {
    case "tools":
      await runTools(args.slice(1));
      return;
    case "skills":
      await runSkills(args.slice(1));
      return;
    case "init":
      await runInit(args.slice(1));
      return;
    case "import-trace":
      await runImportTrace(args.slice(1));
      return;
    case "capture":
      await runCapture(args.slice(1));
      return;
    case "capture-web":
      await runCaptureWeb(args.slice(1));
      return;
    case "record-web-trace":
      await runRecordWebTrace(args.slice(1));
      return;
    case "record-desktop-trace":
      await runRecordDesktopTrace(args.slice(1));
      return;
    case "check-desktop-permissions":
      await runCheckDesktopPermissions();
      return;
    case "plan-capture":
      await runPlanCapture(args.slice(1));
      return;
    case "summarize-trace":
      await runSummarizeTrace(args.slice(1));
      return;
    case "generate-fixtures":
      await runGenerateFixtures(args.slice(1));
      return;
    case "emit-playwright":
      await runEmitPlaywright(args.slice(1));
      return;
    case "candidate-manifest":
      await runCandidateManifest(args.slice(1));
      return;
    case "verify-live-web":
      await runVerifyLiveWeb(args.slice(1));
      return;
    case "spec":
      await runSpec(args.slice(1));
      return;
    case "diff":
      await runDiff(args.slice(1));
      return;
    case "verify":
      await runVerify(args.slice(1));
      return;
    case "plan-repair":
      await runPlanRepair(args.slice(1));
      return;
    case "clone-loop":
      await runCloneLoop(args.slice(1));
      return;
    case "editor-loop":
      await runEditorLoop(args.slice(1));
      return;
    case "verify-editor":
      await runVerifyEditor(args.slice(1));
      return;
    case "serve-mcp":
      await runServeMcp();
      return;
    default:
      throw new Error(`Unknown command: ${command}`);
  }
}

async function runTools(args) {
  const asJson = args.includes("--json");
  const catalog = getToolCatalog();
  if (asJson) {
    console.log(JSON.stringify(catalog, null, 2));
    return;
  }

  for (const tool of catalog) {
    console.log(`- ${tool.name}: ${tool.description}`);
  }
}

async function runSkills(args) {
  const asJson = args.includes("--json");
  const root = resolveOptionalValue(args, "--root") ?? DEFAULT_SKILLS_ROOT;
  const skills = await loadSkills(root);
  if (asJson) {
    console.log(JSON.stringify(skills, null, 2));
    return;
  }

  for (const skill of skills) {
    console.log(`- ${skill.name}: ${skill.description}`);
  }
}

async function runInit(args) {
  const targetDir = resolve(args[0] ?? resolve(process.cwd(), "output", "demo-session"));
  const result = await scaffoldWorkspace(targetDir, DEFAULT_EXAMPLES_ROOT);
  console.log(`Scaffolded workspace: ${result.root}`);
  for (const file of result.files) {
    console.log(`- ${file}`);
  }
}

async function runImportTrace(args) {
  const input = args[0];
  if (!input) {
    throw new Error("import-trace requires a trace JSON file");
  }
  const outDir = resolveOptionalValue(args, "--out") ?? resolve(process.cwd(), "output");
  const payload = await readJson(resolve(input));
  const result = await importComputerUseResearch(payload, resolve(outDir));
  console.log(`Imported trace into session: ${result.sessionPath}`);
}

async function runCapture(args) {
  const input = args[0];
  if (!input) {
    throw new Error("capture requires an input JSON file");
  }
  const outDir = resolveOptionalValue(args, "--out") ?? resolve(process.cwd(), "output");
  const resolvedInput = resolve(input);
  const payload = await readJson(resolvedInput);
  const result = payload?.source
    ? await captureReferenceData(payload, resolve(outDir))
    : await captureReferenceSession(resolvedInput, resolve(outDir));
  console.log(`Captured session: ${result.sessionPath}`);
}

async function runCaptureWeb(args) {
  const url = resolveOptionalValue(args, "--url");
  const htmlPath = resolveOptionalValue(args, "--html");
  const htmlInline = resolveOptionalValue(args, "--html-inline");
  if (!url && !htmlPath && !htmlInline) {
    throw new Error("capture-web requires --url <url>, --html <file>, or --html-inline <html>");
  }
  const outDir = resolveOptionalValue(args, "--out") ?? resolve(process.cwd(), "output");
  const name = resolveOptionalValue(args, "--name");
  const screenshotPath = resolveOptionalValue(args, "--screenshot");
  const result = await captureWebReference(
    {
      url,
      htmlPath: htmlPath ? resolve(htmlPath) : undefined,
      html: htmlInline,
      name,
      screenshotPath: screenshotPath ? resolve(screenshotPath) : undefined,
    },
    resolve(outDir),
  );
  console.log(`Captured web session: ${result.sessionPath}`);
}

async function runRecordWebTrace(args) {
  const planPath = resolveOptionalValue(args, "--plan");
  const startUrl = resolveOptionalValue(args, "--url");
  if (!planPath && !startUrl) {
    throw new Error("record-web-trace requires --plan <plan.json> or --url <url> with inline plan data");
  }
  const outDir = resolveOptionalValue(args, "--out") ?? resolve(process.cwd(), "output", "web-trace");
  const result = await recordWebTraceFromInput(
    {
      startUrl,
      planPath: planPath ? resolve(planPath) : undefined,
    },
    resolve(outDir),
  );
  console.log(`Recorded web trace: ${result.tracePath}`);
  console.log(`Generated session: ${result.sessionPath}`);
  console.log(`Playwright trace: ${result.playwrightTracePath}`);
}

async function runRecordDesktopTrace(args) {
  const planPath = resolveOptionalValue(args, "--plan");
  if (!planPath) {
    throw new Error("record-desktop-trace requires --plan <plan.json>");
  }
  const outDir = resolveOptionalValue(args, "--out") ?? resolve(process.cwd(), "output", "desktop-trace");
  const allowedApps = resolveRepeatedValues(args, "--allow-app");
  const approvedApps = resolveRepeatedValues(args, "--approve-app");
  const result = await recordDesktopTraceFromInput(
    {
      planPath: resolve(planPath),
      allowedApps,
      approvedApps,
    },
    resolve(outDir),
  );
  console.log(`Recorded desktop trace: ${result.tracePath}`);
  console.log(`Generated session: ${result.sessionPath}`);
}

async function runCheckDesktopPermissions() {
  const result = await checkDesktopAutomationPermissions();
  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) {
    process.exitCode = 1;
  }
}

async function runPlanCapture(args) {
  const sessionPath = resolveOptionalValue(args, "--session");
  const tracePath = resolveOptionalValue(args, "--trace");
  const summaryPath = resolveOptionalValue(args, "--summary");
  if (!sessionPath && !tracePath && !summaryPath) {
    throw new Error("plan-capture requires --session <session>, --trace <trace>, or --summary <trace-summary.json>");
  }
  const outDir = resolveOptionalValue(args, "--out");
  const result = await planCaptureFromInput(
    {
      sessionPath: sessionPath ? resolve(sessionPath) : undefined,
      tracePath: tracePath ? resolve(tracePath) : undefined,
      summaryPath: summaryPath ? resolve(summaryPath) : undefined,
      goal: resolveOptionalValue(args, "--goal"),
      targetSurface: resolveOptionalValue(args, "--surface"),
      productName: resolveOptionalValue(args, "--product"),
      url: resolveOptionalValue(args, "--url"),
    },
    outDir ? resolve(outDir) : undefined,
  );
  if (result.markdownPath) {
    console.log(`Wrote capture plan markdown: ${result.markdownPath}`);
    console.log(`Wrote capture plan JSON: ${result.jsonPath}`);
    return;
  }
  console.log(result.markdown);
}

async function runSummarizeTrace(args) {
  const input = args[0];
  if (!input) {
    throw new Error("summarize-trace requires a trace JSON file");
  }
  const outDir = resolveOptionalValue(args, "--out");
  const result = await summarizeTraceInput(resolve(input), outDir ? resolve(outDir) : undefined);
  if (result.markdownPath) {
    console.log(`Wrote trace summary markdown: ${result.markdownPath}`);
    console.log(`Wrote trace summary JSON: ${result.jsonPath}`);
    return;
  }
  console.log(result.markdown);
}

async function runGenerateFixtures(args) {
  const tracePath = resolveOptionalValue(args, "--trace");
  const sessionPath = resolveOptionalValue(args, "--session");
  if (!tracePath && !sessionPath) {
    throw new Error("generate-fixtures requires --trace <trace.json> or --session <session-dir|session.json>");
  }
  const outDir = resolveOptionalValue(args, "--out");
  const result = await generateFixturesFromInput(
    {
      tracePath: tracePath ? resolve(tracePath) : undefined,
      sessionPath: sessionPath ? resolve(sessionPath) : undefined,
    },
    outDir ? resolve(outDir) : undefined,
  );
  if (result.markdownPath) {
    console.log(`Wrote fixture plan markdown: ${result.markdownPath}`);
    console.log(`Wrote fixture plan JSON: ${result.jsonPath}`);
    return;
  }
  console.log(result.markdown);
}

async function runEmitPlaywright(args) {
  const fixturePlanPath = resolveOptionalValue(args, "--fixture-plan");
  const tracePath = resolveOptionalValue(args, "--trace");
  const sessionPath = resolveOptionalValue(args, "--session");
  if (!fixturePlanPath && !tracePath && !sessionPath) {
    throw new Error("emit-playwright requires --fixture-plan <plan.json>, --trace <trace.json>, or --session <session>");
  }
  const outDir = resolveOptionalValue(args, "--out") ?? resolve(process.cwd(), "output", "playwright");
  const candidateBaseUrl = resolveOptionalValue(args, "--candidate-base-url");
  const result = await generatePlaywrightFixturesFromInput(
    {
      fixturePlanPath: fixturePlanPath ? resolve(fixturePlanPath) : undefined,
      tracePath: tracePath ? resolve(tracePath) : undefined,
      sessionPath: sessionPath ? resolve(sessionPath) : undefined,
    },
    resolve(outDir),
    {
      candidateBaseUrl,
    },
  );
  console.log(`Wrote Playwright tests: ${result.testFilePath}`);
  console.log(`Wrote Playwright config: ${result.configPath}`);
}

async function runCandidateManifest(args) {
  const input = args[0];
  if (!input) {
    throw new Error("candidate-manifest requires a session directory or session.json path");
  }
  const outPath = resolveOptionalValue(args, "--out");
  const result = await generateCandidateManifestFromSession(
    resolve(input),
    outPath ? resolve(outPath) : undefined,
  );
  console.log(`Wrote candidate manifest: ${result.manifestPath}`);
}

async function runVerifyLiveWeb(args) {
  const referenceInput = args[0];
  const candidateUrl = resolveOptionalValue(args, "--candidate-url");
  if (!referenceInput || !candidateUrl) {
    throw new Error("verify-live-web requires <reference-session> --candidate-url <url>");
  }
  const outDir = resolveOptionalValue(args, "--out") ?? resolve(process.cwd(), "output", "live-web-verify");
  const name = resolveOptionalValue(args, "--name");
  const result = await verifyLiveWebClone(resolve(referenceInput), candidateUrl, resolve(outDir), {
    name,
  });
  console.log(`Wrote live web verify markdown: ${result.markdownPath}`);
  console.log(`Wrote live web verify JSON: ${result.jsonPath}`);
  console.log(`Diff score: ${result.summary.diffScore}%`);
  console.log(`Verification score: ${result.summary.verificationScore}%`);
}

async function runSpec(args) {
  const input = args[0];
  if (!input) {
    throw new Error("spec requires a session directory or session.json path");
  }
  const outDir = resolveOptionalValue(args, "--out");
  const result = await generateCloneSpec(resolve(input), outDir ? resolve(outDir) : undefined);
  console.log(`Wrote spec markdown: ${result.markdownPath}`);
  console.log(`Wrote spec JSON: ${result.jsonPath}`);
}

async function runDiff(args) {
  const referenceInput = args[0];
  const candidateInput = args[1];
  if (!referenceInput || !candidateInput) {
    throw new Error("diff requires <reference-session> <candidate-manifest>");
  }
  const outDir = resolveOptionalValue(args, "--out");
  const result = await diffReferenceArtifacts(
    resolve(referenceInput),
    resolve(candidateInput),
    outDir ? resolve(outDir) : undefined,
  );
  console.log(`Wrote artifact diff markdown: ${result.markdownPath}`);
  console.log(`Wrote artifact diff JSON: ${result.jsonPath}`);
  console.log(`Visual screenshot score: ${result.report.score}%`);
}

async function runVerify(args) {
  const referenceInput = args[0];
  const candidateInput = args[1];
  if (!referenceInput || !candidateInput) {
    throw new Error("verify requires <reference-session> <candidate-manifest>");
  }
  const outDir = resolveOptionalValue(args, "--out");
  const result = await verifyClone(
    resolve(referenceInput),
    resolve(candidateInput),
    outDir ? resolve(outDir) : undefined,
  );
  console.log(`Wrote verification markdown: ${result.markdownPath}`);
  console.log(`Wrote verification JSON: ${result.jsonPath}`);
  console.log(`Overall score: ${result.report.score}%`);
}

async function runPlanRepair(args) {
  const verificationPath = resolveOptionalValue(args, "--verification");
  const referenceInput = resolveOptionalValue(args, "--reference");
  const candidateInput = resolveOptionalValue(args, "--candidate");
  if (!verificationPath && !(referenceInput && candidateInput)) {
    throw new Error(
      "plan-repair requires --verification <report.json> or both --reference <session> and --candidate <manifest>",
    );
  }
  const outDir = resolveOptionalValue(args, "--out");
  const result = await planRepairFromInput(
    {
      verificationReportPath: verificationPath ? resolve(verificationPath) : undefined,
      referenceSession: referenceInput ? resolve(referenceInput) : undefined,
      candidateManifest: candidateInput ? resolve(candidateInput) : undefined,
    },
    outDir ? resolve(outDir) : undefined,
  );
  if (result.markdownPath) {
    console.log(`Wrote repair plan markdown: ${result.markdownPath}`);
    console.log(`Wrote repair plan JSON: ${result.jsonPath}`);
    return;
  }
  console.log(result.markdown);
}

async function runCloneLoop(args) {
  const input = args[0];
  if (!input) {
    throw new Error("clone-loop requires a session directory or session.json path");
  }
  const outDir = resolveOptionalValue(args, "--out") ?? resolve(process.cwd(), "output", "clone-loop");
  const candidateBaseUrl = resolveOptionalValue(args, "--candidate-base-url");
  const devCommand = resolveOptionalValue(args, "--dev-command");
  const result = await scaffoldCloneLoop(resolve(input), resolve(outDir), {
    candidateBaseUrl,
    devCommand,
  });
  console.log(`Created clone loop packet: ${result.root}`);
  for (const file of result.files) {
    console.log(`- ${file}`);
  }
}

async function runEditorLoop(args) {
  const outDir = resolveOptionalValue(args, "--out") ?? resolve(process.cwd(), "output");
  const productName = resolveOptionalValue(args, "--product");
  const result = await scaffoldEditorLoop(resolve(outDir), {
    productName,
  });
  console.log(`Created editor loop packet: ${result.root}`);
  for (const file of result.files) {
    console.log(`- ${file}`);
  }
}

async function runVerifyEditor(args) {
  const fixturesPath = args[0];
  const candidateManifest = args[1];
  if (!fixturesPath || !candidateManifest) {
    throw new Error("verify-editor requires <editor-fixtures.json> <candidate-editor-manifest.json>");
  }
  const outDir = resolveOptionalValue(args, "--out") ?? resolve(process.cwd(), "output", "editor-verify");
  const result = await verifyEditorClone(resolve(fixturesPath), resolve(candidateManifest), resolve(outDir));
  console.log(`Wrote editor verification markdown: ${result.markdownPath}`);
  console.log(`Wrote editor verification JSON: ${result.jsonPath}`);
  console.log(`Score: ${result.report.score}%`);
}

async function runServeMcp() {
  await startMcpServer();
}

function resolveOptionalValue(args, flag) {
  const index = args.indexOf(flag);
  if (index === -1) {
    return undefined;
  }
  return args[index + 1];
}

function resolveRepeatedValues(args, flag) {
  const values = [];
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === flag && args[index + 1]) {
      values.push(args[index + 1]);
      index += 1;
    }
  }
  return values;
}

function printHelp() {
  console.log(`opensource-everything

Usage:
  ose tools [--json]
  ose skills [--json] [--root <skills-dir>]
  ose init [target-dir]
  ose import-trace <computer-use-trace.json> [--out <output-dir>]
  ose capture <reference-session.json> [--out <output-dir>]
  ose capture-web (--url <url> | --html <file> | --html-inline <html>) [--name <name>] [--screenshot <png>] [--out <output-dir>]
  ose record-web-trace --plan <plan.json> [--url <url>] [--out <output-dir>]
  ose record-desktop-trace --plan <plan.json> [--allow-app <name>]... [--approve-app <name>]... [--out <output-dir>]
  ose check-desktop-permissions
  ose plan-capture (--session <session-dir|session.json> | --trace <trace.json> | --summary <trace-summary.json>) [--goal <goal>] [--surface <web|desktop|mixed>] [--product <name>] [--url <url>] [--out <output-dir>]
  ose summarize-trace <trace.json> [--out <output-dir>]
  ose generate-fixtures --trace <trace.json> [--out <output-dir>]
  ose generate-fixtures --session <session-dir|session.json> [--out <output-dir>]
  ose emit-playwright (--fixture-plan <plan.json> | --trace <trace.json> | --session <session-dir|session.json>) [--candidate-base-url <url>] [--out <output-dir>]
  ose candidate-manifest <session-dir|session.json> [--out <file>]
  ose verify-live-web <reference-session> --candidate-url <url> [--name <name>] [--out <output-dir>]
  ose spec <session-dir|session.json> [--out <output-dir>]
  ose diff <session-dir|session.json> <candidate-manifest.json> [--out <output-dir>]
  ose verify <session-dir|session.json> <candidate-manifest.json> [--out <output-dir>]
  ose plan-repair (--verification <report.json> | --reference <session-dir|session.json> --candidate <candidate-manifest.json>) [--out <output-dir>]
  ose clone-loop <session-dir|session.json> [--candidate-base-url <url>] [--dev-command <command>] [--out <output-dir>]
  ose editor-loop [--product <name>] [--out <output-dir>]
  ose verify-editor <editor-fixtures.json> <candidate-editor-manifest.json> [--out <output-dir>]
  ose serve-mcp
`);
}

main(process.argv).catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
