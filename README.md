# Werewolf Gamemaster

Mobile-first moderator companion for **Ultimate Werewolf** (Deluxe roles), styled after the physical cards ("Deluxe Grimoire" theme).

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # rules engine + balancer tests
npm run build      # typecheck + production build (deploy dist/ to Vercel)
```

- **Offline by default** — the game lives in `localStorage`; Undo keeps the last 40 checkpoints.
- **Optional Firebase backup** — copy `.env.example` to `.env`, fill in the `VITE_FIREBASE_*` values, enable Anonymous Auth, then turn on *Cloud sync* in Settings. Firestore rule:
  `match /games/{uid} { allow read, write: if request.auth != null && request.auth.uid == uid; }`
- **EN / VI** hot-swap in Settings.

Rules live in pure functions (`src/utils/gameRules.ts`, `src/utils/gameCalculations.ts`); React state is in `src/context/GameContext.tsx`, exposed through `src/hooks/useGameEngine.ts`.
