# Werewolf Gamemaster

Mobile-first moderator companion for **Ultimate Werewolf** (Deluxe base and expansion roles), styled after the physical cards ("Deluxe Grimoire" theme). Vietnamese by default, English in settings.

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # rules engine, balancer, swap/vote/timeline tests
npm run build      # typecheck + production build (deploy dist/ to Vercel)
```

## Features (v0.1.0)

- **Moderator accounts** — username + password; profile with display name, up to 10 saved role pools, game history and lifetime stats.
- **Hub** — start / continue a game, custom role pools, history & analytics, profile & settings.
- **Game setup** — Players → Role Pool (load or build a pool, save it) → Deck (counts or auto-balance from the pool) → Deal (drag and drop cards onto seats).
- **Play** — guided night script, dawn report (who died, never who killed), accusations (the accused can't vote on their own nomination), Hunter / Wolf Cub / Diseased / Cursed / Prince / Vampire / Cult rules, win checks.
- **Timeline / Diễn biến** — oldest-first game log grouped by Night/Day, every event naming the player and their role.
- **41 roles** (16 base and 25 expansion) with portraits. Teams: Village, Wolves, The Couple, plus rare solo/third-party teams. Every role has a difficulty level (1–3), and auto-balance respects the table's experience.
- **Card preview** — tap any card in the deck builder or deck selection to read it full-size.

See [CHANGELOG.md](CHANGELOG.md) for release history.

## Storage modes

| Mode | When | Where data lives |
| --- | --- | --- |
| **Local** | No `VITE_FIREBASE_*` env vars | This browser only (accounts, role pools, history, active game). Good for trying the app. |
| **Firebase** | Env vars present | Firebase Auth + Firestore, so it syncs across devices. The active game is mirrored too, so you can continue on another device. |

## Firebase setup

1. **Create a project** at <https://console.firebase.google.com> → *Add project*. Google Analytics is optional.
2. **Register a web app**: *Project settings → General → Your apps → Web (`</>`)*. Copy the `firebaseConfig` values.
3. **Enable sign-in**: *Build → Authentication → Get started → Sign-in method → Email/Password → Enable*. Leave "Email link" off.
   - The app maps each username to a synthetic address `username@werewolf-gm.example.com`, which never receives mail. That's why Email/Password is the provider to enable. Usernames are unique because Firebase rejects duplicate emails.
4. **Create Firestore**: *Build → Firestore Database → Create database* → choose a region close to your players → start in **production mode**.
5. **Publish the security rules**: open the *Rules* tab, paste the contents of [`firestore.rules`](firestore.rules), and click *Publish*. These rules keep every user's data private to them, cap saved role pools at 10, and make usernames immutable.
6. **Configure the app**: copy `.env.example` to `.env` and fill in the values from step 2:
   ```env
   VITE_FIREBASE_API_KEY=...
   VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
   VITE_FIREBASE_PROJECT_ID=your-project
   VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
   VITE_FIREBASE_MESSAGING_SENDER_ID=...
   VITE_FIREBASE_APP_ID=...
   ```
   Restart `npm run dev`. The sign-in screen should now say your data syncs through Firebase.
7. **Deploy on Vercel**: add the same six variables under *Project → Settings → Environment Variables*, then redeploy. Under *Authentication → Settings → Authorized domains*, add your Vercel domain (e.g. `your-app.vercel.app`).

> The `VITE_FIREBASE_*` values are public client identifiers. They end up in the JS bundle by design, and the security rules are what protect the data. Keep `.env` out of git anyway (it's already ignored).

**Data layout**

```
users/{uid}                  username, displayName, pools[≤10], stats, createdAt
users/{uid}/games/{gameId}   finished game: players, winner, winnerSeats, log, ISO timestamps
users/{uid}/session/active   in-progress game (JSON string) for cross-device resume
```

**Password resets**: synthetic emails can't receive reset links. A moderator who forgets their password can be reset by the project owner under *Authentication → Users*. Signed-in moderators can change their password in *Profile & settings*.

## Architecture

Pure rules in `src/utils/gameRules.ts` and `src/utils/gameCalculations.ts`; game state machine in `src/context/GameContext.tsx` (per-user, persisted, with undo); accounts in `src/context/AuthContext.tsx` on top of `src/services/profileStore.ts` (Firebase or local backend). Animations are CSS keyframes using `steps()` and only `transform` / `opacity`; `@formkit/auto-animate` handles list reorders. Character portraits are inline SVG (`src/components/shared/RoleAvatar.tsx`).
