# opensource-everything

[简体中文](./README.zh-CN.md)

Capture an existing product, turn it into build-ready artifacts, and verify your clone against the reference.

## What it does

- capture web pages, saved HTML, screenshots, and traces as a structured reference session
- record browser flows with screenshots, DOM snapshots, and Playwright trace output
- record plan-driven macOS desktop flows with screenshots and normalized sessions
- generate clone specs, fixtures, candidate manifests, and Playwright tests
- compare a candidate build against the reference with screenshot diff and verification reports

Desktop capture stays generic. Product-specific steps belong in the runtime plan, not in the engine.

## Install

```bash
npm install
```

## Quick start

Inspect the bundled tools:

```bash
node ./src/cli.js tools
```

Capture a page:

```bash
node ./src/cli.js capture-web --url https://example.com --out ./output/web-demo
```

Generate a capture plan:

```bash
node ./src/cli.js plan-capture --session ./examples/reference-session.json --goal "Cover the signup path" --out ./output/capture-plan-demo
```

Verify a candidate:

```bash
node ./src/cli.js verify ./examples/reference-session.json ./examples/candidate-manifest.json --out ./output/verify-demo
```

## Main commands

```bash
node ./src/cli.js tools
node ./src/cli.js skills
node ./src/cli.js capture-web --url <url> --out <dir>
node ./src/cli.js record-web-trace --plan <plan.json> --out <dir>
node ./src/cli.js check-desktop-permissions
node ./src/cli.js record-desktop-trace --plan <plan.json> --approve-app <AppName> --out <dir>
node ./src/cli.js summarize-trace <trace.json> --out <dir>
node ./src/cli.js generate-fixtures --session <session> --out <dir>
node ./src/cli.js emit-playwright --session <session> --candidate-base-url <url> --out <dir>
node ./src/cli.js spec <session> --out <dir>
node ./src/cli.js candidate-manifest <session> --out <file>
node ./src/cli.js diff <session> <candidate-manifest.json> --out <dir>
node ./src/cli.js verify <session> <candidate-manifest.json> --out <dir>
node ./src/cli.js plan-repair --reference <session> --candidate <candidate-manifest.json> --out <dir>
```

## Desktop capture

Desktop capture requires:

- macOS Automation
- Accessibility
- Screen Recording

It also has two runtime gates:

- the app must be allowlisted
- the app must be explicitly approved for the current run

Example:

```bash
node ./src/cli.js record-desktop-trace \
  --plan ./examples/desktop-trace-plan.json \
  --approve-app TextEdit \
  --out ./output/desktop-trace-demo
```

## Use in Codex

This repo already includes the files Codex needs:

- `.codex-plugin/plugin.json`
- `.mcp.json`
- `skills/`

Add the repository root as a local plugin.

## Use in Claude Code

This repo also works as a Claude plugin and marketplace package.

Validate it locally:

```bash
claude plugin validate .
```

Add and install it:

```bash
claude plugin marketplace add .
claude plugin install opensource-everything@opensource-everything-marketplace
```

If the repo is on GitHub, replace `.` with `owner/repo`.

## Included tools

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

## Included skills

- `computer-use-research`
- `opensource-everything`

## Repository layout

- `src/` - core implementation
- `skills/` - bundled skills
- `examples/` - sample inputs
- `docs/` - notes and adapter docs
- `.codex-plugin/` - Codex plugin metadata
- `.claude-plugin/` - Claude plugin and marketplace metadata

## Notes

- `editor-loop` is an optional markdown editor template, not a built-in product workflow
- `plan_capture` and `plan_repair` write short planning files on purpose
- generated demo output goes to `output/`, which is ignored by git
