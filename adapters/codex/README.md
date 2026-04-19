# Codex

This repo already has the files Codex needs:

- `.codex-plugin/plugin.json`
- `.mcp.json`
- `skills/`

## How to use it

1. clone or download the repo
2. run `npm install`
3. add the repo root as a local plugin in Codex

After that, Codex can use the bundled skills and call the MCP tools from this repo.

## Quick check

```bash
node ./src/cli.js tools
node ./src/cli.js skills
node ./src/cli.js summarize-trace ./examples/computer-use-trace.json --out ./output/codex-smoke
```
