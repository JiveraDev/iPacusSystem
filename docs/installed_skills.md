# Skills available to this workspace

Inspected: 2026-10-13. Skills are agent instructions, not npm packages or application features. They are used when the task calls for them; this code/testing audit did not require a UI or image skill.

## Repository skills

These 11 `SKILL.md` files are installed in `.agents/skills/`:

| Skill | Purpose |
| --- | --- |
| design-dna | Extract and apply design tokens, style and effects |
| genjutsu | Interface polish, interactions and animation |
| motion-design | Motion principles and timing |
| gsap-core | Core GSAP tweens and responsive animation |
| gsap-frameworks | Vue/Svelte lifecycle integration |
| gsap-performance | Animation performance |
| gsap-plugins | Plugin registration and usage |
| gsap-react | React lifecycle and animation cleanup |
| gsap-scrolltrigger | Scroll-linked animation and pinning |
| gsap-timeline | Animation sequencing |
| gsap-utils | GSAP helper utilities |

## System and plugin skills exposed in this session

| Skill | Purpose |
| --- | --- |
| imagegen | Generate/edit bitmap images |
| openai-docs | OpenAI/Codex documentation and configuration |
| skill-creator | Create/update skills |
| skill-installer | Install skills |
| plugin-management:plugin-management | Inspect/manage plugin connections |
| sites:sites | Build/manage Sites-hosted websites |
| work-pets:create-pet | Create ChatGPT Work pets |
| work-pets:pets | List/select/manage Work pets |
| work-pets:update-pet | Update/repair Work pets |

There are 20 skill entries available in this session. Plugin and system availability can differ between environments; only the first 11 are repository-local. No skills were installed, removed or edited during the audit.

## Added for Codex on 2026-10-14

The following 17 skills were added to the existing `.agents/skills/` folder, bringing the repository total to 28. Invoke a skill with `$` followed by its name, for example `$redesign-existing-projects`, `$web-design-guidelines`, `$awesome-design-md` or `$playwright-cli`. The new skills will be available on the next turn.

| Skill | Purpose |
| --- | --- |
| design-taste-frontend | Art direction and browser-based review for public-facing pages |
| redesign-existing-projects | Audit and improve existing interfaces |
| gpt-taste | Frontend design and GSAP motion guidance for GPT/Codex |
| image-to-code | Generate visual references and implement a matching interface |
| high-end-visual-design | Soft, polished visual design |
| minimalist-ui | Restrained editorial and product UI |
| industrial-brutalist-ui | Mechanical, high-contrast visual direction |
| stitch-design-taste | Google Stitch and DESIGN.md guidance |
| full-output-enforcement | Complete implementation output |
| imagegen-frontend-web | Website design reference images |
| imagegen-frontend-mobile | Mobile screen reference images |
| brandkit | Brand identity and guideline boards |
| design-taste-frontend-v1 | Upstream legacy v1, when explicitly needed |
| design-taste-frontend-v2-experimental | Upstream legacy experimental variant, when explicitly needed |
| web-design-guidelines | Review UI and accessibility against Vercel's current guidelines |
| playwright-cli | Browser automation and Playwright test workflows |
| awesome-design-md | Codex wrapper around 84 bundled brand design references |

Sources were downloaded at these commits so the installation can be traced:

| Source | Commit |
| --- | --- |
| [Leonxlnx/taste-skill](https://github.com/Leonxlnx/taste-skill) | `a60a36dc2bb3bb77ccf17f2f62041f5ca8a458b9` |
| [Vercel web-design-guidelines](https://github.com/vercel-labs/agent-skills/tree/main/skills/web-design-guidelines) | `063bee94c3f4df8453406c830b0a7df0f2860278` |
| [Microsoft playwright-cli](https://github.com/microsoft/playwright-cli/tree/main/skills/playwright-cli) | `b85c7a736bb473bf55b584e54a09ffa698d6d871` |
| [VoltAgent/awesome-design-md](https://github.com/voltagent/awesome-design-md) | `c7c1bada4eda972236d124e06ee58df129a9266b` |

The upstream Taste skills already use portable `SKILL.md` instructions. The main Taste skill's screenshot instruction now names Codex's `view_image` tool. Vercel's `WebFetch` instruction now points to the available Codex web browsing tool. Playwright's Claude `Bash(...)` allowlist was removed and a PowerShell invocation was added:

```powershell
npx.cmd --yes --package=@playwright/cli playwright-cli <command>
```

The design collection did not have an upstream `SKILL.md`. Its local wrapper reads a catalog and loads only the chosen `DESIGN.md` reference, then applies it within the project's existing design system and `AGENTS.md` guardrails. Available upstream license files are bundled with the copied content.

Verification: the skill-creator validator passed for all 17 installed skills; linked skill references and all 84 local catalog entries were checked; the four main Taste helper scripts passed Node syntax checks; and the Playwright CLI `--help` command completed successfully. This installation did not run browser flows or application tests.
