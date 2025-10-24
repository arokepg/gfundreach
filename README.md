# Gfundreach – Social Fundraising Platform

A modern social platform for fundraising that connects people in need with donors. It blends a familiar social feed with campaigns, community posts, and groups, and is optimized for a smooth, stable UX.

## 🚀 Tech Stack

- React 19 + Vite 7
- React Router 7
- Tailwind CSS 4
- Material UI 7 (icons + components)
- Firebase 12 (Auth, Firestore, Storage)
- React Query (@tanstack/react-query) for server-state, caching, retries
- Axios (HTTP utilities)
- Recharts (charts)
- Node 20 (runtime for tooling and optional server)
- ESLint 9

CI/CD and Hosting
- GitHub Actions: lint → test (if present) → build → artifact
- Vercel (production deploy from CI)
- Optional: Firebase Hosting, GHCR (container), Fly.io (app deploy)

## ✨ Key Features

- Authentication: email/password (Google optional), protected routes
- Home feed: campaigns, campaign updates (community posts), and group items merged and sorted by recency
- Groups: create/join/leave, roles (Admin/Moderator/Member), approve/reject posts, edit name/description/banner, soft delete; members show displayName/photo
- Saved items: collections, horizontal card layout, header count aligned
- Error resilience: global ErrorBoundary; resilient Firestore fetching that avoids white screens and reduces long-lived listeners
- React Query: automatic loading states, error handling, and caching for Home, Saved, and Groups

## 📁 Project Structure (selected)

```
src/
  components/
    ErrorBoundary.jsx
    PostCard.jsx
    CommunityPostCard.jsx
    GroupItemCard.jsx
    Layout.jsx
  contexts/
    AuthContext.jsx
    SearchContext.jsx
    ThemeContext.jsx
  lib/
    queryClient.js
  pages/
    user/
      Home.jsx
      Saved.jsx
      Group.jsx
      GroupDetail.jsx
      CreateCampaign.jsx
      CampaignDetail.jsx
      CommunityPostDetail.jsx
      Profile.jsx
    admin/
      AdminBackfill.jsx
  utils/
    groups.js
    savedItems.js
    notifications.js
```

## ⚙️ React Query

- Central client at `src/lib/queryClient.js` with sensible defaults (staleTime 1m, retry 1)
- Pages migrated: `Home.jsx`, `Saved.jsx`, `Group.jsx`
- Mutations invalidate targeted queries to keep UI in sync

## 🧱 CI/CD (GitHub Actions)

Workflow: `.github/workflows/main.yml`
- Triggers on pushes/PRs to `master`
- Steps: Install → Lint → Test (`npm test --if-present`) → Build → Upload artifact
- Production deploy to Vercel when secrets are present
- Optional deploys: Firebase Hosting, GHCR image, Fly.io

## 🧭 Notable UX & Stability Improvements

- ErrorBoundary wraps routes to prevent white screens
- Notifications only subscribe when dropdown is open; falls back to one-time fetch on error
- Home feed refetches on navigation (route key) while leveraging cache

## 🧪 Testing

No tests are bundled yet. The CI workflow runs `npm test --if-present`, so you can add Jest/RTL later and it will execute automatically.

## 📝 License

MIT

---

Questions or ideas? Open an issue or start a discussion. Let's make fundraising accessible, transparent, and fast. 
│   ├── index.js           # Express server
