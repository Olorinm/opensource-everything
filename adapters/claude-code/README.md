# Claude Code

This repo already includes the files Claude Code needs:

- `.claude-plugin/plugin.json`
- `.claude-plugin/marketplace.json`
- `adapters/claude-code/.mcp.json`

## How to use it

Validate the plugin locally:

```bash
claude plugin validate .
```

Add the repo as a marketplace and install the plugin:

```bash
claude plugin marketplace add .
claude plugin install opensource-everything@opensource-everything-marketplace
```

If the repo is on GitHub, replace `.` with `owner/repo`.

## Why there is a separate MCP file

Claude installs plugins into its own cache, so the Claude MCP config uses `${CLAUDE_PLUGIN_ROOT}` to find `src/cli.js`.
