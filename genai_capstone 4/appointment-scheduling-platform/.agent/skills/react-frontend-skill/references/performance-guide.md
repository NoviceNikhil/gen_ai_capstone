# Performance Guide

Read this file when you need to add memoization, fix re-render issues,
or optimize TanStack Table / heavy list rendering.

## When memoization is justified

useMemo — use when:
- Computing a value from a large dataset (filtering/sorting 1000+ items)
- Creating an object/array passed to a memoized child as a prop
- A dependency of another hook that checks referential equality

useCallback — use when:
- Passed to a React.memo'd child component
- Used in a useEffect dependency array
- Required by a third-party library for stable reference (e.g., map
  event handlers, TanStack Table callbacks)

React.memo — use when:
- Component receives the same props frequently but parent re-renders
  often for unrelated reasons
- Component is expensive to render (deep tree, heavy computation)
- You have profiling evidence showing unnecessary re-renders

## When memoization is NOT justified

- Single-use components that render once or rarely
- Components that receive new props on nearly every render anyway
  (memo comparison is wasted work)
- Simple components (a few divs + text)
- "Just in case" — memo has a cost (shallow comparison on every render)

## TanStack Table column definitions

Column defs MUST be stable. This is the most common perf bug with
TanStack Table:

Wrong (creates new array every render → infinite loop):
```tsx
function DataTable({ data }: Props) {
  const columns: ColumnDef<Row>[] = [
    { accessorKey: "name", header: "Name" },
  ]
  return <DataTableInner columns={columns} data={data} />
}
```

Right (stable reference):
```tsx
const columns: ColumnDef<Row>[] = [
  { accessorKey: "name", header: "Name" },
]

function DataTable({ data }: Props) {
  return <DataTableInner columns={columns} data={data} />
}
```

Or if columns depend on props:
```tsx
const columns = useMemo<ColumnDef<Row>[]>(() => [
  { accessorKey: "name", header: "Name" },
  {
    id: "actions",
    cell: ({ row }) => <Actions id={row.original.id} onDelete={onDelete} />,
  },
], [onDelete])
```

## Context splitting

Wrong (everything re-renders on any change):
```tsx
const AppContext = createContext({ user, theme, locale, notifications })
```

Right (consumers only re-render for their slice):
```tsx
const UserContext = createContext(user)
const ThemeContext = createContext(theme)
const LocaleContext = createContext(locale)
```

Or better: use Zustand with selectors:
```tsx
const useStore = create((set) => ({
  user: null,
  theme: "light",
  setTheme: (t) => set({ theme: t }),
}))

// Component only re-renders when theme changes
const theme = useStore((s) => s.theme)
```

## Profiling workflow

1. Open React DevTools Profiler
2. Record a session reproducing the slow interaction
3. Look for components that re-render but produce identical output
4. Only THEN add memo/useMemo/useCallback to those specific components
5. Re-profile to verify improvement

Never optimize without profiling evidence.
