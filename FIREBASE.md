# ForwardDesk — Firebase backend (optional live mode)

Demo mode is the default: visitors use in-browser SAMPLE data, no login, and the Firebase SDK is not even downloaded.
"Sign in" switches to live mode (Firestore + Firebase Auth, real-time `onSnapshot`).

**Compliance:** Google Firebase is US-hosted infrastructure (Firebase Auth data is processed in the US).
Keep it to sample/demo data until the sanctions questions are cleared. The app shows this note in the sign-in dialog,
the staff live bar and Company settings.

## Data model (`orgs/demo/...`)
See the header of `firestore.rules`. Staff-only: `clients/*` (margin), `quotes/*/private/costs` (buy rates/margins),
`jobInternal/*` (line rebate status), `settings/tariffsPrivate` (rebate %). Client-readable (own `clientId` only):
`clientPublic`, `lanes`, `agentPrefs`, `jobs`, `quotes`, `msds`; any member: `agents`, `settings/tariffs`, `settings/msdsRules`.
MSDS files are stored as base64 in Firestore (max 640 KB in live mode) because Cloud Storage needs the paid Blaze plan.

## Local (no project needed)
```
npm run rules:test                    # 50 rules unit tests on the emulator (needs Java 21)
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
4. Auth: enable Email/Password; add `aibit.github.io` to Authorized domains.
5. `firebase deploy --only firestore:rules,firestore:indexes --project <id>`
6. `FB_CONFIG='<config json>' npm run seed` → `/workspace/forwarddesk-test-accounts.txt` (chmod 600, never committed).
7. `FB_CONFIG='<config json>' npm run check:denials` — live proof that cross-client and buy-rate reads are refused.
8. Build and deploy to GitHub Pages as usual.
