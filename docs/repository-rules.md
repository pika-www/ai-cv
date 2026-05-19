# Repository Rules

Follow these rules before every commit.

## Do Not Commit

- `node_modules/`
- `dist/`
- `.env`
- `.env.local`
- API keys
- local editor settings
- OS files such as `.DS_Store`
- generated logs
- temporary screenshots unless explicitly needed for documentation

## Commit

- Source code
- Public static assets required by the app
- `package.json`
- `package-lock.json`
- TypeScript and Vite config
- Documentation under `docs/`

## Required Checks

Run before pushing frontend changes:

```bash
npm run lint
npm run build
git status --short
```

`git status --short` must not show dependency folders or build output.

## Branch and Commit Guidance

- Keep commits focused on one product change.
- Use clear commit messages, for example `Add profile intake form`.
- Do not mix unrelated refactors with feature work.
- Never force-push shared branches unless the product owner explicitly asks.

## Environment Guidance

Runtime secrets must live in local environment files and deployment settings, never in Git.

Example future variables:

```bash
VITE_API_BASE_URL=http://localhost:4000
```
