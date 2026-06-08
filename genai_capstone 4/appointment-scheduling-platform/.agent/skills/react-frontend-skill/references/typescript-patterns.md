# TypeScript Patterns Reference

Read this file when writing generic components, polymorphic components,
forwardRef with generics, or complex prop typing.

## Infer types from Zod schemas — never duplicate

```tsx
const userSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().email(),
  role: z.enum(["admin", "member", "viewer"]),
})

// Derive — do NOT write a separate interface
type User = z.infer<typeof userSchema>
```

## Discriminated unions over boolean flags

Wrong:
```tsx
type Props = {
  isLoading: boolean
  isError: boolean
  data?: User[]
  error?: Error
}
```

Right:
```tsx
type Props =
  | { status: "loading" }
  | { status: "error"; error: Error }
  | { status: "success"; data: User[] }
```

Exhaustive checking:
```tsx
function render(state: Props) {
  switch (state.status) {
    case "loading": return <Skeleton />
    case "error": return <ErrorDisplay error={state.error} />
    case "success": return <UserList data={state.data} />
    default: {
      const _exhaustive: never = state
      return _exhaustive
    }
  }
}
```

## forwardRef with generics (the tricky one)

LLMs frequently widen the generic to `any`. Correct pattern:

```tsx
import { forwardRef, type Ref, type ComponentPropsWithoutRef } from "react"

// Option A: Type assertion (pragmatic)
function SelectInner<T extends string>(
  props: SelectProps<T>,
  ref: Ref<HTMLButtonElement>
) {
  // ...
}
export const Select = forwardRef(SelectInner) as <T extends string>(
  props: SelectProps<T> & { ref?: Ref<HTMLButtonElement> }
) => React.ReactElement

// Option B: Wrapper component (avoids assertion)
function SelectImpl<T extends string>(
  { ref, ...props }: SelectProps<T> & { ref?: Ref<HTMLButtonElement> }
) {
  // ... use ref directly, no forwardRef needed in React 19
}
```

React 19 note: `ref` is a regular prop now. You can skip `forwardRef`
entirely for new components.

## Polymorphic "as" prop

```tsx
type PolymorphicProps<E extends React.ElementType, P = {}> = P &
  Omit<React.ComponentPropsWithoutRef<E>, keyof P> & {
    as?: E
    ref?: React.ComponentPropsWithRef<E>["ref"]
  }

function Box<E extends React.ElementType = "div">({
  as,
  ...props
}: PolymorphicProps<E>) {
  const Component = as || "div"
  return <Component {...props} />
}
```

## Constrained generics for component props

Avoid unbounded generics. Always constrain:
```tsx
// Too wide — accepts anything
function DataTable<T>(props: { data: T[] }) { ... }

// Constrained — T must have an id
function DataTable<T extends { id: string | number }>(
  props: { data: T[], columns: ColumnDef<T>[] }
) { ... }
```

## Event handler typing

```tsx
// Prefer the specific event type
function handleChange(e: React.ChangeEvent<HTMLInputElement>) { ... }
function handleSubmit(e: React.FormEvent<HTMLFormElement>) { ... }

// For callbacks passed as props
type Props = {
  onChange: (value: string) => void  // NOT (e: Event) => void
}
```
