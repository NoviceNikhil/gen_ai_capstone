# Testing Patterns Reference

Read this file when writing Vitest component tests, interaction tests,
or accessibility checks.

## Vitest + Testing Library setup

```tsx
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, it, expect, vi } from "vitest"
```

## Test loading, error, and empty states explicitly

Every data-fetching component needs these three tests at minimum:

```tsx
it("shows skeleton while loading", () => {
  // Mock TanStack Query to return loading state
  render(<UserList />)
  expect(screen.getByTestId("skeleton")).toBeInTheDocument()
})

it("shows error message on failure", async () => {
  // Mock query to reject
  render(<UserList />)
  expect(await screen.findByRole("alert")).toHaveTextContent(/failed/i)
})

it("shows empty state when no results", async () => {
  // Mock query to return []
  render(<UserList />)
  expect(await screen.findByText(/no users/i)).toBeInTheDocument()
})
```

## Test keyboard navigation

```tsx
it("supports keyboard navigation", async () => {
  const user = userEvent.setup()
  render(<DropdownMenu />)

  const trigger = screen.getByRole("button")
  await user.tab()
  expect(trigger).toHaveFocus()

  await user.keyboard("{Enter}")
  expect(screen.getByRole("menu")).toBeVisible()

  await user.keyboard("{ArrowDown}")
  expect(screen.getByRole("menuitem", { name: "Edit" })).toHaveFocus()

  await user.keyboard("{Escape}")
  expect(screen.queryByRole("menu")).not.toBeInTheDocument()
})
```

## Test form validation

```tsx
it("shows validation errors and prevents submission", async () => {
  const user = userEvent.setup()
  const onSubmit = vi.fn()
  render(<ContactForm onSubmit={onSubmit} />)

  // Submit without filling required fields
  await user.click(screen.getByRole("button", { name: /submit/i }))

  expect(screen.getByText(/email is required/i)).toBeInTheDocument()
  expect(onSubmit).not.toHaveBeenCalled()
})
```

## Test race conditions

```tsx
it("ignores stale responses", async () => {
  let resolvers: Array<(v: any) => void> = []
  vi.mocked(fetchUser).mockImplementation(
    () => new Promise(r => resolvers.push(r))
  )

  const { rerender } = render(<UserProfile id="1" />)

  // First request starts
  expect(resolvers).toHaveLength(1)

  // ID changes before first request resolves
  rerender(<UserProfile id="2" />)
  expect(resolvers).toHaveLength(2)

  // Resolve requests out of order (second first)
  resolvers[1]({ id: "2", name: "Bob" })
  resolvers[0]({ id: "1", name: "Alice" })

  await waitFor(() => {
    // Should show Bob (id=2), not Alice (id=1)
    expect(screen.getByText("Bob")).toBeInTheDocument()
    expect(screen.queryByText("Alice")).not.toBeInTheDocument()
  })
})
```

## Accessibility smoke test

```tsx
import { axe, toHaveNoViolations } from "jest-axe"
expect.extend(toHaveNoViolations)

it("has no a11y violations", async () => {
  const { container } = render(<LoginForm />)
  const results = await axe(container)
  expect(results).toHaveNoViolations()
})
```

## What to test vs what to skip

Test:
- User-visible behavior (renders, interactions, navigation)
- Loading/error/empty states
- Form validation flows
- Keyboard accessibility
- Race conditions in async components

Skip:
- Implementation details (internal state values, hook internals)
- Styling (unless functionally meaningful)
- Third-party library internals (shadcn, Radix)
- Static content that won't change
