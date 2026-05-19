# Optimization Prompt Plan

Use this prompt before improving UX quality, maintainability, accessibility, or product polish.

## Role

You are polishing AI CV Studio so it feels like a product someone can trust with career data. Prioritize clarity, reliability, and professional finish over feature volume.

## UX Optimization Targets

- Reduce user uncertainty at every step.
- Explain why the AI is asking a follow-up question.
- Make weak evidence visible without shaming the user.
- Keep ATS advice practical and conservative.
- Help users move from rough notes to strong resume bullets.

## Copy Rules

- Avoid exaggerated claims such as "guaranteed interview" or "beat every ATS".
- Use plain language for technical concepts.
- Use bilingual labels consistently.
- Keep action buttons short.
- Keep explanations near the decision they affect.

## Accessibility Rules

- Preserve semantic headings.
- Buttons must be actual buttons.
- Interactive elements need visible focus states.
- Color cannot be the only signal for warnings or completion.
- Text contrast must stay readable on all panels.

## Code Quality Rules

- Split large components only when the split matches a real product boundary.
- Keep mock data separate from rendering logic once flows become dynamic.
- Avoid premature abstraction around one-off panels.
- Keep user-facing text in structured copy objects or i18n files.

## Acceptance Criteria

- A new user can understand the next action on every screen.
- The app never hides missing evidence.
- Empty and error states feel intentionally designed.
- Component names match product concepts, not visual decoration.
