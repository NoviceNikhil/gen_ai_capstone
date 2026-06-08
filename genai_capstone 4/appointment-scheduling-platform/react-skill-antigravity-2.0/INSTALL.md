# React Frontend Skill — Antigravity 2.0 Install

## What this is

A SKILL.md skill for React 19 + Vite + TypeScript + Tailwind + shadcn/ui
development. Covers effect patterns, rendering identity, shadcn conventions,
forms, state ownership, TypeScript strictness, and accessibility.

Progressive disclosure: the main SKILL.md (~274 lines) loads when the agent
decides the task matches. The 4 reference files load only when the agent
reads them during execution.

## Install — project scope (recommended)

Copy the `.agent/` folder from this zip into your project root:

```bash
# From your project root
cp -r .agent/ .agent/
```

Result:
```
your-project/
├── .agent/
│   └── skills/
│       └── react-frontend-skill/
│           ├── SKILL.md
│           └── references/
│               ├── effect-patterns.md
│               ├── typescript-patterns.md
│               ├── performance-guide.md
│               └── testing-patterns.md
```

Commit `.agent/skills/` to git so your team gets the same skill.

## Install — global scope (all projects)

```bash
cp -r .agent/skills/react-frontend-skill/ ~/.gemini/antigravity/skills/react-frontend-skill/
```

## Verify

Start a new Antigravity session and ask:
```
What skills do you have available?
```
You should see `react-frontend-skill` in the list.

Or test directly:
```
Build a user settings form with email and notification toggle using shadcn
```
The agent should follow the skill's conventions (React Hook Form + Zod,
shadcn Form primitives, cn() utility, CSS var theming).

## Cross-tool symlink (optional)

If you also use Gemini CLI, symlink to avoid duplication:
```bash
ln -s ~/.gemini/antigravity/skills ~/.gemini/skills
```

## Customization

Edit SKILL.md to match your actual repo:
- Update commands section if you use npm/yarn instead of pnpm
- Update file structure if your paths differ from src/components/
- Add project-specific conventions to Section 8
- Verify every library in the state ownership table is in your package.json
