# Release checklist

Run through this before publishing.

## 1. Basic checks

- make sure `package.json` has the version you want to publish
- run `npm install`
- run `node ./src/cli.js tools`
- run `node ./src/cli.js skills`

## 2. Smoke test the workflow

- run `node ./src/cli.js summarize-trace ./examples/computer-use-trace.json --out ./output/release-smoke`
- run `node ./src/cli.js generate-fixtures --trace ./examples/computer-use-trace.json --out ./output/release-smoke`
- run the local MCP smoke test and confirm all tools are listed

## 3. Check Codex

- confirm `.codex-plugin/plugin.json` still matches the current project
- confirm `.mcp.json` still launches `node ./src/cli.js serve-mcp`
- install the repo locally in Codex and make sure the plugin appears

## 4. Check Claude Code

- confirm `.claude-plugin/plugin.json` still points at `adapters/claude-code/.mcp.json`
- confirm `.claude-plugin/marketplace.json` still has the right name, version, and description
- run `claude plugin validate .` if the Claude CLI is available
- test `claude plugin marketplace add .`
- test `claude plugin install opensource-everything@opensource-everything-marketplace`

## 5. Final cleanup

- update `CHANGELOG.md`
- update the README if install steps or prompts changed
- remove temporary files you do not want to publish
- make sure `.gitignore` still excludes `node_modules/` and generated output
- replace any placeholder GitHub URLs before release
