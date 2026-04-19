# Inspirations

This project is intentionally inspired by a few specific source patterns rather than trying to invent a new agent kernel.

## Claude Code source patterns

### 1. Skill directories are leaf containers

The skill scanner in Claude Code stops descending once a directory contains `SKILL.md`.

Reference:

- [`walkPluginMarkdown.ts`](../../reference-projects/reference-projects/claude-code-sourcemap/restored-src/src/utils/plugins/walkPluginMarkdown.ts)

That behavior is mirrored in this repository's [`src/lib/skill-loader.js`](../src/lib/skill-loader.js).

### 2. Plugin manifest exposes skills as directories

Claude Code's plugin manifest schema allows a plugin to declare one or more skill directories via `skills`.

Reference:

- [`schemas.ts`](../../reference-projects/reference-projects/claude-code-sourcemap/restored-src/src/utils/plugins/schemas.ts)

This repository uses the same basic idea in [`.claude-plugin/plugin.json`](../.claude-plugin/plugin.json) and [`.mcp.json`](../.mcp.json).

### 3. Skills should be explicit about when to use them

Claude Code bundled skills register:

- a clear name,
- a description,
- a `whenToUse` explanation,
- and, when appropriate, a task-specific prompt body.

Reference:

- [`claudeInChrome.ts`](../../reference-projects/reference-projects/claude-code-sourcemap/restored-src/src/skills/bundled/claudeInChrome.ts)

That pattern informs both bundled skills in this repository.

## Anthropic public skills repository

Anthropic's public skills repository demonstrates the public `SKILL.md` format:

- YAML frontmatter with `name` and `description`
- a markdown body for detailed procedural instructions
- optional resources alongside the skill

Reference:

- [anthropics/skills](https://github.com/anthropics/skills)
- [template examples in the README](https://github.com/anthropics/skills)
- [skill-creator example](https://github.com/anthropics/skills/blob/main/skills/skill-creator/SKILL.md)

This repository follows that layout directly in its `skills/` directory.

## Computer-use safety pattern

The staged computer-use pattern here is also informed by an observe -> act -> re-observe loop:

- observe before every action,
- prefer element-scoped actions,
- prefer `set_value` for stable inputs,
- re-observe after any UI change.

Reference:

- [`personal-agent` computer use manifest](../../personal-agent/src/capabilities/computer-use/manifest.json)
- [`personal-agent` computer use skill](../../personal-agent/src/capabilities/computer-use/skill.md)
- [`personal-agent` staged adapter](../../personal-agent/src/environment/computer-adapter.ts)

This repository adapts those ideas for a standalone open-source workflow rather than embedding them in the existing app.
