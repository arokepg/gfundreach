# Gfundreach – Social Fundraising Platform

A modern social platform for fundraising that connects people in need with donors. It blends a familiar social feed with campaigns, community posts, and groups, and is optimized for a smooth, stable UX.

## 🚀 Tech Stack

- React 19 + Vite 7
- React Router 7
- Tailwind CSS 4
- Material UI 7 (icons + components)
- Firebase 12 (Auth, Firestore)
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

- Authentication: email/password (Google optional), protected routes, robust error messages and persistence
- Home feed: campaigns, campaign updates (community posts), and group items merged and sorted by recency
- Groups: create/join/leave, roles (Admin/Moderator/Member), approve/reject posts, edit name/description/banner, soft delete; members show displayName/photo
- Saved items: collections, horizontal card layout, header count aligned
- Notifications: auto “mark all as read” when the bell opens; manual button still available
- Campaign completion UX: progress bar turns blue with a shimmering animation and a “Completed” badge when the goal is reached
- Donation safety: client enforces a strict donation cap (see below) via Firestore transactions; no over-funding
- Wallet and stats: profile shows “Helped” and “Helpers” counts; wallet displays effective balance and totals; campaign stats surface unique donors, likes, shares, views/visitors
- Friends: send/accept/cancel friend requests and unfriend from campaign author cards via a smart Add Friend button
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
      AdminDashboard.jsx
  utils/
    groups.js
    savedItems.js
    notifications.js

docs/
  FIRESTORE_RULES.md      # Security rules reference (reference-only)
```

## ⚙️ React Query

- Central client at `src/lib/queryClient.js` with sensible defaults (staleTime 1m, retry 1)
- Pages migrated: `Home.jsx`, `Saved.jsx`, `Group.jsx`
- Mutations invalidate targeted queries to keep UI in sync

## 💸 Donation Limits & Transactions

- Donations are executed inside a Firestore `runTransaction` to ensure atomic updates.
- Cap policy: donors cannot exceed the campaign goal; a tiny margin is allowed to accommodate rounding and concurrent donations (min $1, up to 5% capped at $50). The UI disables the input and sets the max accordingly.
- When a donation pushes a campaign to completion, the feed/card and detail pages switch to a blue, animated completion bar and a “Completed” badge.
- Recipient balance updates are not performed from the client (to respect Firestore security rules). Use the provided Cloud Function to safely credit recipients.

Details and sample backend code: see `docs/CLOUD_FUNCTIONS.md`.

## 🔔 Notifications

- Opening the notification dropdown automatically marks all items as read for the user.
- Completion events: when a campaign reaches its goal, all donors are notified.

## 📊 Analytics & Stats

- Campaign analytics include: total donations, unique donors, likes, shares, views, visitors, and trend charts.
- Donation figures are derived from `transactions` (type = `donation`) to ensure accuracy.
- Profile surfaces two derived stats:
  - Helped: unique recipients a user has donated to
  - Helpers: unique donors who have donated to the user’s campaigns

## 👥 Friends

- Minimal, privacy-friendly friend system using a symmetric `friendships` collection:
  - Status values: `pending`, `accepted`
  - Deterministic doc id: `minUid_maxUid`
- UI: `AddFriendButton` appears on user profiles for non-owners and supports Add, Accept, Cancel, and Unfriend.
- Friends-only feed: Home page "Friends" tab filters campaigns and posts to show only content from your friends.
- Profile friends list: View friends on user profiles with privacy controls (public/private toggle for your own list).
- No composite index required; all queries that would need one have client-side fallbacks.

## 🧱 CI/CD (GitHub Actions)

Workflow: `.github/workflows/main.yml`
- Triggers on pushes/PRs to `master`
- Steps: Install → Lint → Test (`npm test --if-present`) → Build → Upload artifact
- Production deploy to Vercel is gated behind a secrets check to avoid YAML parser issues and skipped safely when secrets are missing
- Optional deploys: Firebase Hosting, GHCR image, Fly.io

## 🗂️ Firestore Indexes (optional)

The app works without composite indexes thanks to client-side fallbacks. For scale, consider adding:

- transactions: donorId asc, createdAt desc
- transactions: recipientId asc, createdAt desc
- friendships: status asc, users array-contains
- updates (collection group): authorId asc, createdAt desc

<!-- duplicate CI/CD section removed -->

## 🧭 Notable UX & Stability Improvements

- ErrorBoundary wraps routes to prevent white screens
- Notification dropdown gracefully handles real-time errors by falling back to a one-time fetch
- Home feed refetches on navigation (route key) while leveraging cache

## 🧪 Testing

This repo uses Vitest + React Testing Library.

Scripts:

```
npm run test
```

Config:
- Vitest is configured in `vite.config.js` with `jsdom` and `src/setupTests.js` (jest-dom matchers).
- Example test at `src/utils/__tests__/numberFormat.test.js`.

## 🚀 Getting Started

1) Install dependencies

```
npm install
```

2) Create a Firebase project and set environment variables (Vercel or `.env.local`). You’ll need config for Auth and Firestore.

3) Start the dev server

```
npm run dev
```

4) Optional: Deploy the Cloud Function in `docs/CLOUD_FUNCTIONS.md` to safely credit recipients on donations.

### Media uploads (Base64 in Firestore)

- This project stores images as base64 data URLs inside Firestore documents (no Firebase Storage required).
- Fields like `imageUrl`, `bannerUrl` contain data URLs (`data:image/...`).
- Optionally store `imageSizeKB` on writes and enforce limits (e.g., <= 500 KB) in Firestore rules.
- See `docs/FIRESTORE_RULES.md` for notes and examples on image constraints.

## 🛡️ Admin & Moderation

- **Platform Admin Dashboard**: Available at `/admin` (requires `userProfile.role === 'admin'`)
  - Overview with KPI cards and quick actions
  - **User Verification**: Admin can verify users and campaigns with blue checkmark badges
  - Campaign management with pause/activate controls
  - Content moderation with soft-delete and 3-day undo
  - Search functionality across all tabs
- **Group Admin Dashboard**: Group owners/admins/moderators can manage their specific group
  - Scoped moderation tools
  - Member management
  - Post approval workflow
  - Group analytics
- See `docs/FIRESTORE_RULES.md` for security rules and `docs/GROUP_ADMIN_DASHBOARD.md` for implementation details

## 🤝 Team Fundraising

- Multiple users can join a single campaign as a "Team"
- Campaign page shows team leaderboard with individual contributions
- Friendly competition between team members
- Team leaders can manage team settings
- See `docs/TEAM_FUNDRAISING.md` for full implementation guide

## 💬 Direct Messaging (DMs)

- Potential donors can send private messages to campaign creators
- Real-time messaging with Firestore listeners
- Unread count badges
- Conversations list with search
- See `docs/DIRECT_MESSAGING.md` for architecture and implementation tutorial

### First admin (bootstrap)

Use a trusted environment to set a user's role to `admin`:

```bash
# Using the admin script with service account
node scripts/make-admin.cjs <USER_UID> --role=admin --serviceAccount=/path/to/serviceAccountKey.json
```

Alternatively, manually set `role = "admin"` on `/users/<uid>` document in the Firebase Console.

## 📝 License

MIT

---

Questions or ideas? Open an issue or start a discussion. Let's make fundraising accessible, transparent, and fast.
