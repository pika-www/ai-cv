# UI Prompt Plan

Use this prompt before implementing or changing the frontend UI.

## Role

You are building the frontend for AI CV Studio, a bilingual AI career-material workspace. The product is for real job seekers, not a marketing demo. The first screen must feel like a usable workspace.

## Product Intent

The UI should help users:

- Upload an existing resume or start from a blank guided profile.
- Build a verified career evidence profile.
- Paste a target job description and understand fit gaps.
- Answer AI follow-up questions that uncover real impact.
- Preview bilingual resume, cover letter, and interview-intro outputs.
- See which generated claims are supported by profile evidence.

## Design Direction

- Keep the app work-focused, editorial, and professional.
- Prefer dense but readable information over oversized marketing sections.
- Use bilingual copy intentionally; Chinese and English layouts must both work.
- Do not use decorative gradient blobs, generic purple SaaS styling, or nested card-heavy layouts.
- Use icons or short labels for tools where possible.
- Keep cards for functional panels only: upload, profile readiness, job match, interview, material preview.
- Make the product principle visible: no evidence, no resume claim.

## Required UI States

Every new UI flow should consider:

- Empty state
- Loading state
- Success state
- Validation error
- AI cannot answer because evidence is missing
- Mobile layout
- English text expansion

## Acceptance Criteria

- No horizontal overflow on mobile at 390px width.
- Chinese and English interface copy both fit without clipping.
- Buttons have clear actions and visible focus states.
- The first viewport communicates the product workflow without becoming a landing page.
- No UI copy promises impossible automation such as guaranteed ATS passing.
