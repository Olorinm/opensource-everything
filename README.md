# opensource-everything

[简体中文](./README.zh-CN.md)

`opensource-everything` helps you study an existing product, turn what you found into build-ready artifacts, and check whether your clone actually matches.

It is for moments like:

- "I want to rebuild this site or workflow."
- "I have screenshots and traces, but they are too messy to build from."
- "I need something stricter than vibes to compare my implementation with the reference."

## What it does

- turns research notes, screenshots, and computer-use traces into a structured reference session
- captures live web pages or saved HTML into a structured reference session
- records scripted browser traces with screenshots, DOM snapshots, and Playwright trace output
- records plan-driven macOS desktop traces with screenshots and normalized sessions
- generates clone specs in Markdown and JSON
- generates fixtures for smoke flows, copy checks, state coverage, and visual checks
- generates Playwright tests from fixture plans and sessions
- generates candidate manifests from captured sessions
- scaffolds a clone loop working directory with specs, tests, and verification inputs
- captures a live candidate URL and runs diff + verify in one pass
- includes an optional markdown-editor template packet
- diffs PNG screenshots with `pixelmatch`
- verifies a candidate build against the reference
- ships with skills and MCP tools for Codex and Claude Code

The core stays generic. Product-specific desktop plans, flows, and checks should be generated at runtime from the target app instead of being hardcoded into the engine.

## Install

```bash
npm install
```

## Use in Codex

This repo already includes everything Codex needs:

- `.codex-plugin/plugin.json`
- `.mcp.json`
- `skills/`

Add the repository root as a local plugin in Codex, then try prompts like:

- "Summarize this trace and generate fixtures."
- "Turn this reference session into a clone spec."
- "Verify my implementation against the reference."

## Use in Claude Code

This same repo also works as a Claude plugin and a Claude marketplace.

Validate it locally:

```bash
claude plugin validate .
```

Add the repo as a marketplace and install the plugin:

```bash
claude plugin marketplace add .
claude plugin install opensource-everything@opensource-everything-marketplace
```

If the repo is on GitHub, you can replace `.` with `owner/repo`.

## Typical workflow

1. collect screenshots, docs, and flow notes from the product you want to study
2. save them as a reference session or a computer-use trace
3. run `summarize-trace` to see whether your evidence is good enough
4. run `generate-fixtures` to turn that evidence into reusable probes
5. run `spec` to generate the clone spec
6. build the clone
7. run `diff` and `verify` to see what still does not match

## Tools

The bundled MCP server exposes import, capture, trace, spec, diff, verification, and template tools, including:

- `capture_web_reference`
- `record_web_trace`
- `record_desktop_trace`
- `check_desktop_permissions`
- `plan_capture`
- `generate_playwright_tests`
- `generate_candidate_manifest`
- `verify_live_web_clone`
- `plan_repair`
- `scaffold_clone_loop`
- `scaffold_editor_loop`
- `verify_editor_clone`

## Skills

The repo ships with two skills:

- `computer-use-research`
- `opensource-everything`

In practice, most people can just use the skills and let the agent call the tools underneath.

## CLI

Show help:

```bash
node ./src/cli.js --help
```

List tools:

```bash
node ./src/cli.js tools
```

List skills:

```bash
node ./src/cli.js skills
```

Summarize a trace:

```bash
node ./src/cli.js summarize-trace ./examples/computer-use-trace.json --out ./output/trace-demo
```

Capture a web page:

```bash
node ./src/cli.js capture-web --url https://example.com --out ./output/web-demo
```

Record a scripted web trace:

```bash
node ./src/cli.js record-web-trace --plan ./examples/web-trace-plan.json --out ./output/record-web-demo
```

Check desktop trace permissions:

```bash
node ./src/cli.js check-desktop-permissions
```

Generate a compact capture plan:

```bash
node ./src/cli.js plan-capture --session ./examples/reference-session.json --goal "Cover the signup path" --out ./output/capture-plan-demo
```

Record a plan-driven desktop trace:

```bash
node ./src/cli.js record-desktop-trace --plan ./examples/desktop-trace-plan.json --approve-app TextEdit --out ./output/desktop-trace-demo
```

Desktop traces depend on macOS Automation, Accessibility, and Screen Recording approval. Treat the permission check as preflight, not a guarantee that every keystroke or screenshot will be accepted by the current host.

This is also a higher-risk mode than plain web capture. It can inspect live desktop state, drive other apps, and persist screenshots, so it should be used deliberately and with narrow plans.

Desktop traces now require two separate gates:

- an app allowlist in the plan or invocation
- explicit user approval for each manipulated app at invocation time

Generate fixtures from a trace:

```bash
node ./src/cli.js generate-fixtures --trace ./examples/computer-use-trace.json --out ./output/trace-demo
```

Generate Playwright tests:

```bash
node ./src/cli.js emit-playwright --session ./output/reference-demo --candidate-base-url http://localhost:3000 --out ./output/playwright-demo
```

Generate a clone spec:

```bash
node ./src/cli.js spec ./output/reference-demo
```

Generate a candidate manifest:

```bash
node ./src/cli.js candidate-manifest ./output/reference-demo
```

Verify a candidate build:

```bash
node ./src/cli.js verify ./output/reference-demo ./examples/candidate-manifest.json
```

Generate a compact repair plan:

```bash
node ./src/cli.js plan-repair --reference ./examples/reference-session.json --candidate ./examples/candidate-manifest.json --out ./output/repair-plan-demo
```

Diff candidate screenshots:

```bash
node ./src/cli.js diff ./output/reference-demo ./examples/candidate-manifest.json
```

Scaffold a clone loop packet:

```bash
node ./src/cli.js clone-loop ./output/reference-demo --candidate-base-url http://localhost:3000 --out ./output/clone-loop
```

Verify a live web candidate:

```bash
node ./src/cli.js verify-live-web ./output/reference-demo --candidate-url http://localhost:3000 --out ./output/live-web-verify
```

Create the optional markdown-editor template packet:

```bash
node ./src/cli.js editor-loop --product "Markdown Editor Template" --out ./output/editor-loop
```

Verify a markdown-editor template candidate manifest:

```bash
node ./src/cli.js verify-editor ./output/editor-loop/editor-loop/reference/editor-fixtures.json ./output/editor-loop/editor-loop/candidate-editor-manifest.json
```

## Files you probably care about

- `src/` - core implementation
- `skills/` - bundled skills
- `.codex-plugin/plugin.json` - Codex plugin metadata
- `.claude-plugin/plugin.json` - Claude plugin metadata
- `.claude-plugin/marketplace.json` - Claude marketplace entry
- `docs/desktop-trace-plans.md` - how the desktop trace engine stays generic
- `examples/` - sample inputs

## Before you publish

Useful docs:

- [CHANGELOG.md](./CHANGELOG.md)
- [docs/release-checklist.md](./docs/release-checklist.md)
