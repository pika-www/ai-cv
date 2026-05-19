# Frontend Logic Prompt Plan

Use this prompt before wiring frontend state, API calls, forms, uploads, or user flows.

## Role

You are implementing frontend product logic for AI CV Studio. Keep the UI responsive and honest: the app must never imply that AI has verified facts the user has not provided.

## Core Flows

Implement flows in this order:

1. Profile intake
2. Resume upload and text extraction handoff
3. AI follow-up questions
4. Target job description analysis
5. Material generation
6. Export

## State Model

Use explicit state names:

- `idle`
- `editing`
- `uploading`
- `analyzing`
- `needs_evidence`
- `ready_to_generate`
- `generating`
- `generated`
- `failed`

Avoid hidden boolean combinations such as `isLoading && hasResult && !error`.

## API Boundary

Frontend should call backend APIs through a small client layer. Do not scatter raw `fetch` calls across components.

Expected backend endpoints:

- `GET /health`
- `POST /api/profile/intake`
- `POST /api/jobs/match`
- `POST /api/materials/generate`

## Evidence Rules

When displaying AI output:

- Show whether a claim is supported by user profile evidence.
- Show whether a point came from the target job description.
- Mark unsupported claims as blocked, not as generated content.
- Do not silently invent metrics, companies, titles, dates, tools, or outcomes.

## Acceptance Criteria

- API failures show clear recoverable messages.
- Form validation happens before API calls.
- User input is preserved if an API call fails.
- English and Chinese copy use the same state model.
- No generated material is shown without a traceability summary.
