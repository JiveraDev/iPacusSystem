# iPawcus conceptual class diagram

The diagram uses the supplied image's visual design: white rectangular boxes,
thin gray borders, small centered names, and thin orthogonal connectors. The
reference's entities, field layout, PK/FK columns, and positions are not copied.

Each UML class has a name, an attributes compartment, and an operations
compartment. Its width is measured from its own longest text row in Arial,
including the bold class name, with 10 units of padding on each side. Its height
comes from its actual number of attribute and operation rows with small padding.
There is no common minimum column width or connector-driven height. Connectors
use all four sides to keep heavily connected classes fitted to their content.

## Files

- `ipawcus-core-class-diagram.drawio`: the editable 35-class core diagram.
- `00-system-class-diagram.svg`: sharp vector export of the core diagram.
- `00-system-class-diagram.png`: high-resolution core export for insertion in a paper.
- `ipawcus-class-diagram.drawio`: all 11 editable sheets, including the complete
  91-class model and nine module detail sheets.
- `01-complete-domain-model.svg` and `.png`: complete conceptual model.
- `02-` through `10-` SVG/PNG files: module detail diagrams.
- `SOURCE-REFERENCE.md` and `domain-model.json`: existing conceptual definitions
  and their implementation mappings, retained from the October 6 model.
- `validation.json`: geometry, content, editable XML, and source verification.

This is a conceptual software class model. Class operations summarize existing
functions and API workflows; the boxes do not assert that matching PHP or React
classes exist. Solid connectors show recorded associations, dashed connectors
show application associations, and dashed arrows show dependencies. Multiplicity
labels stay beside their own connector. The complete sheet uses smaller
multiplicity labels because it includes every association. Core and module
sheets use the regular label size.

The main diagram retains selected attributes of all 35 existing core classes.
The complete diagram retains the existing model's full attributes, operations,
and relationships, including records marked as legacy in the source reference.
Reference boxes in module sheets represent the same class; User references show
the existing user ID and role attributes. The underlying domain model is unchanged.

Suggested paper caption:

> Conceptual class diagram of iPawcus, showing domain attributes, operations,
> associations, and dependencies. The implementation uses React components,
> JavaScript service functions, and PHP request handlers.

## Regenerate

Run from the repository root:

```powershell
python outputs/ipawcus-class-diagram-2026-10-08-reference-style/render-and-validate.py --measure
node outputs/ipawcus-class-diagram-2026-10-08-reference-style/build-diagram.mjs
python outputs/ipawcus-class-diagram-2026-10-08-reference-style/render-and-validate.py
```

The files depend on the saved October 6 domain model and installed Pillow/Arial
fonts. No application, database, original diagram, or debug-bypass changes are
performed.
