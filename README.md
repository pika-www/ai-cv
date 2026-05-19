# AI CV Studio

A bilingual web interface for building job-ready career materials from verified experience evidence.

## What this frontend covers

- Bilingual Chinese / English interface switch
- Resume upload and blank profile entry points
- Career profile readiness view
- Target job / ATS match analysis preview
- AI follow-up question panel for experience mining
- Resume, cover letter, and source-trace material preview

This is the first product interface pass. Data is currently mocked in the React app while the backend API contract is being shaped.

## Run locally

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Architecture direction

The product should stay SaaS-ready while keeping a path to future open-source or local deployment:

- Keep AI prompts and providers behind backend APIs.
- Keep user-facing copy structured for i18n instead of hard-coded text across components.
- Keep export formats portable: Markdown, PDF, DOCX, and JSON.
- Keep generated claims traceable to profile evidence or target job descriptions.
