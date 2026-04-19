# Desktop Trace Plans

`record-desktop-trace` is a plan-driven desktop trace engine.

The engine stays generic. It should know how to:

- activate an app
- send text or keyboard input
- click menus
- wait
- observe and capture screenshots
- emit a structured computer-use trace and normalized session

The plan carries product-specific knowledge.

That means the model should generate the plan at runtime from the target product, using:

- screenshots
- docs and notes
- live observation
- previous traces

Before running keyboard-driven plans, check desktop permissions first. Even when preflight passes, macOS may still block real keystroke synthesis or screenshot capture for the current host until Accessibility and Screen Recording approval are fully applied.

## What belongs in the engine

Keep these parts inside the reusable engine:

- macOS app activation
- AppleScript / System Events execution
- screenshot capture
- frontmost window inspection
- trace artifact layout
- session import
- permission checks

## Risk profile

Desktop tracing is more sensitive than plain web capture.

It can:

- inspect live desktop state
- send synthetic input to other apps
- capture screenshots that may contain unrelated content

Use it with:

- narrow runtime plans
- explicit app allowlists
- explicit user approval for each manipulated app at run time
- explicit user intent
- clear artifact paths
- minimal retention of sensitive captures

## What belongs in the plan

Keep these parts in the plan:

- which apps are allowlisted
- which app to open
- which keys to press
- which menus to click
- what each step is expected to do
- when to observe
- product-specific labels and notes

## Supported action types

- `activate_app`
- `type_text`
- `keystroke`
- `key_code`
- `menu_click`
- `wait`
- `observe`

## Why this split matters

If the engine hardcodes product logic, it stops being reusable.

With a plan-driven design, the same recorder can be used for:

- website companion apps
- desktop utilities
- editor workflows
- onboarding flows
- settings panels

Markdown editor replication is still useful, but it should live as an optional template layered on top of the engine instead of shaping the engine itself.
