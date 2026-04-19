---
name: computer-use-research
description: Use computer or browser automation to study an existing product safely and systematically. Use whenever the task requires opening pages, inspecting real UI state, stepping through flows, or collecting screenshots and interaction evidence before implementation.
---

# Computer Use Research

This skill is for gathering evidence from a live UI.

## Progressive disclosure

Choose the least invasive capture path first.

1. If docs, screenshots, or saved HTML are enough, use those first.
2. If the target is a browser flow, prefer web capture or scripted web trace.
3. If the target behavior depends on native app windows, menus, or keyboard shortcuts, escalate to the plan-driven desktop trace engine.
4. If the next capture move is unclear, generate a compact `plan_capture` result before touching the UI again.

Do not treat desktop trace recording as the default path for every product.
Do not manipulate a desktop app unless that app is allowlisted and explicitly approved for the current run.

## Core loop

Always use:

1. observe
2. act
3. re-observe

Do not queue a long chain of UI actions based on stale state.

## Research priorities

When exploring a product:

1. identify the current app, page, or tab
2. identify the current focused element
3. identify the primary CTA and the main user path
4. capture the visible copy and important UI states
5. record what changed after each action

## Safety and stability rules

1. Prefer element-scoped targets over raw coordinates.
2. Prefer `set_value` over raw typing when the target is a known input field.
3. Re-observe after any navigation, dialog, tab switch, or form submission.
4. If an action appears to fail, verify with a fresh observation instead of assuming success.
5. Record the exact visible evidence that supports any later implementation choice.

## What to save

For each meaningful step, save:

- screenshot or screenshot reference
- page or window title
- URL if available
- focused element or target element
- action attempted
- observed result

Prefer a trace structure that can later feed:

- `summarize_trace`
- `generate_fixtures`
- `computer_use_import`

That means every observation should be useful even without rereading the raw screenshots.

For plan-driven desktop traces, also save:

- the plan that was executed
- the frontmost app or window after each step
- screenshots after each meaningful action
- any permission or host-level failure that changed the run

The desktop engine stays generic. Product-specific behavior belongs in the runtime plan, not in the engine.

## Hand-off format

When computer use research is complete, summarize:

- what the product does
- the main pages and flows
- the critical interactions
- the copy and states that must be preserved
- what remains uncertain

Before handing off, run:

1. `summarize_trace` to confirm the trace is coherent
2. `generate_fixtures` to turn the trace into stable probes
3. `plan_capture` if the next evidence gap is still ambiguous

That packet should be good enough for a separate implementation agent to build from.
