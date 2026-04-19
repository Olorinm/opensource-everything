import { join, resolve } from "node:path";
import { ensureDir, readJson, writeJson, writeText } from "./common.js";

const MARKDOWN_CASES = [
  {
    id: "headings-and-paragraphs",
    title: "Headings and paragraphs",
    markdown: "# Title\n\n## Section\n\nA normal paragraph with **bold**, *italic*, and `inline code`.\n",
    expected: [
      "Headings render with visible hierarchy.",
      "Inline emphasis stays editable without breaking surrounding text.",
    ],
  },
  {
    id: "lists-and-checkboxes",
    title: "Lists and checkboxes",
    markdown: "- one\n- two\n  - child\n\n- [ ] todo\n- [x] done\n",
    expected: [
      "Nested lists indent correctly.",
      "Checkbox toggles do not break list structure.",
    ],
  },
  {
    id: "table-and-quote",
    title: "Tables and quotes",
    markdown:
      "> A quote block\n>\n> with two lines.\n\n| Name | Value |\n| --- | --- |\n| A | 1 |\n| B | 2 |\n",
    expected: [
      "Quote blocks keep their structure while editing.",
      "Tables stay aligned and editable cell by cell.",
    ],
  },
  {
    id: "code-fence",
    title: "Code fence",
    markdown: "```ts\nconst answer = 42;\nconsole.log(answer);\n```\n",
    expected: [
      "Code fences preserve indentation and line breaks.",
      "Cursor movement inside code blocks feels stable.",
    ],
  },
  {
    id: "links-images-and-rule",
    title: "Links, images, and horizontal rule",
    markdown:
      "[OpenAI](https://openai.com)\n\n![Alt text](./image.png)\n\n---\n\nFinal paragraph.\n",
    expected: [
      "Links remain editable as links.",
      "Images and horizontal rules render without collapsing nearby blocks.",
    ],
  },
];

const KEYBOARD_CHECKS = [
  "Enter on normal paragraph",
  "Backspace at start of list item",
  "Tab / Shift+Tab inside nested list",
  "Undo / Redo",
  "Toggle bold and italic shortcuts",
  "Create code block from current line",
];

const FILE_OPS = [
  "Open existing markdown file",
  "Save current document",
  "Autosave after edit",
  "Reopen saved document with structure preserved",
];

const EXPORTS = ["HTML", "PDF"];

export async function scaffoldEditorLoop(outputDir, options = {}) {
  const productName = String(options.productName || "Markdown Editor Template");
  const root = resolve(outputDir || process.cwd(), "editor-loop");
  const corpusDir = join(root, "corpus");
  const referenceDir = join(root, "reference");

  await ensureDir(corpusDir);
  await ensureDir(referenceDir);

  const fixtureSpec = {
    productName,
    markdownCases: MARKDOWN_CASES.map((item) => ({
      id: item.id,
      title: item.title,
      expected: item.expected,
    })),
    keyboardChecks: KEYBOARD_CHECKS,
    fileOps: FILE_OPS,
    exports: EXPORTS,
  };

  for (const item of MARKDOWN_CASES) {
    await writeText(join(corpusDir, `${item.id}.md`), item.markdown);
  }

  const fixturePath = join(referenceDir, "editor-fixtures.json");
  const manifestTemplatePath = join(root, "candidate-editor-manifest.json");
  const guidePath = join(root, "EDITOR_LOOP.md");
  const promptPath = join(root, "editor-replication-prompt.md");

  await writeJson(fixturePath, fixtureSpec);
  await writeJson(manifestTemplatePath, buildEditorCandidateManifestTemplate(fixtureSpec));
  await writeText(guidePath, buildEditorGuide(productName));
  await writeText(promptPath, buildEditorPrompt(productName));

  return {
    root,
    files: [
      ...MARKDOWN_CASES.map((item) => join(corpusDir, `${item.id}.md`)),
      fixturePath,
      manifestTemplatePath,
      guidePath,
      promptPath,
    ],
  };
}

export async function verifyEditorClone(fixturesInput, candidateManifestInput, outputDir) {
  const fixtures = await readJson(resolve(fixturesInput));
  const candidate = await readJson(resolve(candidateManifestInput));
  const report = buildEditorVerificationReport(fixtures, candidate);
  const root = resolve(outputDir || process.cwd());
  const markdownPath = join(root, "editor-verification-report.md");
  const jsonPath = join(root, "editor-verification-report.json");
  await writeText(markdownPath, report.markdown);
  await writeJson(jsonPath, report.json);
  return {
    report,
    markdownPath,
    jsonPath,
  };
}

export function buildEditorVerificationReport(fixtures, candidate) {
  const featureChecks = compareNamedEntries(
    fixtures.markdownCases.map((item) => item.id),
    candidate.markdownCases || [],
  );
  const keyboardChecks = compareNamedEntries(fixtures.keyboardChecks || [], candidate.keyboardChecks || []);
  const fileOpChecks = compareNamedEntries(fixtures.fileOps || [], candidate.fileOps || []);
  const exportChecks = compareNamedEntries(fixtures.exports || [], candidate.exports || []);

  const allChecks = [...featureChecks, ...keyboardChecks, ...fileOpChecks, ...exportChecks];
  const earned = allChecks.filter((item) => item.implemented).length;
  const score = allChecks.length ? Math.round((earned / allChecks.length) * 100) : 100;
  const gaps = allChecks.filter((item) => !item.implemented).map((item) => item.label);

  const markdown = [
    `# Editor Verification Report`,
    "",
    `Score: ${score}%`,
    "",
    "## Missing or incomplete",
    gaps.length ? gaps.map((gap) => `- ${gap}`).join("\n") : "- None detected.",
    "",
    "## Detail",
    ...allChecks.map((item) => `- ${item.label}: ${item.implemented ? "implemented" : "missing"}`),
    "",
  ].join("\n");

  return {
    score,
    gaps,
    markdown,
    json: {
      score,
      gaps,
      checks: allChecks,
    },
  };
}

function buildEditorCandidateManifestTemplate(fixtures) {
  return {
    summary: `Candidate editor manifest for ${fixtures.productName}`,
    markdownCases: fixtures.markdownCases.map((item) => ({
      id: item.id,
      implemented: false,
      notes: "",
      evidence: {
        screenshot: "",
        savedOutputPath: "",
      },
    })),
    keyboardChecks: fixtures.keyboardChecks.map((label) => ({
      label,
      implemented: false,
      notes: "",
    })),
    fileOps: fixtures.fileOps.map((label) => ({
      label,
      implemented: false,
      notes: "",
    })),
    exports: fixtures.exports.map((label) => ({
      label,
      implemented: false,
      notes: "",
    })),
  };
}

function buildEditorGuide(productName) {
  return [
    `# ${productName} Loop`,
    "",
    "Use this directory as an optional template when rebuilding a markdown editor.",
    "It is not tied to a specific product. Generate product-specific plans and traces at runtime.",
    "",
    "## What to test",
    "",
    "1. Load every file in `corpus/`.",
    "2. Edit inside each structure and confirm it stays stable.",
    "3. Save and reopen the file.",
    "4. Export to HTML and PDF if supported.",
    "5. Record the result in `candidate-editor-manifest.json`.",
    "",
    "## Verification",
    "",
    "- Fill in the candidate manifest.",
    "- Run `ose verify-editor <editor-fixtures.json> <candidate-editor-manifest.json>`.",
    "",
  ].join("\n");
}

function buildEditorPrompt(productName) {
  return [
    `# Replication Prompt: ${productName}`,
    "",
    "Use this directory as a starting template for recreating markdown-editor behavior.",
    "Add product-specific traces, screenshots, fixtures, and verification steps for the target app.",
    "",
    "Focus on:",
    "",
    "- markdown structure staying stable during edits",
    "- keyboard behavior",
    "- file open/save/reopen behavior",
    "- export parity",
    "",
    "Use the markdown files under `corpus/` as concrete test inputs.",
    "",
  ].join("\n");
}

function compareNamedEntries(requiredLabels, candidateEntries) {
  return requiredLabels.map((required) => {
    const match = (Array.isArray(candidateEntries) ? candidateEntries : []).find((item) => {
      if (typeof item === "string") {
        return item === required;
      }
      return item.id === required || item.label === required;
    });

    return {
      label: required,
      implemented: Boolean(match && (typeof match === "string" || match.implemented)),
    };
  });
}
