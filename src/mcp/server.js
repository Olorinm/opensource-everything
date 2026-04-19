import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  captureReferenceData,
  captureWebReference,
  checkDesktopAutomationPermissions,
  diffReferenceArtifacts,
  generateCandidateManifestFromSession,
  generatePlaywrightFixturesFromInput,
  generateFixturesFromInput,
  generateCloneSpec,
  getToolCatalog,
  importComputerUseResearch,
  planCaptureFromInput,
  planRepairFromInput,
  recordDesktopTraceFromInput,
  recordWebTraceFromInput,
  scaffoldEditorLoop,
  scaffoldCloneLoop,
  summarizeTraceInput,
  verifyEditorClone,
  verifyLiveWebClone,
  verifyClone,
} from "../index.js";
import { readJson } from "../lib/common.js";

const SERVER_INFO = {
  name: "opensource-everything",
  version: "0.2.0",
};

const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

export async function startMcpServer() {
  const transport = new JsonRpcStdioTransport();
  transport.onMessage(async (message) => {
    if (!message || typeof message !== "object") {
      return;
    }

    try {
      await handleMessage(transport, message);
    } catch (error) {
      if (message.id !== undefined) {
        transport.sendError(message.id, -32000, error instanceof Error ? error.message : String(error));
      }
    }
  });

  transport.start();
}

async function handleMessage(transport, message) {
  switch (message.method) {
    case "initialize":
      transport.sendResult(message.id, {
        protocolVersion: message.params?.protocolVersion || "2024-11-05",
        capabilities: {
          tools: {},
        },
        serverInfo: SERVER_INFO,
      });
      return;
    case "notifications/initialized":
      return;
    case "ping":
      transport.sendResult(message.id, {});
      return;
    case "tools/list":
      transport.sendResult(message.id, {
        tools: getToolCatalog().map((tool) => ({
          name: tool.name,
          description: tool.description,
          inputSchema: tool.inputSchema,
        })),
      });
      return;
    case "tools/call": {
      const result = await runTool(message.params?.name, message.params?.arguments || {});
      transport.sendResult(message.id, {
        content: [
          {
            type: "text",
            text: result.summary,
          },
        ],
        structuredContent: result.data,
      });
      return;
    }
    default:
      if (message.id !== undefined) {
        transport.sendError(message.id, -32601, `Method not found: ${message.method}`);
      }
  }
}

async function runTool(name, args) {
  switch (name) {
    case "computer_use_import": {
      const result = await importComputerUseResearch(
        {
          session: args.session,
          observations: args.observations,
          docs: args.docs,
          notes: args.notes,
          summary: args.summary,
        },
        resolveOutput(args.outDir),
      );
      return {
        summary: `Imported computer-use observations into ${result.sessionPath}`,
        data: {
          sessionPath: result.sessionPath,
          sessionDir: result.sessionDir,
          sessionId: result.session.id,
        },
      };
    }
    case "capture_reference": {
      const result = args.session
        ? await captureReferenceData(args.session, resolveOutput(args.outDir))
        : await captureReferenceData(await readJson(resolvePath(args.inputPath)), resolveOutput(args.outDir));
      return {
        summary: `Captured reference session at ${result.sessionPath}`,
        data: {
          sessionPath: result.sessionPath,
          sessionDir: result.sessionDir,
          sessionId: result.session.id,
        },
      };
    }
    case "capture_web_reference": {
      const result = await captureWebReference(
        {
          url: args.url,
          htmlPath: args.htmlPath,
          html: args.html,
          name: args.name,
          screenshotPath: args.screenshotPath,
        },
        resolveOutput(args.outDir),
      );
      return {
        summary: `Captured web reference at ${result.sessionPath}`,
        data: {
          sessionPath: result.sessionPath,
          sessionDir: result.sessionDir,
          sessionId: result.session.id,
          sourceHtmlPath: result.sourceHtmlPath,
          sourceTextPath: result.sourceTextPath,
        },
      };
    }
    case "record_web_trace": {
      const result = await recordWebTraceFromInput(
        {
          startUrl: args.startUrl,
          planPath: args.planPath,
          plan: args.plan,
        },
        args.outDir ? resolveOutput(args.outDir) : undefined,
      );
      return {
        summary: `Recorded web trace at ${result.tracePath}`,
        data: {
          tracePath: result.tracePath,
          sessionPath: result.sessionPath,
          sessionDir: result.sessionDir,
          playwrightTracePath: result.playwrightTracePath,
        },
      };
    }
    case "record_desktop_trace": {
      const result = await recordDesktopTraceFromInput(
        {
          planPath: args.planPath,
          plan: args.plan,
          allowedApps: args.allowedApps,
          approvedApps: args.approvedApps,
        },
        args.outDir ? resolveOutput(args.outDir) : undefined,
      );
      return {
        summary: `Recorded desktop trace at ${result.tracePath}`,
        data: {
          tracePath: result.tracePath,
          policyPath: result.policyPath,
          sessionPath: result.sessionPath,
          sessionDir: result.sessionDir,
        },
      };
    }
    case "check_desktop_permissions": {
      const result = await checkDesktopAutomationPermissions();
      return {
        summary: result.ok
          ? "Desktop automation permissions are available."
          : "Desktop automation permissions are missing.",
        data: result,
      };
    }
    case "plan_capture": {
      const result = await planCaptureFromInput(
        {
          sessionPath: args.sessionPath ? resolvePath(args.sessionPath) : undefined,
          tracePath: args.tracePath ? resolvePath(args.tracePath) : undefined,
          summaryPath: args.summaryPath ? resolvePath(args.summaryPath) : undefined,
          session: args.session,
          trace: args.trace,
          summary: args.summary,
          goal: args.goal,
          targetSurface: args.targetSurface,
          productName: args.productName,
          url: args.url,
        },
        args.outDir ? resolveOutput(args.outDir) : undefined,
      );
      return {
        summary: `Capture plan ready for ${result.json.target.name}`,
        data: {
          markdownPath: result.markdownPath || "",
          jsonPath: result.jsonPath || "",
          target: result.json.target,
          missingEvidence: result.json.missingEvidence,
          nextSteps: result.json.nextSteps,
        },
      };
    }
    case "generate_clone_spec": {
      const result = await generateCloneSpec(
        resolvePath(args.sessionPath),
        args.outDir ? resolveOutput(args.outDir) : undefined,
      );
      return {
        summary: `Generated clone spec at ${result.markdownPath}`,
        data: {
          markdownPath: result.markdownPath,
          jsonPath: result.jsonPath,
        },
      };
    }
    case "summarize_trace": {
      const result = await summarizeTraceInput(
        args.trace || resolvePath(args.tracePath),
        args.outDir ? resolveOutput(args.outDir) : undefined,
      );
      return {
        summary: `Trace summary covers ${result.json.counts.observations} observations across ${result.json.counts.pages} pages`,
        data: {
          markdownPath: result.markdownPath || "",
          jsonPath: result.jsonPath || "",
          counts: result.json.counts,
          topActions: result.json.topActions,
          flows: result.json.flows,
        },
      };
    }
    case "generate_fixtures": {
      const result = await generateFixturesFromInput(
        {
          tracePath: args.tracePath ? resolvePath(args.tracePath) : undefined,
          sessionPath: args.sessionPath ? resolvePath(args.sessionPath) : undefined,
          trace: args.trace,
          session: args.session,
        },
        args.outDir ? resolveOutput(args.outDir) : undefined,
      );
      return {
        summary: `Generated ${result.json.fixtures.length} fixtures for ${result.json.source.name || result.json.id}`,
        data: {
          markdownPath: result.markdownPath || "",
          jsonPath: result.jsonPath || "",
          fixtureCount: result.json.fixtures.length,
          recommendations: result.json.recommendations,
          fixtures: result.json.fixtures,
        },
      };
    }
    case "generate_playwright_tests": {
      const result = await generatePlaywrightFixturesFromInput(
        {
          fixturePlanPath: args.fixturePlanPath,
          sessionPath: args.sessionPath,
          tracePath: args.tracePath,
        },
        args.outDir ? resolveOutput(args.outDir) : undefined,
        {
          candidateBaseUrl: args.candidateBaseUrl,
        },
      );
      return {
        summary: `Generated Playwright tests at ${result.testFilePath}`,
        data: {
          testFilePath: result.testFilePath,
          configPath: result.configPath,
          readmePath: result.readmePath,
          metaPath: result.metaPath,
        },
      };
    }
    case "generate_candidate_manifest": {
      const result = await generateCandidateManifestFromSession(
        resolvePath(args.sessionPath),
        args.outPath ? resolvePath(args.outPath) : undefined,
      );
      return {
        summary: `Generated candidate manifest at ${result.manifestPath}`,
        data: {
          manifestPath: result.manifestPath,
          pages: Array.isArray(result.manifest.pages) ? result.manifest.pages.length : 0,
          flows: Array.isArray(result.manifest.flows) ? result.manifest.flows.length : 0,
        },
      };
    }
    case "verify_live_web_clone": {
      const result = await verifyLiveWebClone(
        resolvePath(args.referenceSession),
        String(args.candidateUrl),
        args.outDir ? resolveOutput(args.outDir) : undefined,
        {
          name: args.name,
        },
      );
      return {
        summary: `Live web verify complete with diff ${result.summary.diffScore}% and verification ${result.summary.verificationScore}%`,
        data: {
          markdownPath: result.markdownPath,
          jsonPath: result.jsonPath,
          candidateManifestPath: result.summary.candidateManifestPath,
          diffScore: result.summary.diffScore,
          verificationScore: result.summary.verificationScore,
          gaps: result.summary.gaps,
        },
      };
    }
    case "diff_reference_artifacts": {
      const result = await diffReferenceArtifacts(
        resolvePath(args.referenceSession),
        resolvePath(args.candidateManifest),
        args.outDir ? resolveOutput(args.outDir) : undefined,
      );
      return {
        summary: `Artifact diff complete with score ${result.report.score}%`,
        data: {
          markdownPath: result.markdownPath,
          jsonPath: result.jsonPath,
          score: result.report.score,
          changed: result.report.changed,
        },
      };
    }
    case "scaffold_clone_loop": {
      const result = await scaffoldCloneLoop(resolvePath(args.sessionPath), resolveOutput(args.outDir), {
        candidateBaseUrl: args.candidateBaseUrl,
        devCommand: args.devCommand,
      });
      return {
        summary: `Created clone loop packet at ${result.root}`,
        data: {
          root: result.root,
          files: result.files,
        },
      };
    }
    case "scaffold_editor_loop": {
      const result = await scaffoldEditorLoop(args.outDir ? resolveOutput(args.outDir) : undefined, {
        productName: args.productName,
      });
      return {
        summary: `Created editor loop packet at ${result.root}`,
        data: {
          root: result.root,
          files: result.files,
        },
      };
    }
    case "verify_editor_clone": {
      const result = await verifyEditorClone(
        resolvePath(args.fixturesPath),
        resolvePath(args.candidateManifest),
        args.outDir ? resolveOutput(args.outDir) : undefined,
      );
      return {
        summary: `Editor verification complete with score ${result.report.score}%`,
        data: {
          markdownPath: result.markdownPath,
          jsonPath: result.jsonPath,
          score: result.report.score,
          gaps: result.report.gaps,
        },
      };
    }
    case "verify_clone": {
      const result = await verifyClone(
        resolvePath(args.referenceSession),
        resolvePath(args.candidateManifest),
        args.outDir ? resolveOutput(args.outDir) : undefined,
      );
      return {
        summary: `Verification complete with score ${result.report.score}%`,
        data: {
          markdownPath: result.markdownPath,
          jsonPath: result.jsonPath,
          score: result.report.score,
          gaps: result.report.gaps,
        },
      };
    }
    case "plan_repair": {
      const result = await planRepairFromInput(
        {
          verificationReportPath: args.verificationReportPath
            ? resolvePath(args.verificationReportPath)
            : undefined,
          verificationReport: args.verificationReport,
          referenceSession: args.referenceSession ? resolvePath(args.referenceSession) : undefined,
          candidateManifest: args.candidateManifest ? resolvePath(args.candidateManifest) : undefined,
        },
        args.outDir ? resolveOutput(args.outDir) : undefined,
      );
      return {
        summary: `Repair plan ready with ${result.json.priorities.length} priority fixes`,
        data: {
          markdownPath: result.markdownPath || "",
          jsonPath: result.jsonPath || "",
          score: result.json.score,
          summary: result.json.summary,
          priorities: result.json.priorities,
          nextVerification: result.json.nextVerification,
        },
      };
    }
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

function resolveOutput(path) {
  return resolve(path || PROJECT_ROOT, ".");
}

function resolvePath(path) {
  if (!path) {
    throw new Error("Missing required path argument");
  }
  return resolve(path);
}

class JsonRpcStdioTransport {
  constructor() {
    this.buffer = Buffer.alloc(0);
    this.listener = null;
  }

  onMessage(listener) {
    this.listener = listener;
  }

  start() {
    process.stdin.on("data", (chunk) => {
      this.buffer = Buffer.concat([this.buffer, chunk]);
      this.flush();
    });
    process.stdin.resume();
  }

  flush() {
    while (true) {
      const headerEnd = this.buffer.indexOf("\r\n\r\n");
      if (headerEnd === -1) {
        return;
      }

      const header = this.buffer.slice(0, headerEnd).toString("utf8");
      const match = header.match(/Content-Length:\s*(\d+)/i);
      if (!match) {
        throw new Error("Missing Content-Length header");
      }

      const contentLength = Number(match[1]);
      const messageStart = headerEnd + 4;
      const messageEnd = messageStart + contentLength;
      if (this.buffer.length < messageEnd) {
        return;
      }

      const payload = this.buffer.slice(messageStart, messageEnd).toString("utf8");
      this.buffer = this.buffer.slice(messageEnd);
      const parsed = JSON.parse(payload);
      if (this.listener) {
        void this.listener(parsed);
      }
    }
  }

  send(message) {
    const payload = Buffer.from(JSON.stringify(message), "utf8");
    process.stdout.write(`Content-Length: ${payload.length}\r\n\r\n`);
    process.stdout.write(payload);
  }

  sendResult(id, result) {
    this.send({
      jsonrpc: "2.0",
      id,
      result,
    });
  }

  sendError(id, code, message) {
    this.send({
      jsonrpc: "2.0",
      id,
      error: {
        code,
        message,
      },
    });
  }
}
