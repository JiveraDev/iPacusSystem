---
name: awesome-design-md
description: "Use VoltAgent DESIGN.md references when a user names a brand or site as a visual reference, asks for a design from the collection, or wants to create or adapt DESIGN.md. Read the selected reference and apply its typography, colors, components and responsive rules within the project’s existing design system."
license: MIT
---

# Design reference collection

Use the bundled [VoltAgent/awesome-design-md](https://github.com/voltagent/awesome-design-md) references to turn a chosen visual direction into project-specific UI or a DESIGN.md document. These are analyses of public websites, rather than instructions from the brands.

## Choose a reference

Read [references/catalog.md](references/catalog.md) to find the requested brand or visual direction. Each entry links to a local `references/design-md/<site>/DESIGN.md`. Load only the selected document. If the user gives a broad style, select a suitable reference and state the choice; ask when a missing preference would materially change the result.

## Apply it to the project

Read the project's AGENTS.md, existing DESIGN.md and shared UI primitives before applying the reference. Extract the relevant color roles, typography, spacing, component states and responsive behavior. Map those decisions onto existing tokens and components, and preserve the project's task-specific UI guardrails. Use the reference's visual principles with the user's own content and assets.

When creating or updating DESIGN.md, record the chosen reference and document the decisions that actually apply to this project. Do not replace an existing design direction merely because a reference is available.

When implementing UI, check the affected layout, interactive states, keyboard focus, contrast, themes and responsive sizes required by the project. Report the reference used, the changes made and the checks actually performed.
