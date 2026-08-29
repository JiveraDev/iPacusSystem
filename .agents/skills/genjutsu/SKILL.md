---
name: genjutsu
description: Finalize or transform web interfaces through deliberate visual direction, motion design, micro-interactions, and stack-aware animation. Use for UI polish, animation passes, interaction design, scroll effects, or a broader visual overhaul; do not trigger for routine non-visual code changes.
---

# Genjutsu for Codex

Turn functional interfaces into cohesive, production-ready experiences without sacrificing usability, accessibility, or performance. This is a Codex-native adaptation of the MIT-licensed `AThevon/genjutsu` workflow.

## Choose the scope

- **Cast:** Polish an existing interface or interaction. Use for hover behavior, transitions, scroll choreography, feedback, entrances, and focused visual refinement.
- **Paint:** Establish or substantially revise the visual identity of a page or application. Use for full redesigns, new design systems, or work where typography, color, composition, component language, and motion must change together.

Match the workflow to the request. Do not turn a small interaction change into a redesign. When the requested direction is materially ambiguous, state a concise visual or interaction thesis and resolve the ambiguity before making broad changes. For specific requests, proceed directly.

## Load only relevant guidance

- For extracting or applying a visual system, read `../design-dna/SKILL.md` and only the references it routes to.
- For timing, easing, choreography, and motion accessibility, read `../motion-design/SKILL.md` and only the relevant supporting files.
- For GSAP implementation, read `../gsap-core/SKILL.md` plus the smallest relevant set of `../gsap-react/SKILL.md`, `../gsap-timeline/SKILL.md`, `../gsap-scrolltrigger/SKILL.md`, `../gsap-plugins/SKILL.md`, `../gsap-utils/SKILL.md`, and `../gsap-performance/SKILL.md`.

## Workflow

1. Inspect the current stack, shared UI primitives, theme behavior, responsive patterns, and the exact screens in scope. Visually inspect the running interface when practical.
2. Identify the interaction hierarchy: what should attract attention, what should quietly support orientation, and what should remain static.
3. Define a compact thesis covering mood, motion character, timing, easing, and the intended user benefit. Keep the existing product identity unless the user requested a new one.
4. Implement the smallest coherent motion system that achieves the thesis. Reuse shared components and tokens rather than scattering one-off values.
5. Verify reduced-motion behavior, focus and keyboard states, animation cleanup, responsive layouts, and light/dark contrast.
6. Run the repository's relevant lint/build checks and visually review the affected breakpoints.

## Implementation constraints

- Prefer the project's existing animation stack. Ask before adding a new runtime dependency; explain why native CSS or the existing stack is insufficient.
- In React, scope GSAP animations to component refs and clean them up with `useGSAP` or `gsap.context().revert()`.
- Prefer transforms and opacity for frequent animation. Avoid layout thrashing, long main-thread work, and gratuitous `will-change`.
- Respect `prefers-reduced-motion`; provide a calm, functionally equivalent state rather than merely slowing every animation.
- Preserve continuity: motion should originate from the triggering control or the element's spatial context.
- Use motion to clarify hierarchy, state, feedback, and navigation. Avoid decorative movement that competes with operational tasks.
- Keep dense dashboards restrained. Do not add marketing-style hero motion, excessive parallax, animated gradients, or effects that reduce table and form scannability.
- Do not hide essential content behind animation. Initial content must remain usable if JavaScript or animation fails.
- Check phone, tablet, 1080p desktop, and wide desktop layouts for clipping, overlap, and unreadable motion.

## Completion report

Summarize the design and motion decisions, files changed, dependency changes, reduced-motion behavior, and verification performed. Keep the report factual and concise.
