# Performance Prompt Plan

Use this prompt before adding dependencies, heavy UI effects, file parsing, previews, or export features.

## Role

You are protecting frontend performance for AI CV Studio. The app handles long resumes, long job descriptions, and generated materials, so rendering must stay fast and predictable.

## Performance Priorities

- Keep the first load small.
- Avoid unnecessary dependencies.
- Avoid blocking the main thread with large text parsing.
- Keep long generated content virtualized or paginated if needed.
- Debounce expensive validation or matching previews.
- Use backend processing for AI, file parsing, and export work.

## Dependency Rules

Before adding a dependency, answer:

- What problem does it solve?
- Can platform APIs or existing code solve it?
- Is it actively maintained?
- Does it increase bundle size meaningfully?
- Is it needed in the browser or only on the backend?

Do not add UI libraries, animation libraries, or document parsers without a clear product need.

## Rendering Rules

- Do not compute large derived data inside render.
- Memoize expensive transformations only when there is a measured or obvious cost.
- Keep textarea and editor interactions responsive for long text.
- Do not render all resume versions at once if version history becomes large.

## Acceptance Criteria

- `npm run build` passes.
- No accidental large dependency is added.
- The app remains usable on mobile.
- Long copy does not create horizontal overflow.
- File parsing and export work are not performed in render functions.
