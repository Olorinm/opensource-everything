---
name: opensource-everything
description: Capture an existing product, distill it into a structured clone spec, implement against that spec, and verify the clone against the reference. Use whenever the user wants to recreate an existing app, page, workflow, dashboard, or product interaction from screenshots, live browsing, docs, or observed behavior.
---

# OpenSource Everything

Use this skill for reference-driven product replication.

The job is not "copy pixels blindly." The job is:

1. collect evidence,
2. turn evidence into reusable traces and fixtures,
3. convert evidence into a reproducible spec,
4. build against that spec,
5. verify that the build matches the reference.

## Workflow

### Stage 1: Recon

Start by identifying:

- the product name
- the product URL or app surface
- the user goal
- the pages or flows that matter most

Read textual sources first when available:

- landing pages
- docs
- FAQs
- changelogs
- help articles

Capture what the product is trying to do before you start cloning it.

## Progressive disclosure

Do not use the heaviest capture path by default.

Escalate in layers:

1. start with docs, copy, screenshots, and existing notes
2. capture a live web page or saved HTML when the surface is mostly static
3. record a scripted web trace when the flow depends on navigation or interaction
4. use the plan-driven desktop trace engine only when the target behavior truly lives in a desktop app or native workflow
5. use domain templates only when the target product actually matches that domain

This keeps the workflow reusable and prevents product-specific logic from leaking into the core engine.
Before a non-trivial capture pass, generate a compact capture plan so the next evidence-gathering step stays focused.

### Stage 2: Observe

When computer use or browser automation is available:

1. observe before every action
2. record the visible state
3. record the flow steps that changed the UI
4. capture screenshots at meaningful milestones

Prefer element-scoped observations over vague descriptions such as "a button near the top right."

Always preserve enough structure for later tooling:

- session metadata
- ordered observations
- actions and targets
- states seen
- screenshots
- notes

After a trace is collected, run `summarize_trace` before moving on. If the summary is thin, the trace is thin.

### Stage 2a: Choose the right capture path

Pick the lightest tool that can still preserve the evidence you need:

- use `capture_web_reference` for a page snapshot, saved HTML, visible copy, and rough component inventory
- use `record_web_trace` when the target behavior depends on clicks, state changes, DOM snapshots, or browser replay
- use `record_desktop_trace` when the flow depends on a native app, desktop menu actions, keyboard shortcuts, or window-level behavior
- use `plan_capture` before a new capture pass when it is unclear which evidence gap matters most

For desktop capture, the engine is generic and the plan is product-specific.

That means:

- the model should generate the runtime plan from the current target app
- the plan should describe actions, targets, expected results, and observation points
- the engine should not hardcode product behavior
- `check_desktop_permissions` should be used as preflight before keyboard-driven desktop traces
- the plan or invocation must define an app allowlist
- the run must include explicit user approval for every manipulated app

### Stage 2.5: Fixtures

Before implementation, generate reusable probes from the trace or session.

Use `generate_fixtures` to create:

- smoke flows
- state probes
- copy integrity checks
- visual baselines
- input robustness probes

Treat fixture generation as a way to pressure-test your understanding of the product. If the generated fixtures look vague, gather more evidence before building.

### Stage 3: Spec

Always produce a structured spec before major implementation work.

At minimum, the spec should include:

- product summary
- page inventory
- component inventory
- state inventory
- copy inventory
- primary flows
- visual constraints
- open questions

If anything is uncertain, call it out explicitly instead of guessing.

### Stage 4: Build

Implement from the spec, not from memory.

During implementation:

- keep the reference screenshots nearby
- preserve important interaction order
- preserve loading, empty, and error states
- prefer local framework conventions over inventing a new pattern

If the target is a markdown editor or similar document tool, the optional editor template can help bootstrap corpus files and verification structure. Treat it as a starter packet, not as built-in product knowledge.

### Stage 5: Verify

After implementation, compare the candidate to the reference using:

- screenshots
- page inventory
- flow coverage
- copy coverage
- state coverage
- generated fixtures
- trace replays when available

When a mismatch appears, explain whether it is:

- visual only
- behavioral
- structural
- copy related

After each meaningful verification pass, generate a compact repair plan before making the next batch of edits.
Use `plan_repair` to keep the next implementation step short and prioritized.

## Operating rules

1. Treat every screenshot and flow note as an artifact.
2. Treat traces and fixtures as first-class build inputs, not optional paperwork.
3. Do not start by promising "pixel perfect" fidelity.
4. First achieve functional and structural parity, then chase visual parity.
5. Never hide uncertainty. Put it in the spec and revisit it later.
6. When using computer use, re-observe after every meaningful UI change.

## Output expectation

For non-trivial tasks, produce:

- a trace summary
- a fixture plan
- a structured reference session
- a clone spec
- an implementation plan
- a verification report

When desktop traces are involved, also include:

- the runtime plan used for capture
- the permission status
- any blocked steps or host-level limitations

## Good prompts for this skill

- "Recreate this product flow from the live site."
- "Clone this dashboard based on the screenshots and docs."
- "Observe this app, generate a build spec, then verify my implementation."
