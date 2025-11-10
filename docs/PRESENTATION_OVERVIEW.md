## Gfundreach Presentation Guide

Audience: Instructor / technical reviewer
Goal: Explain architecture, data flows, and implementation decisions without exposing sensitive operational details.

---

### 1. Product Elevator Pitch
Gfundreach is a social fundraising web app: users launch campaigns, post ongoing updates, donate, form groups, and chat in real time. The platform focuses on mobile‑first UX, resilient data fetching, and clear safety controls around donations.

Key value pillars:
- Transparency: progress bars, supporter counts, update history.
- Engagement: community updates, group discussions, direct messaging.
- Safety & Integrity: transactional donation cap enforcement and moderation reporting.

---

### 2. High-Level Architecture
Frontend: React (Vite) SPA with context providers for Auth, Theme, and Search. Routing via React Router.
Backend Services: Firebase (Auth, Firestore, optional Storage). Some operations (e.g., crediting recipients) are designed for Cloud Functions (not all included here to keep core lean).
State/Data Layer: Direct Firestore SDK calls + lightweight usage of React Query pattern (some migrated pages). Real‑time features (messages, conversations, notifications) use onSnapshot listeners; analytics rely on transactional writes and aggregate queries with client fallbacks when composite indexes are missing.

Key principles:
- Progressive Enhancement: Attempt indexed query → fallback broader query → client filtering.
- Defensive Data Access: Multi‑strategy fetches reduce hard dependency on indexes.
- Minimal Overfetch: Narrow subcollection reads (e.g., updates, messages) with pagination or capped limits.
- Resilience: Error boundaries and cautious try/catch blocks keep UI usable even when a query fails.

---

### 3. Data Model (Core Collections)
users: Profile + wallet summary (walletBalance, totals, verification flags, privacy settings)
posts: Campaign documents (goal/current amounts, supporters, meta). Subcollections: updates/, views/, visitors/
transactions: Donation, topup, withdraw records (type, amount, postId, donorId, recipientId, timestamps)
friendships: Deterministic id pair records with status (pending|accepted) + requestedBy
groups: Group metadata + subcollections members/, posts/
conversations: Direct or group chat metadata; subcollection messages/
notifications: Individual or grouped event notifications
savedItems & collections: User bookmarking system
reports: Moderation reports (targetType, reason, meta)
verificationCodes: Ephemeral codes for register/login 2FA flows

Aggregate fields (e.g., supporters, likesCount) updated transactionally or via atomic increments.

---

### 4. Authentication & Authorization (AuthContext)
File: `src/contexts/AuthContext.jsx`
Responsibilities:
- Wraps Firebase Auth, persists sessions locally.
- Normalizes error messages for common auth errors.
- Ensures a Firestore user profile document exists upon sign‑up or social login.
- Exposes: currentUser (Auth), userProfile (Firestore doc), signup/login/logout, fetchUserProfile.

Design Decisions:
- Separate Firebase Auth user vs. richer profile doc to allow additional fields (wallet, role, verification).
- Defensive creation & merge on Google sign‑in to backfill missing display names/photo URLs.

---

### 5. Theming (ThemeContext)
File: `src/contexts/ThemeContext.jsx`
- Maintains dark/light mode preference in localStorage.
- Adds a transitional class to root for polished theme switching while honoring reduced motion settings.

---

### 6. Search State (SearchContext)
File: `src/contexts/SearchContext.jsx`
- Lightweight UI state (open/close, query string) decoupled from actual Firestore searches (executed within pages/components).

---

### 7. Utilities Deep Dive (Key Files)
These modules encapsulate focused logic so components stay declarative.

1. `numberFormat.js` – Compact numeric & currency formatting with digit budget logic and suffixes (k/M/B). Limits significant digits to preserve layout.
2. `walletHelpers.js` – Source of truth for wallet stats: fetches donor+recipient transactions; deduplicates by id; computes totalDonated/totalReceived ignoring non‑donation transaction types.
3. `uploadHelpers.js` + `imageUtils.js` – Progressive image handling:
   - Pre‑compression (canvas / ImageBitmap) aiming for target KB.
   - Retryable Firebase Storage upload (resumable) with exponential backoff.
   - Fallback to base64 storage pathway (`base64Upload.js`) when Storage disabled or upload fails.
4. `base64Upload.js` – Converts images to compressed base64 for embedding directly in documents (simple deployments without Storage).
5. `viewTracker.js` – Campaign view tracking (one view doc per event + a visitors doc keyed by uid/device) with client throttle to avoid double counts under React strict mode.
6. `friends.js` – Deterministic friendship ids; CRUD for friend requests, acceptance, listing. Uses composite query fallback logic for missing indexes.
7. `groups.js` – Group lifecycle (create, join/leave, role change, moderation of posts). Defensive cleanups (delete empty groups). Notifications triggered for membership and content events.
8. `messaging.js` – Conversations & messages:
   - Deterministic 1:1 ids; group conversation creation with roles and pending invites.
   - Multi‑type messages (text, image, audio, campaign card, system) all stored in Firestore subcollection.
   - Real‑time subscriptions with pagination (startAfter) and mention notifications.
   - Unread count increments per participant; markConversationAsRead resets user’s unread bucket.
9. `notifications.js` – Creation & grouping (likes/shares aggregated with counters + recent names) to mitigate spam volume.
10. `savedItems.js` – Bookmark system avoiding large base64 images (skips them) and supports user collections with itemCount recalculation.
11. `reports.js` – Single function to file moderation reports with structured metadata.
12. `emailVerification.js` – Ephemeral verification code lifecycle (store, verify, attempts threshold, cleanup) plus dev fallback logging.
13. `cardHelpers.js` – React hook powering like/share/save buttons with optimistic UI and Firestore atomic operations.

Patterns Employed:
- Fallback Queries: Try strict indexed variant → fallback looser query → client filter/sort.
- Size Guards: Base64 and image uploads enforce approximate limits to avoid Firestore 1MB doc ceiling.
- Optimistic UI: Likes, saves update local state immediately; server errors logged, not fatal.

---

### 8. Components (Selected Roles)
High-level categorization; each is lean, delegating heavy logic to utils.

Layout & Navigation:
- `Layout.jsx`: Global shell; wraps pages, includes nav bars / sidebars.
- `Navbar.jsx`, `Sidebar.jsx`, `RightSidebar.jsx`: Sectioned navigation & quick access panels.

Content Cards:
- `PostCard.jsx`, `CommunityPostCard.jsx`, `GroupItemCard.jsx`, `CampaignContextCard.jsx`: Reusable display of campaign/update/group info. Use `useCardInteractions` for engagement actions.

Interactive / Overlays:
- `ImageViewer.jsx`, `MediaViewer.jsx`, `ShareToChatModal.jsx`, `NotificationDropdown.jsx` – Focused UI overlays/modals with controlled mount/unmount for performance.

Campaign Features:
- `CampaignUpdates.jsx`: Lists and creates campaign update posts (subcollection reads, author gating).
- `CampaignMilestones.jsx`: Visual progress markers tied to funding thresholds.

Chat Panels:
- `ChatInfoPanel.jsx`, `PersonalChatInfoPanel.jsx`: Show metadata, participants, shared media aggregates (leveraging messaging utilities).

User Interaction:
- `AddFriendButton.jsx`: Renders appropriate call‑to‑action based on friendship state (none, pending, friends) using `friends.js`.
- `MessageButton.jsx`: Shortcut to open / create a direct conversation.

System / Safety:
- `ErrorBoundary.jsx`: Catches render errors and prevents full app crash.
- `ProtectedRoute.jsx`: Redirect gate for authenticated routes.

Visual Enhancement:
- `NeuronBackground.jsx`: Decorative / ambient visual layer (non‑critical to logic).

---

### 9. Pages (Workflow Hubs)
Each page composes components + targeted Firestore interactions.

- `Home.jsx`: Aggregated feed (campaign posts + updates + group content) sorted by recency.
- `Explore.jsx`: Discovery/search oriented listing.
- `CreateCampaign.jsx` / `EditCampaign.jsx`: Form flows; image compression & upload; transactional donation cap logic is in donation handling (detail page).
- `CampaignDetail.jsx`: Core campaign view with donation form, supporters list, real-time like/share state, update creation (if owner), and milestone visualization.
- `CampaignStats.jsx`: Owner-only analytics (donations trend, distribution, recent donations). Uses hardened multi-strategy fetch + client series construction.
- `CampaignUpdates.jsx` (component used inside detail/profile contexts): Update subcollection listing.
- `Profile.jsx`: Multi-tab (personal info, campaigns, community posts, donations sent/received, friends) with privacy controls and multi-level fallback loading for community updates.
- `Wallet.jsx`: Wallet balance, top-up/withdraw (simulated), transaction history merging donor and recipient perspectives without duplicates.
- `Messages.jsx` + `ChatWindow.jsx`: Conversations list & active chat, real-time subscription + pagination, message composer (text, future media).
- `Group.jsx`, `GroupDetail.jsx`, `CreateCampaignGroup.jsx`: Group discovery + membership + associated campaign donor group chat setup.
- `Register.jsx`, `Login.jsx`, `ForgotPassword.jsx`, `Welcome.jsx`: Auth flows & onboarding.
- `Saved.jsx`: Listing of user’s saved items & collections.
- `TopDonors.jsx`: (If present) ranking or leaderboard (not fully elaborated here).
- Admin Section (`admin/`): Dashboards for moderation, verification, and platform-level KPIs.

Routing Guard Patterns:
- Protected routes ensure unauthenticated users are redirected or shown login prompts.
- Owner/role checks (e.g., stats, edit, delete) performed client-side with graceful fallback (alerts + navigation) if unauthorized.

---

### 10. Donation Flow (Key Logic)
- User enters amount → validation (positive, balance sufficient, within computed cap).
- Firestore `runTransaction` ensures atomic update: update post totals, supporters count, donor wallet balance, unique recipients helped.
- Post-refresh & notifications (donor receipt + campaign owner + completion broadcast if goal crossed) executed best-effort outside transaction to avoid user-facing failure if non-critical side effect fails.

Funding Cap Calculation:
goal + min(5% of goal, $50) margin → prevents overshoot but absorbs concurrency race conditions.

---

### 11. Real-Time Messaging & Presence
Technologies: Firestore realtime snapshots (conversations + messages subcollection).
Unread counts: Per-user counters stored inside conversation doc; incremented on message write; reset by markConversationAsRead.
Typing indicators: Timestamp entries keyed by user id; clients can display “typing…” if recent.
Media & Voice Messages: Stored inline as base64 Data URLs subject to size guard (for simplicity, avoids Storage dependency).
Campaign Sharing: Special message type embedding campaign snapshot for context inside chats.

---

### 12. Performance & Resilience Strategies
- Image compression before any upload to reduce network cost.
- Conditional lazy fallback queries mitigate missing composite indexes (fewer 500 errors in demos).
- Client-side zero-filled time series generation ensures consistent chart axes even with sparse days.
- Deduplication maps for transactions and friendships ensure idempotent merges.
- Optimistic UI for micro-interactions reduces perceived latency.

---

### 13. Security & Moderation (Conceptual)
Firestore rules (documented separately) enforce:
- Auth-required reads for private data (messages, friendships).
- Write role checks (campaign author vs. admin vs. group mod).
- Restrictive updates (e.g., limiting which fields can change in conversations/messages).
Reporting (`reports.js`) allows users to flag inappropriate content; moderators act through admin dashboard (implementation beyond the scope of this guide).

---

### 14. Testing Philosophy
Includes sample unit test (number formatting). Structure allows further expansion: utils are pure functions where possible for testability. Critical transactional logic is encapsulated (e.g., donation flow) facilitating future integration tests.

---

### 15. Presentation Talking Points (Cheat Sheet)
1. Start with user journey: Create campaign → share updates → receive donations → engage via chat/groups.
2. Emphasize resilience: multi-fallback queries and error boundaries.
3. Highlight safety: transaction caps and moderation reporting.
4. Show performance care: image compression, compact number formatting, deduped fetches.
5. Close with extensibility: serverless friendly, modular utilities, easy to add new message types or analytics widgets.

---

### 16. Potential Future Enhancements
- Cloud Function aggregation for heavy analytics (reduce client load)
- Full pagination & infinite scroll for all feeds
- Rich media storage (migrate base64 to Storage at scale)
- Advanced notification batching across event types
- Role-based access expansion (organization accounts, team dashboards)

---

### 17. Q&A Prep (Sample Answers)
Q: How do you prevent donation race conditions?  A: Firestore transaction recalculates margins and aborts on overshoot before commit.
Q: What if an index is missing?  A: Catch error, execute broader query (single filter), client-side filter/sort.
Q: Why store some images as base64?  A: Simplifies deployment demos; compression + size guards mitigate bloat; production path already supports Firebase Storage with retries.
Q: How are unread counts tracked?  A: Map field per participant incremented on write; reset to 0 for that user when marking conversation read.
Q: How do you aggregate unique supporters?  A: Campaign document keeps supporters count incrementally; donor list for UI derived from transactions when needed.

---

Use this document as your structured narrative. Tailor depth based on time and audience technical level.
