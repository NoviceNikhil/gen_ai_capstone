# Effect Patterns Reference

Read this file when writing or reviewing useEffect, useLayoutEffect,
or any async side-effect logic.

## Decision tree: do you actually need this effect?

```
Is this data from a server?
  → YES → Use TanStack Query. Stop.

Is this reacting to a user action (click, submit, change)?
  → YES → Handle it in the event handler. Stop.

Is this form state?
  → YES → React Hook Form manages it. Stop.

Is this derived from existing state/props?
  → YES → Compute it during render (or useMemo if expensive). Stop.

Is this subscribing to an external store?
  → YES → Use useSyncExternalStore. Stop.

Is this synchronizing with a browser API (resize, intersection,
media query)?
  → YES → useEffect with cleanup is correct. Continue.

Is this a one-time setup (analytics, focus on mount)?
  → YES → useEffect with [] is correct. Continue.

None of the above?
  → Write a comment explaining why an effect is necessary.
```

## Async effect — the correct pattern

```tsx
useEffect(() => {
  const controller = new AbortController()
  const signal = controller.signal

  async function load() {
    try {
      const res = await fetch(`/api/data/${id}`, { signal })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      // Only set state if not aborted
      if (!signal.aborted) {
        setData(data)
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return
      if (!signal.aborted) {
        setError(err)
      }
    }
  }

  load()
  return () => controller.abort()
}, [id])
```

## Subscription cleanup pattern

```tsx
useEffect(() => {
  const handler = (e: Event) => {
    setState(/* ... */)
  }
  window.addEventListener("resize", handler)
  return () => window.removeEventListener("resize", handler)
}, [])
```

## Stale closure trap

This is wrong — `count` is captured at mount time:
```tsx
useEffect(() => {
  const id = setInterval(() => {
    setCount(count + 1) // stale closure!
  }, 1000)
  return () => clearInterval(id)
}, []) // count not in deps
```

Fixed — use the updater form:
```tsx
useEffect(() => {
  const id = setInterval(() => {
    setCount(prev => prev + 1)
  }, 1000)
  return () => clearInterval(id)
}, [])
```

## Effect chain refactoring

Before (broken — temporal coupling):
```tsx
// Effect 1: fetch user
useEffect(() => { fetchUser(id).then(setUser) }, [id])
// Effect 2: fetch user's projects (depends on effect 1)
useEffect(() => {
  if (user) fetchProjects(user.orgId).then(setProjects)
}, [user])
// Effect 3: sync URL (depends on effect 2)
useEffect(() => {
  if (projects.length) router.push(`?project=${projects[0].id}`)
}, [projects])
```

After (correct — single source of truth):
```tsx
// Use TanStack Query with dependent queries
const { data: user } = useQuery({
  queryKey: ['user', id],
  queryFn: () => fetchUser(id),
})

const { data: projects } = useQuery({
  queryKey: ['projects', user?.orgId],
  queryFn: () => fetchProjects(user!.orgId),
  enabled: !!user?.orgId,
})
// URL sync happens in the query's onSuccess or via derived state
```
