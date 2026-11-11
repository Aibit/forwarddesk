# ForwardDesk — Firebase backend (optional live mode)

Two modes, chosen on the start screen (first visit; `?demo` skips it and "Try the demo" is remembered):
- **Demo** — in-browser SAMPLE data, no login; the Firebase SDK is not even downloaded.
- **Real** — self-serve accounts: Create account (email + password; Google optional) → verify email → onboarding
  (company name, country, base currency, main ports, language; creator = owner) → an empty account (no sample data)
  with a Get started checklist (agents manual/CSV, client, first job, invite team). Account page: company profile,
  team (owner / staff / client), invite links, remove members. Invites are join-by-link/code; ForwardDesk sends no
  invite emails (only Firebase's own verification / password-reset emails).

Until a backend config is present, real-mode buttons show "Accounts open shortly — try the demo" (no fake success).

## Single switch to open accounts
Paste the web config into `BUILT_IN` in `src/backend/config.ts` (or build with `VITE_FB_CONFIG='{…}'`), rebuild, deploy.
That is the only code change. Optional: `VITE_GOOGLE_SIGNIN=1` shows "Continue with Google" (off by default).

## Backend-agnostic UI
UI components (`src/backend/Accounts.tsx`, `AuthBar.tsx`) talk only to `session.ts` (`act`, `accounts()`, `signIn`,
`signOut`, `useSession`) and the `AccountsAdapter` + `Writer` interfaces in `bridge.ts`. `live.ts` is the Firebase
implementation (`export const adapter`). Another backend (PocketBase / Postgres API, EU-hosted) implements:
- `AccountsAdapter`: signIn, signUp (+ send verification email), resetPassword, resendVerification, recheckVerified,
  createAccount, joinWithCode, joinLink, watchTeam, createInvite, revokeInvite, removeMember, updateAccount, resume,
  signOut (googleSignIn optional);
- set the session (`setSession`: mode `verify` / `onboard` / `live`, uid, email, role staff|client, owner, orgId, orgName);
- the data `Writer` (bridge.w) + hydrate the stores (clients, quotes, jobs, agents/CRM, activities, tariffs, MSDS, billing);
- server-side enforcement equal to `firestore.rules` (tenant isolation, staff-only CRM/billing, invite checks).
Then point `session.ts`'s `live()` import at the new module.

**Compliance:** Google Firebase is US-hosted infrastructure (Firebase Auth data is processed in the US).
Keep it to sample/demo data until the sanctions questions are cleared. The app shows this note in the sign-in dialog,
the staff live bar and Company settings.

## Data model (`orgs/demo/...`)
See the header of `firestore.rules`. Staff-only: `clients/*` (margin), `quotes/*/private/costs` (buy rates/margins),
`jobInternal/*` (line rebate status), `settings/tariffsPrivate` (rebate %), `agentCrm/*` (agent CRM: status, contacts,
payment terms, credit, rating, KYC, notes, tags) and `agentActivities/*` (agent timeline). Client-readable (own `clientId` only):
`clientPublic`, `lanes`, `agentPrefs`, `jobs`, `quotes`, `msds`; any member: `agents` (directory fields only — the rules refuse CRM fields there), `settings/tariffs`, `settings/msdsRules`.
MSDS files are stored as base64 in Firestore (max 640 KB in live mode) because Cloud Storage needs the paid Blaze plan.

## Local (no project needed)
```
npm run rules:test                    # 161 rules unit tests on the emulator (needs Java 21)
npm run e2e:realmode                  # with emulators + dev:emulator (port 5399) running: sign-up → verify → onboarding → agent → invite → join → isolation
npm run emulators                     # firestore + auth emulators
npm run seed:emulator                 # sample data + test accounts -> $ACCOUNTS_FILE
FIREBASE_EMULATOR=1 npm run check:denials
npm run dev:emulator                  # app against the emulators
```

## Live setup (Spark / free plan only — never enable billing)
1. `firebase login` (user signs in) → `firebase projects:list` → use or create `forwarddesk-…`.
2. `firebase apps:create WEB "ForwardDesk web"` → `firebase apps:sdkconfig WEB <appId>` → paste the config into
   `src/backend/config.ts` (`BUILT_IN`). The web config is public by design; security comes from the rules.
3. Firestore database `(default)`, Standard edition, location `eur3`.
4. Auth (console → Authentication → Sign-in method): enable **Email/Password** (public sign-up stays ON — self-serve
   accounts are wanted; this reverses the earlier "disable sign-up" plan). Optional: enable **Google** and build with
   `VITE_GOOGLE_SIGNIN=1`. Settings → **Authorized domains**: add `aibit.github.io`. Templates: set the sender name
   for the verification / password-reset emails (Firebase sends them).
5. `firebase deploy --only firestore:rules,firestore:indexes --project <id>`
6. `FB_CONFIG='<config json>' npm run seed` → `/workspace/forwarddesk-test-accounts.txt` (chmod 600, never committed).
7. `FB_CONFIG='<config json>' npm run check:denials` — live proof that cross-client and buy-rate reads are refused.
8. Build and deploy to GitHub Pages as usual.
