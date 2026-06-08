---
name: react-frontend-reliability
description: >
  Conventions, guardrails, and architectural rules for building UI in a
  React 19 + Vite + TypeScript (strict) + Tailwind + shadcn/ui codebase.
  Trigger whenever creating, modifying, debugging, or refactoring React
  components, hooks, forms, state management, styling, or anything under
  src/components/, src/hooks/, src/lib/. Also trigger when reviewing
  frontend pull requests, fixing re-render issues, or composing shadcn
  primitives. Do NOT trigger for backend logic, database code, CI/CD
  config, pure Node scripts, or non-React frameworks.
---

# React Frontend Reliability

This skill exists because LLMs reliably produce broken code in specific
areas of React development. It does NOT restate what models already know
(JSX syntax, basic hooks, component structure). It targets the failure
modes that cause silent bugs, wasted iterations, and architectural drift.

## Commands (exact invocations)

```
pnpm dev                          # Vite dev server
pnpm build                       # tsc -b && vite build — MUST pass
pnpm lint                        # ESLint — zero errors
pnpm test                        # Vitest — MUST pass
pnpm dlx shadcn@latest add <x>   # install shadcn primitive
```

## File structure

```
src/
├── components/
│   ├── ui/          # shadcn primitives — NEVER edit, regenerate via CLI
│   └── <feature>/   # feature components composed from ui/ primitives
├── hooks/           # custom hooks
├── lib/
│   └── utils.ts     # cn() utility (twMerge + clsx)
├── routes/          # route components
├── index.css        # Tailwind directives + CSS variable design tokens
└── App.tsx
```

## Done criteria

Before considering any frontend task complete:
1. `pnpm build` passes
2. `pnpm lint` returns zero errors
3. No `any`, no `@ts-ignore` without an explaining comment
4. New UI uses existing shadcn primitives where one exists
5. No raw hex/rgb in JSX — use CSS vars from `src/index.css`
6. No new dependencies added without a one-line justification

---

# SECTION 1: What LLMs get wrong with effects

This is the #1 source of broken AI-generated React code.

## Rule: useEffect is the last resort, not the first reach

Before writing useEffect, check this list IN ORDER:
- Can this be derived during render? → compute it inline or useMemo
- Is this a response to a user action? → event handler
- Is this form state? → React Hook Form handles it
- Is this server data? → TanStack Query handles it
- Is this a subscription? → useSyncExternalStore

Only if none of the above apply, use useEffect, and write a comment
explaining WHY.

## Rule: every async effect needs cancellation

Wrong (and the most common LLM mistake):
```tsx
useEffect(() => {
  fetch(`/api/items/${id}`)
    .then(res => res.json())
    .then(setItems)
}, [id])
```

Right:
```tsx
useEffect(() => {
  const controller = new AbortController()
  fetch(`/api/items/${id}`, { signal: controller.signal })
    .then(res => res.json())
    .then(data => setItems(data))
    .catch(err => {
      if (err.name !== 'AbortError') throw err
    })
  return () => controller.abort()
}, [id])
```

Even better: use TanStack Query instead and skip the effect entirely.

## Rule: no effect chains

If you find yourself writing:
  effect A → setState → effect B → setState → effect C

Stop. Restructure using a reducer, an event handler, or derived state.
Effect chains create temporal coupling that is nearly impossible to debug.

---

# SECTION 2: What LLMs get wrong with rendering and identity

## Rule: never use array index as key for dynamic lists

If items can be reordered, filtered, inserted, or deleted, index-as-key
causes state to bleed between items. Use a stable identifier (id, uuid).

Index-as-key is fine ONLY for static, never-reordered display lists.

## Rule: do not cargo-cult memoization

Do NOT add useMemo, useCallback, or React.memo by default.
Add them ONLY when:
- A third-party lib requires a stable reference (e.g. TanStack Table
  column defs, map library callbacks)
- You can name the specific expensive re-render you are preventing
- Profiling shows measurable cost

Unnecessary memoization adds complexity and can make performance worse
(memo comparisons aren't free).

## Rule: Context must be granular

Never stuff unrelated state into one context provider. Every consumer
re-renders on ANY change to the context value. Split contexts by domain,
or use Zustand for shared client state with selector-based subscriptions.

---

# SECTION 3: shadcn/ui conventions

## Rule: never hand-edit src/components/ui/

These files are CLI-generated. To update, regenerate via:
```
pnpm dlx shadcn@latest add <component> --overwrite
```

If a primitive needs project-specific behavior, wrap it in
`src/components/<feature>/`, composing the original — do not fork it.

## Rule: always use cn() for class merging

```tsx
import { cn } from "@/lib/utils"
cn("px-4 py-2", isActive && "bg-primary text-primary-foreground", className)
```
Never concatenate Tailwind classes with template literals.

## Rule: use CVA for variant components

Buttons, badges, alerts, and any multi-variant primitive must use
class-variance-authority. No if/else class trees.

## Rule: check before building

Before writing a custom component:
1. Is it in `src/components/ui/` already? → use it
2. Is it in the shadcn registry? → `pnpm dlx shadcn@latest add <name>`
3. Is it a shadcn block? → check https://ui.shadcn.com/blocks
4. Only then build custom, composing existing primitives

## Theming

Use CSS variables from `src/index.css`. In JSX, reference as Tailwind
utilities: `bg-background`, `text-foreground`, `bg-primary`, `border-border`.
Never hardcode colors. If a needed token doesn't exist, add it to
`src/index.css` and flag it.

## Icons: lucide-react only

```tsx
import { ChevronRight } from "lucide-react"
<ChevronRight className="size-4" />
```
No Heroicons, no React Icons, no Material Icons.

## Toasts: sonner

Use `sonner`, not the legacy toast component. Mount `<Toaster />` once
at app root.

---

# SECTION 4: Forms

Use React Hook Form + Zod + shadcn Form primitives. No exceptions.

```tsx
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
```

Use `FormField`, `FormItem`, `FormLabel`, `FormControl`, `FormMessage`
from shadcn for layout and accessibility. Do not roll custom form state
with useState.

---

# SECTION 5: State ownership decision tree

Before creating state, determine what KIND of state it is:

| Kind              | Tool                        |
|-------------------|-----------------------------|
| Server data       | TanStack Query              |
| Form data         | React Hook Form + Zod       |
| URL state         | URL search params / router  |
| Shared client     | Zustand (with selectors)    |
| Derived           | Compute during render       |
| Transient UI only | local useState              |

Do not duplicate sources of truth across categories.

---

# SECTION 6: TypeScript strictness

- No `any`. No `as unknown as X`. No `@ts-ignore` without a comment.
- Prefer discriminated unions over boolean flags.
- Infer form/validation types from Zod schemas (`z.infer<typeof schema>`).
- Polymorphic components must preserve ref typing and prop inference.

For complex generic component patterns, read
`references/typescript-patterns.md` before writing.

---

# SECTION 7: Accessibility (non-negotiable)

- Use Radix primitives (via shadcn) for all interactive components
- Every interactive element must be keyboard-navigable
- Visible focus states required
- ARIA semantics on custom components
- Never sacrifice a11y for aesthetics

---

# SECTION 8: What NOT to do in this codebase

- Do NOT use Next.js patterns (`"use client"`, `next/link`, `next/image`,
  Server Components, Server Actions) — this is a Vite SPA
- Do NOT import from `@radix-ui/*` directly — go through shadcn wrappers
- Do NOT add `style={{ ... }}` with raw colors
- Do NOT use Formik, Redux, or React Icons
- Do NOT add dependencies without justification in the PR description
- Do NOT write `fetch` in useEffect — use TanStack Query

---

# REFERENCE FILES

For deeper guidance on specific topics, read these on demand:

- `references/effect-patterns.md` — Cancellation patterns, subscription
  cleanup, and the full "do you actually need this effect?" decision tree
- `references/typescript-patterns.md` — Generic components, polymorphic
  `as` prop, forwardRef with generics, discriminated union props
- `references/performance-guide.md` — When memoization is justified,
  profiling workflow, TanStack Table column def stability, context
  splitting patterns
- `references/testing-patterns.md` — Vitest component tests, a11y
  checks, loading/error/retry state coverage, race condition tests
