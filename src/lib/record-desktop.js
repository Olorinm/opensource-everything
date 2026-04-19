import { execFile } from "node:child_process";
import { stat, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { promisify } from "node:util";
import { join, resolve } from "node:path";
import { importComputerUseResearch } from "./computer-use.js";
import {
  coerceObject,
  ensureDir,
  readJson,
  slugify,
  uniqueStrings,
  writeJson,
  writeText,
} from "./common.js";

const execFileAsync = promisify(execFile);

export async function recordDesktopTraceFromInput(input, outputRoot) {
  const payload = coerceObject(input);
  const plan = payload.planPath ? await readJson(resolve(String(payload.planPath))) : coerceObject(payload.plan);
  const root = resolve(outputRoot || process.cwd());
  const planName = String(plan.name || payload.name || plan.session?.source?.name || "desktop-trace");
  const traceId = slugify(planName);
  const runDir = join(root, traceId);
  const screenshotsDir = join(runDir, "artifacts", "screenshots");
  await ensureDir(screenshotsDir);

  const policy = resolveDesktopPolicy(payload, plan);
  const policyCheck = enforceDesktopPolicy(Array.isArray(plan.actions) ? plan.actions : [], policy);
  await writeJson(join(runDir, "desktop-policy.json"), policyCheck);

  const permissions = await checkDesktopAutomationPermissions();
  await writeJson(join(runDir, "desktop-permissions.json"), permissions);
  if (!permissions.ok) {
    throw new Error(
      [
        "Desktop trace recorder needs macOS Automation, Accessibility, and Screen Recording permission.",
        permissions.reason,
        "Grant permission to the app running this command, then retry.",
      ]
        .filter(Boolean)
        .join(" "),
    );
  }

  const actions = Array.isArray(plan.actions) ? plan.actions : [];
  const observations = [];

  for (let index = 0; index < actions.length; index += 1) {
    const action = coerceObject(actions[index]);
    await performDesktopAction(action);
    observations.push(await captureDesktopObservation(action, index + 1, screenshotsDir));
  }

  if (!actions.length || lastActionType(actions) !== "observe") {
    observations.push(
      await captureDesktopObservation(
        {
          type: "observe",
          label: "final-state",
          notes: ["Auto-captured final state after scripted desktop actions."],
        },
        observations.length + 1,
        screenshotsDir,
      ),
    );
  }

  const trace = {
    session: {
      id: traceId,
      source: {
        name: String(plan.session?.source?.name || plan.name || traceId),
        url: "",
        capturedAt: new Date().toISOString(),
      },
      summary: String(
        plan.session?.summary ||
          plan.summary ||
          `Recorded ${observations.length} desktop observations.`,
      ),
      notes: normalizeNotes(plan.session?.notes),
    },
    observations,
    docs: Array.isArray(plan.docs) ? plan.docs : [],
    notes: normalizeNotes(plan.notes),
  };

  const tracePath = join(runDir, "computer-use-trace.json");
  await writeJson(tracePath, trace);
  await writeText(join(runDir, "trace-plan.json"), `${JSON.stringify(plan, null, 2)}\n`);

  const sessionResult = await importComputerUseResearch(trace, root);
  return {
    trace,
    tracePath,
    runDir,
    policyPath: join(runDir, "desktop-policy.json"),
    sessionPath: sessionResult.sessionPath,
    sessionDir: sessionResult.sessionDir,
  };
}

async function performDesktopAction(action) {
  const type = String(action.type || action.action || "observe");
  switch (type) {
    case "observe":
    case "screenshot":
      return;
    case "activate_app":
      await activateApp(String(action.app || action.value || ""));
      await waitMs(Number(action.waitForMs || 500));
      return;
    case "type_text":
      await runSystemEvents(`keystroke ${asAppleString(String(action.text || action.value || ""))}`);
      await waitMs(Number(action.waitForMs || 250));
      return;
    case "keystroke":
      await runSystemEvents(buildKeystrokeScript(String(action.key || action.value || ""), action.modifiers));
      await waitMs(Number(action.waitForMs || 250));
      return;
    case "key_code":
      await runSystemEvents(buildKeyCodeScript(Number(action.keyCode ?? action.value ?? 36), action.modifiers));
      await waitMs(Number(action.waitForMs || 250));
      return;
    case "menu_click":
      await runSystemEvents(buildMenuClickScript(action));
      await waitMs(Number(action.waitForMs || 500));
      return;
    case "wait":
      await waitMs(Number(action.ms || action.value || 500));
      return;
    default:
      throw new Error(`Unsupported desktop trace action: ${type}`);
  }
}

async function captureDesktopObservation(action, index, screenshotsDir) {
  const label = slugify(action.label || `${index}-${action.type || action.action || "observe"}`);
  const screenshotPath = join(screenshotsDir, `${String(index).padStart(2, "0")}-${label}.png`);
  await execFileAsync("screencapture", ["-x", screenshotPath]);

  const frontState = await readFrontmostWindowState();
  return {
    pageId: slugify(frontState.appName || `desktop-${index}`),
    pageTitle: frontState.windowTitle || frontState.appName,
    pageUrl: "",
    pagePurpose: frontState.appName,
    action: String(action.type || action.action || "observe"),
    target: describeDesktopTarget(action),
    expectedResult: String(action.expectedResult || ""),
    observedResult: frontState.windowTitle || frontState.appName,
    screenshotPath,
    screenshotLabel: label,
    focusedElement: "",
    components: uniqueDesktopComponents(action, frontState),
    states: ["default"],
    copy: frontState.windowTitle ? [frontState.windowTitle] : [frontState.appName].filter(Boolean),
    notes: normalizeNotes(action.notes),
    flow: coerceObject(action.flow),
  };
}

async function readFrontmostWindowState() {
  const script = `
tell application "System Events"
  set appName to ""
  set windowTitle to ""
  try
    set frontProcess to first process whose frontmost is true
    set appName to name of frontProcess
    try
      set windowTitle to name of front window of frontProcess
    end try
  end try
  return appName & "||" & windowTitle
end tell
`;
  const { stdout } = await execFileAsync("osascript", ["-e", script]);
  const [appName, windowTitle] = stdout.trim().split("||");
  return {
    appName: appName || "",
    windowTitle: windowTitle || "",
  };
}

async function runAppleScript(script) {
  await execFileAsync("osascript", ["-e", script]);
}

async function activateApp(appName) {
  try {
    await execFileAsync("open", ["-a", appName]);
    return;
  } catch {
    await runAppleScript(`tell application ${asAppleString(appName)} to activate`);
  }
}

async function runSystemEvents(innerScript) {
  const script = `
tell application "System Events"
  ${innerScript}
end tell
`;
  try {
    await runAppleScript(script);
  } catch (error) {
    const message = extractScriptError(error);
    if (message.includes("不允许发送按键") || message.includes("not allowed to send keystrokes")) {
      throw new Error(
        [
          "macOS blocked synthetic keyboard input for System Events.",
          "The desktop trace engine can inspect permissions, but some hosts still deny real keystrokes until accessibility approval is fully granted.",
          `Original error: ${message}`,
        ].join(" "),
      );
    }
    throw error;
  }
}

export async function checkDesktopAutomationPermissions() {
  const result = {
    ok: false,
    automation: false,
    accessibility: false,
    screenRecording: false,
    screenRecordingBestEffort: true,
    reason: "",
  };

  try {
    await execFileAsync("osascript", [
      "-e",
      'tell application "System Events" to name of first process',
    ]);
    result.automation = true;
  } catch (error) {
    result.reason = extractScriptError(error);
    return result;
  }

  try {
    await execFileAsync("osascript", [
      "-e",
      'tell application "System Events" to keystroke ""',
    ]);
    result.accessibility = true;
  } catch (error) {
    result.reason = extractScriptError(error);
    return result;
  }

  try {
    await checkScreenRecordingPermission();
    result.screenRecording = true;
  } catch (error) {
    result.reason = extractScriptError(error);
    return result;
  }

  result.ok = true;
  return result;
}

function resolveDesktopPolicy(payload, plan) {
  const planPolicy = coerceObject(plan.desktopPolicy);
  return {
    allowedApps: uniqueStrings([
      ...(Array.isArray(planPolicy.allowedApps) ? planPolicy.allowedApps : []),
      ...(Array.isArray(payload.allowedApps) ? payload.allowedApps : []),
    ]),
    approvedApps: uniqueStrings(payload.approvedApps),
  };
}

function enforceDesktopPolicy(actions, policy) {
  if (!policy.allowedApps.length) {
    throw new Error(
      "Desktop trace requires an explicit app allowlist. Add desktopPolicy.allowedApps to the plan or pass allowedApps at invocation time.",
    );
  }

  if (!policy.approvedApps.length) {
    throw new Error(
      "Desktop trace requires explicit user approval for each controlled app. Pass approvedApps at invocation time.",
    );
  }

  const allowedSet = new Set(policy.allowedApps.map(normalizeAppName));
  const approvedSet = new Set(policy.approvedApps.map(normalizeAppName));
  const controlledApps = [];
  let currentApp = "";

  for (const rawAction of actions) {
    const action = coerceObject(rawAction);
    const type = String(action.type || action.action || "observe");

    if (type === "observe" || type === "screenshot" || type === "wait") {
      continue;
    }

    const explicitApp = String(action.app || "").trim();
    const actionApp = explicitApp || currentApp;
    if (!actionApp) {
      throw new Error(
        `Desktop trace action "${type}" requires an explicit app context. Add action.app or activate the app earlier in the plan.`,
      );
    }

    const normalized = normalizeAppName(actionApp);
    if (!allowedSet.has(normalized)) {
      throw new Error(
        `Desktop trace action "${type}" targets "${actionApp}", which is outside the allowlist.`,
      );
    }
    if (!approvedSet.has(normalized)) {
      throw new Error(
        `Desktop trace action "${type}" targets "${actionApp}" without explicit user approval.`,
      );
    }

    currentApp = actionApp;
    controlledApps.push(actionApp);
  }

  return {
    ok: true,
    allowedApps: policy.allowedApps,
    approvedApps: policy.approvedApps,
    controlledApps: uniqueStrings(controlledApps),
  };
}

function normalizeAppName(value) {
  return String(value || "").trim().toLowerCase();
}

async function checkScreenRecordingPermission() {
  const probePath = join(
    tmpdir(),
    `opensource-everything-screen-check-${Date.now()}-${Math.random().toString(36).slice(2)}.png`,
  );

  try {
    await execFileAsync("screencapture", ["-x", "-R0,0,4,4", probePath]);
    const info = await stat(probePath);
    if (!info.size) {
      throw new Error("Screen Recording preflight produced an empty screenshot probe.");
    }
  } catch (error) {
    const message = extractScriptError(error);
    throw new Error(
      [
        "Screen Recording preflight failed.",
        "This check is best-effort and uses a tiny probe screenshot.",
        `Original error: ${message}`,
      ].join(" "),
    );
  } finally {
    await unlink(probePath).catch(() => {});
  }
}

function buildKeystrokeScript(key, modifiers) {
  return `keystroke ${asAppleString(key)}${modifierClause(modifiers)}`;
}

function buildKeyCodeScript(keyCode, modifiers) {
  return `key code ${Number(keyCode)}${modifierClause(modifiers)}`;
}

function buildMenuClickScript(action) {
  const menuBar = Number(action.menuBar || 1);
  const menu = asAppleString(String(action.menu || ""));
  const menuItem = asAppleString(String(action.item || action.menuItem || ""));
  const appName = action.app ? `process ${asAppleString(String(action.app))}` : "(first process whose frontmost is true)";
  return `
tell ${appName}
  click menu item ${menuItem} of menu ${menu} of menu bar item ${menu} of menu bar ${menuBar}
end tell`;
}

function modifierClause(modifiers) {
  if (!Array.isArray(modifiers) || !modifiers.length) {
    return "";
  }
  const mapped = modifiers.map((item) => {
    const value = String(item).toLowerCase();
    switch (value) {
      case "cmd":
      case "command":
        return "command down";
      case "shift":
        return "shift down";
      case "option":
      case "alt":
        return "option down";
      case "control":
      case "ctrl":
        return "control down";
      default:
        return "";
    }
  }).filter(Boolean);
  return mapped.length ? ` using {${mapped.join(", ")}}` : "";
}

function asAppleString(value) {
  return JSON.stringify(String(value || ""));
}

function describeDesktopTarget(action) {
  return String(
    action.app ||
      action.text ||
      action.key ||
      action.keyCode ||
      action.menuItem ||
      action.item ||
      action.menu ||
      "",
  );
}

function normalizeNotes(value) {
  return Array.isArray(value) ? value.map((item) => String(item)).filter(Boolean) : [];
}

function uniqueDesktopComponents(action, frontState) {
  const components = [];
  if (frontState.windowTitle) {
    components.push("window");
  }
  if (String(action.type || "") === "menu_click") {
    components.push("menu");
  }
  if (String(action.type || "") === "type_text") {
    components.push("editor");
  }
  return [...new Set(components)];
}

function lastActionType(actions) {
  const last = actions.at(-1);
  return String(last?.type || last?.action || "");
}

async function waitMs(ms) {
  await new Promise((resolvePromise) => setTimeout(resolvePromise, ms));
}

function extractScriptError(error) {
  return error instanceof Error ? error.message.replace(/\s+/g, " ").trim() : String(error);
}
