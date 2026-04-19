export const TOOL_CATALOG = [
  {
    name: "computer_use_import",
    description:
      "Convert computer-use observations into a normalized reference session with pages, flows, notes, and copied screenshot artifacts.",
    inputSchema: {
      type: "object",
      properties: {
        session: {
          type: "object",
          description: "Session metadata including source, summary, and optional notes.",
        },
        observations: {
          type: "array",
          description: "Ordered computer-use observations with page, action, and screenshot evidence.",
        },
        outDir: {
          type: "string",
          description: "Output directory for the normalized session bundle.",
        },
      },
      required: ["session", "observations"],
      additionalProperties: false,
    },
  },
  {
    name: "capture_reference",
    description:
      "Normalize a live-product research capture into a stable session bundle with artifacts, pages, flows, and notes.",
    inputSchema: {
      type: "object",
      properties: {
        inputPath: {
          type: "string",
          description: "Path to a reference-session JSON file.",
        },
        session: {
          type: "object",
          description: "Structured reference session data to normalize directly.",
        },
        outDir: {
          type: "string",
          description: "Output directory for the normalized session bundle.",
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: "capture_web_reference",
    description:
      "Capture a live web page or saved HTML file into a normalized reference session with extracted copy, inferred components, and optional screenshot evidence.",
    inputSchema: {
      type: "object",
      properties: {
        url: {
          type: "string",
          description: "Live page URL to fetch and analyze.",
        },
        htmlPath: {
          type: "string",
          description: "Local HTML file to analyze instead of fetching a URL.",
        },
        html: {
          type: "string",
          description: "Inline HTML content to analyze.",
        },
        name: {
          type: "string",
          description: "Optional product or page name.",
        },
        screenshotPath: {
          type: "string",
          description: "Optional existing screenshot path to include in the session.",
        },
        outDir: {
          type: "string",
          description: "Output directory for the normalized session bundle.",
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: "record_web_trace",
    description:
      "Run a scripted browser trace, save screenshots and DOM snapshots for each step, and emit both a computer-use trace and a normalized session.",
    inputSchema: {
      type: "object",
      properties: {
        startUrl: {
          type: "string",
          description: "Starting URL for the trace run.",
        },
        planPath: {
          type: "string",
          description: "Path to a JSON plan with scripted browser actions.",
        },
        plan: {
          type: "object",
          description: "Inline action plan for the web trace recorder.",
        },
        outDir: {
          type: "string",
          description: "Directory for trace artifacts and generated session output.",
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: "record_desktop_trace",
    description:
      "Run a plan-driven macOS desktop trace for explicitly allowlisted and user-approved apps, then emit a computer-use trace and normalized session.",
    inputSchema: {
      type: "object",
      properties: {
        planPath: {
          type: "string",
          description: "Path to a JSON plan with scripted desktop actions.",
        },
        plan: {
          type: "object",
          description: "Inline runtime plan for the desktop trace engine.",
        },
        outDir: {
          type: "string",
          description: "Directory for trace artifacts and generated session output.",
        },
        allowedApps: {
          type: "array",
          items: {
            type: "string",
          },
          description: "Optional runtime app allowlist. Merged with desktopPolicy.allowedApps from the plan.",
        },
        approvedApps: {
          type: "array",
          items: {
            type: "string",
          },
          description: "Explicit user-approved apps for this run. Required before the engine can manipulate an app.",
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: "check_desktop_permissions",
    description:
      "Check whether macOS Automation, Accessibility, and Screen Recording permissions are available for the desktop trace engine.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: "plan_capture",
    description:
      "Generate a concise next-step capture plan that says what evidence is missing and which capture tools to run next.",
    inputSchema: {
      type: "object",
      properties: {
        sessionPath: {
          type: "string",
          description: "Path to a reference session directory or session.json file.",
        },
        tracePath: {
          type: "string",
          description: "Path to a computer-use trace JSON file.",
        },
        summaryPath: {
          type: "string",
          description: "Path to a trace-summary JSON file.",
        },
        session: {
          type: "object",
          description: "Inline normalized session object.",
        },
        trace: {
          type: "object",
          description: "Inline trace object.",
        },
        summary: {
          type: "object",
          description: "Inline trace summary object.",
        },
        goal: {
          type: "string",
          description: "Short user goal for the next capture pass.",
        },
        targetSurface: {
          type: "string",
          description: "Optional hint such as web, desktop, or mixed.",
        },
        productName: {
          type: "string",
          description: "Optional product name override.",
        },
        url: {
          type: "string",
          description: "Optional target URL override.",
        },
        outDir: {
          type: "string",
          description: "Optional output directory for compact capture plan files.",
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: "generate_clone_spec",
    description:
      "Convert a normalized reference session into a structured clone spec in markdown and JSON.",
    inputSchema: {
      type: "object",
      properties: {
        sessionPath: {
          type: "string",
          description: "Path to a session directory or session.json file.",
        },
        outDir: {
          type: "string",
          description: "Optional directory for clone-spec outputs.",
        },
      },
      required: ["sessionPath"],
      additionalProperties: false,
    },
  },
  {
    name: "summarize_trace",
    description:
      "Summarize an observation trace into counts, inferred flows, targets, states, and notes so the build agent knows what evidence it already has.",
    inputSchema: {
      type: "object",
      properties: {
        tracePath: {
          type: "string",
          description: "Path to a trace JSON file.",
        },
        trace: {
          type: "object",
          description: "Inline trace object matching trace.schema.json.",
        },
        outDir: {
          type: "string",
          description: "Optional directory for summary outputs.",
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: "generate_fixtures",
    description:
      "Generate a reusable fixture plan from a trace or normalized session so the clone can be stress-tested with stable probes.",
    inputSchema: {
      type: "object",
      properties: {
        tracePath: {
          type: "string",
          description: "Path to a trace JSON file.",
        },
        sessionPath: {
          type: "string",
          description: "Path to a session directory or session.json file.",
        },
        trace: {
          type: "object",
          description: "Inline trace object matching trace.schema.json.",
        },
        session: {
          type: "object",
          description: "Inline normalized session object.",
        },
        outDir: {
          type: "string",
          description: "Optional directory for fixture plan outputs.",
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: "generate_playwright_tests",
    description:
      "Turn a fixture plan, trace, or normalized session into a Playwright test bundle for visual baselines, copy checks, and flow scaffolding.",
    inputSchema: {
      type: "object",
      properties: {
        fixturePlanPath: {
          type: "string",
          description: "Path to a fixture-plan JSON file.",
        },
        sessionPath: {
          type: "string",
          description: "Path to a session directory or session.json file.",
        },
        tracePath: {
          type: "string",
          description: "Path to a trace JSON file.",
        },
        candidateBaseUrl: {
          type: "string",
          description: "Optional base URL for the candidate app under test.",
        },
        outDir: {
          type: "string",
          description: "Directory where Playwright files should be written.",
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: "generate_candidate_manifest",
    description:
      "Convert a normalized session into a candidate manifest that can be fed directly into diff and verify.",
    inputSchema: {
      type: "object",
      properties: {
        sessionPath: {
          type: "string",
          description: "Path to a session directory or session.json file.",
        },
        outPath: {
          type: "string",
          description: "Optional output path for the generated candidate manifest JSON.",
        },
      },
      required: ["sessionPath"],
      additionalProperties: false,
    },
  },
  {
    name: "verify_live_web_clone",
    description:
      "Capture a live candidate web app from a URL, generate a candidate manifest, then run diff and verify against the reference session.",
    inputSchema: {
      type: "object",
      properties: {
        referenceSession: {
          type: "string",
          description: "Path to a reference session directory or session.json file.",
        },
        candidateUrl: {
          type: "string",
          description: "Live URL for the candidate web app.",
        },
        name: {
          type: "string",
          description: "Optional candidate app name for the captured session.",
        },
        outDir: {
          type: "string",
          description: "Optional output directory for capture and verification results.",
        },
      },
      required: ["referenceSession", "candidateUrl"],
      additionalProperties: false,
    },
  },
  {
    name: "diff_reference_artifacts",
    description:
      "Compare reference screenshots against candidate screenshots using label matching, file checks, hash checks, and pixel diff for PNG files.",
    inputSchema: {
      type: "object",
      properties: {
        referenceSession: {
          type: "string",
          description: "Path to a session directory or session.json file.",
        },
        candidateManifest: {
          type: "string",
          description: "Path to the candidate manifest JSON file.",
        },
        outDir: {
          type: "string",
          description: "Optional directory for artifact diff outputs.",
        },
      },
      required: ["referenceSession", "candidateManifest"],
      additionalProperties: false,
    },
  },
  {
    name: "scaffold_clone_loop",
    description:
      "Create a working directory with a clone spec, fixture plan, candidate manifest template, Playwright tests, and loop instructions for iterative implementation.",
    inputSchema: {
      type: "object",
      properties: {
        sessionPath: {
          type: "string",
          description: "Path to a session directory or session.json file.",
        },
        outDir: {
          type: "string",
          description: "Directory where the clone loop packet should be created.",
        },
        candidateBaseUrl: {
          type: "string",
          description: "Optional base URL for the candidate app under test.",
        },
        devCommand: {
          type: "string",
          description: "Optional development command to record in the loop guide.",
        },
      },
      required: ["sessionPath"],
      additionalProperties: false,
    },
  },
  {
    name: "scaffold_editor_loop",
    description:
      "Create an optional markdown-editor template packet with corpus files, editor fixtures, and a candidate manifest template.",
    inputSchema: {
      type: "object",
      properties: {
        outDir: {
          type: "string",
          description: "Directory where the editor loop packet should be created.",
        },
        productName: {
          type: "string",
          description: "Optional product name for the generated packet.",
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: "verify_editor_clone",
    description:
      "Compare a markdown-editor candidate manifest against the template's markdown, keyboard, file, and export fixtures.",
    inputSchema: {
      type: "object",
      properties: {
        fixturesPath: {
          type: "string",
          description: "Path to editor-fixtures.json.",
        },
        candidateManifest: {
          type: "string",
          description: "Path to candidate-editor-manifest.json.",
        },
        outDir: {
          type: "string",
          description: "Optional directory for editor verification outputs.",
        },
      },
      required: ["fixturesPath", "candidateManifest"],
      additionalProperties: false,
    },
  },
  {
    name: "verify_clone",
    description:
      "Compare a candidate implementation manifest against the reference session and report missing pages, flows, states, copy, and screenshots.",
    inputSchema: {
      type: "object",
      properties: {
        referenceSession: {
          type: "string",
          description: "Path to a session directory or session.json file.",
        },
        candidateManifest: {
          type: "string",
          description: "Path to the candidate manifest JSON file.",
        },
        outDir: {
          type: "string",
          description: "Optional directory for verification outputs.",
        },
      },
      required: ["referenceSession", "candidateManifest"],
      additionalProperties: false,
    },
  },
  {
    name: "plan_repair",
    description:
      "Generate a concise repair plan that turns verification gaps into the next few implementation priorities.",
    inputSchema: {
      type: "object",
      properties: {
        verificationReportPath: {
          type: "string",
          description: "Path to a verification-report JSON file.",
        },
        verificationReport: {
          type: "object",
          description: "Inline verification report JSON.",
        },
        referenceSession: {
          type: "string",
          description: "Path to a reference session directory or session.json file.",
        },
        candidateManifest: {
          type: "string",
          description: "Path to a candidate manifest JSON file.",
        },
        outDir: {
          type: "string",
          description: "Optional output directory for compact repair plan files.",
        },
      },
      additionalProperties: false,
    },
  },
];

export function getToolCatalog() {
  return TOOL_CATALOG.map((tool) => ({ ...tool }));
}
