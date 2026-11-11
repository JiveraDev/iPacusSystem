# Updated activity diagrams for every iPawcus user role

Reviewed against the **current local working tree on 19 October 2026**, including its existing uncommitted changes. These revisions update the older paper activity diagrams using connected screens, frontend calls, central PHP permissions, and relevant workflow handlers. They do not establish that every feature works on the deployed server.

## Open the diagrams

- [All four diagrams: PDF](iPawcus-Updated-Role-Activity-Diagrams.pdf)
- [All four diagrams: editable diagrams.net / draw.io document](iPawcus-Updated-Role-Activity-Diagrams.drawio)
- [What changed, source evidence, and implementation boundaries](REVISION-NOTES.md)

| User role | Image for inserting into a paper | Scalable vector | Individual PDF | Mermaid source |
| --- | --- | --- | --- | --- |
| Pet Owner | [PNG](01-pet-owner.png) | [SVG](01-pet-owner.svg) | [PDF](01-pet-owner.pdf) | [Mermaid](01-pet-owner.mmd) |
| Admin | [PNG](02-admin.png) | [SVG](02-admin.svg) | [PDF](02-admin.pdf) | [Mermaid](02-admin.mmd) |
| Veterinarian | [PNG](03-veterinarian.png) | [SVG](03-veterinarian.svg) | [PDF](03-veterinarian.pdf) | [Mermaid](03-veterinarian.mmd) |
| Super Admin | [PNG](04-super-admin.png) | [SVG](04-super-admin.svg) | [PDF](04-super-admin.pdf) | [Mermaid](04-super-admin.mmd) |

The PDF uses A2 pages with vector text and shapes. The PNGs use twice the diagram's coordinate resolution; use the full PNG, SVG, or PDF for publication. Files ending in `-preview.png` are reduced review images. For a smaller paper page, retain the full diagram as an appendix and enlarge the relevant branch in the discussion rather than compressing every step into illegible text.

The `.drawio` document has one page per role. Open it using **File > Open From > Device** in diagrams.net. Its shapes, actor labels, and connectors are editable. Mermaid carries the same nodes/decisions and is another editable representation; its automatic layout will differ.

## Diagram conventions

- A black circle starts the activity; the ringed circle ends it.
- Rounded boxes describe activities. Small labels identify the responsible role or the System.
- The main decision selects **one** work area. Bracketed labels identify its alternatives.
- Yes/No decisions expose validation/review outcomes; correction paths return to the relevant earlier step.
- Empty diamonds merge alternatives. The old synchronization bars were removed because these choices are not simultaneous tasks.
- A pending/rejected review can end the current activity without claiming that approval, payment, or access has occurred. The user can revisit the work later.
- Steps beginning with “if,” “when,” or “for” describe applicable service-specific substeps. They are not requirements for every service.

These are role activity diagrams with explicit handoffs, not formal actor swimlanes. Column headings identify work areas, while actor labels identify responsibility.

## Regenerate and validate

From the repository root, with the project's installed Node dependencies and Windows PowerShell:

```powershell
node outputs/ipawcus-role-activities-2026-10-19/build-diagrams.mjs
powershell -NoProfile -ExecutionPolicy Bypass -File outputs/ipawcus-role-activities-2026-10-19/render-png.ps1
```

Edit [workflows.mjs](workflows.mjs) to revise the source wording. Generation rejects duplicate IDs, missing correction targets, unreachable activities, stranded activities, missing decision branches, overlapping nodes, diagonal connectors, or connectors crossing another activity. [validation.json](validation.json) records the graph/layout results. PNG generation also checks action text widths against the actual Arial font.

Validation covers these generated artifacts and their source references. No application source, database/schema, deployed configuration, or existing diagram was changed for this revision. Application lint/build/tests and live multi-role browser journeys were not run as part of this documentation-only task.
