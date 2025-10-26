# CI/CD Rebuild Guide

This repo includes a flexible GitHub Actions pipeline that can deploy to Vercel, Firebase Hosting, or Fly.io. Choose ONE target by setting a repo variable and the necessary secrets.

## Overview

- Workflow: `.github/workflows/main.yml`
- Jobs:
  - build-test: Lint → (optional) Test → Build → Upload artifact
  - deploy: Downloads artifact and deploys to the selected target
- Node: 20.x
- Caching: npm cache via `actions/setup-node`

## Choose a Deploy Target

Set a repository variable named `DEPLOY_TARGET` to one of:

- `vercel` (default if not set)
- `firebase`
- `fly`
- `none` (skip deployment)

Create the variable:
- GitHub → Settings → Secrets and variables → Actions → Variables → New variable
- Name: `DEPLOY_TARGET`
- Value: `vercel` | `firebase` | `fly` | `none`

## Required Secrets per Target

### Vercel
Set these repo secrets (Settings → Secrets and variables → Actions → New repository secret):
- `VERCEL_TOKEN` — Personal token from Vercel
- `VERCEL_ORG_ID` — Your Vercel organization ID
- `VERCEL_PROJECT_ID` — Your Vercel project ID

The action uses `amondnet/vercel-action@v25` and deploys the `dist/` folder with `--prod` on pushes to `master`.

### Firebase Hosting
Set these secrets:
- `FIREBASE_SERVICE_ACCOUNT` — JSON content of a service account (Editor or Firebase Admin)
- `FIREBASE_PROJECT_ID` — Your Firebase project ID

How to create `FIREBASE_SERVICE_ACCOUNT`:
1. Google Cloud Console → IAM & Admin → Service Accounts
2. Create Service Account → Role: Firebase Admin or Project Editor
3. Create Key → JSON → Copy JSON content
4. Add as a secret named `FIREBASE_SERVICE_ACCOUNT` (paste entire JSON)

The workflow uses `FirebaseExtended/action-hosting-deploy@v0` and deploys the built artifact to the `live` channel.

### Fly.io
Set these secrets:
- `FLY_API_TOKEN` — `flyctl auth token`

Requirements:
- A `fly.toml` at the repo root
- Optionally a Dockerfile (the workflow will build & push to GHCR if present)

## How the Workflow Works

1. Trigger: Push to `master` or any PR targeting `master`.
2. `build-test` job:
   - Installs dependencies (prefers `npm ci`)
   - Runs `npm run lint`
   - Runs `npm test --if-present` (safe if no test script)
   - Runs `npm run build` (Vite build → `dist/`)
   - Uploads artifact `web-dist` from `dist/`
3. `deploy` job (only on `master`):
   - Downloads `web-dist` artifact into `dist/`
   - Checks `env.DEPLOY_TARGET` and the presence of required secrets
   - Deploys to the selected target only

## Local Checks

Before pushing, validate locally:
```powershell
npm ci
npm run lint
npm run build
```

If using Firebase:
```powershell
# Optional: preview locally
npm i -g firebase-tools
firebase login
firebase use <YOUR_PROJECT_ID>
firebase deploy --only hosting
```

If using Vercel CLI:
```powershell
npm i -g vercel
vercel pull --yes --environment=preview --token %VERCEL_TOKEN%
vercel build --token %VERCEL_TOKEN%
vercel deploy --prebuilt --token %VERCEL_TOKEN%
```

## Notes
- The analyzer may warn about `${{ secrets.* }}` locally; these are valid in GitHub Actions.
- If you want PR previews, consider adding a separate job using Vercel preview deployments.
- Only one target should be active. The `DEPLOY_TARGET` gating prevents accidental multi-deploys.
