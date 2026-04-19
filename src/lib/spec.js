import { join, resolve } from "node:path";
import { writeJson, writeText } from "./common.js";
import { loadSession as loadReferenceSession } from "./reference.js";

export async function generateCloneSpec(sessionInput, outputDir) {
  const { session, sessionDir } = await loadReferenceSession(sessionInput);
  const spec = buildCloneSpec(session);
  const targetDir = resolve(outputDir || sessionDir);
  const markdownPath = join(targetDir, "clone-spec.md");
  const jsonPath = join(targetDir, "clone-spec.json");
  await writeText(markdownPath, spec.markdown);
  await writeJson(jsonPath, spec.json);
  return { ...spec, markdownPath, jsonPath };
}

export function buildCloneSpec(session) {
  const pageLines = session.pages.map((page) =>
    [
      `### ${page.title || page.id}`,
      `- id: ${page.id}`,
      page.url ? `- url: ${page.url}` : "",
      page.purpose ? `- purpose: ${page.purpose}` : "",
      page.components.length ? `- components: ${page.components.join(", ")}` : "",
      page.states.length ? `- states: ${page.states.join(", ")}` : "",
      page.copy.length ? `- key copy: ${page.copy.join(" | ")}` : "",
      page.notes.length ? `- notes: ${page.notes.join(" | ")}` : "",
      page.screenshots.length
        ? `- screenshots: ${page.screenshots.map((item) => item.label || item.path).join(", ")}`
        : "",
    ]
      .filter(Boolean)
      .join("\n"),
  );

  const flowLines = session.flows.map((flow) =>
    [
      `### ${flow.name}`,
      flow.goal ? `Goal: ${flow.goal}` : "",
      ...flow.steps.map(
        (step, index) =>
          `${index + 1}. ${step.action}${step.target ? ` -> ${step.target}` : ""}${step.expectedResult ? ` => ${step.expectedResult}` : ""}`,
      ),
    ]
      .filter(Boolean)
      .join("\n"),
  );

  const markdown = [
    `# Clone Spec: ${session.source.name || session.id}`,
    "",
    "## Product Summary",
    session.summary || "No summary provided.",
    "",
    "## Reference Source",
    `- name: ${session.source.name || ""}`,
    `- url: ${session.source.url || ""}`,
    `- capturedAt: ${session.source.capturedAt || ""}`,
    "",
    "## Page Inventory",
    pageLines.join("\n\n") || "_No pages captured._",
    "",
    "## Primary Flows",
    flowLines.join("\n\n") || "_No flows captured._",
    "",
    "## Global Copy Notes",
    session.docs.length
      ? session.docs.map((doc) => `- ${doc.title || doc.kind}: ${doc.content}`).join("\n")
      : "_No docs captured._",
    "",
    "## Visual Fidelity Checklist",
    "- Match the main layout and hierarchy before chasing pixel-perfect styling.",
    "- Preserve all named states from the reference capture.",
    "- Preserve key copy strings unless there is a deliberate reason to diverge.",
    "- Recreate primary flows end to end before polishing.",
    "",
    "## Open Questions",
    session.notes.length ? session.notes.map((note) => `- ${note}`).join("\n") : "- None captured.",
    "",
  ].join("\n");

  const json = {
    id: session.id,
    product: session.source,
    summary: session.summary,
    pages: session.pages,
    flows: session.flows,
    docs: session.docs,
    notes: session.notes,
  };

  return { markdown, json };
}
