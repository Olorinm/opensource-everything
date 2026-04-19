# Which file is for what

If you are looking at this repo for the first time, these are the files that matter:

## Core implementation

- `src/` - the actual logic
- `skills/` - the bundled operating instructions
- `examples/` - sample inputs and outputs

This is the part that does the real work:

- turn research into a reference session
- summarize traces
- generate fixtures
- generate clone specs
- diff screenshots
- verify the result

## Codex

Codex reads:

- `.codex-plugin/plugin.json`
- `.mcp.json`
- `skills/`

If you want to use this repo in Codex, point Codex at the repository root.

## Claude Code

Claude Code reads:

- `.claude-plugin/plugin.json`
- `.claude-plugin/marketplace.json`
- `adapters/claude-code/.mcp.json`

If you want to use this repo in Claude Code, the same repository root works as both:

- the plugin source
- the marketplace source

## The short version

This is a single-repo setup.

You do not need a separate repository for:

- Codex
- Claude Code
- Claude marketplace distribution

Everything lives here.
