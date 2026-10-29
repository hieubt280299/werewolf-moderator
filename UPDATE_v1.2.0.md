Act as a Principal Full-Stack Engineer specializing in React, TypeScript, and Firebase v10+. You are implementing version **v1.2.0** of **"Werewolf Gamemaster"**, a mobile-first web application designed to assist game moderators running Werewolf board games.

---

### 🔑 1. Authentication & Account Merging (Google OAuth + Email/Password Sync)

Upgrade the authentication workflow to support direct Google Sign-In with seamless account linking to preserve user data (decks, game history logs, career statistics, and custom settings).

#### A. Direct Google Authentication

- Add a **"Sign in with Google"** button on the Login/Sign-up screen.
- If no user account matches the Google account, automatically create a new profile instantly. Initialize `displayName` using the Google profile name, and seed empty initial statistics and deck collections.

#### B. Firebase Account Linking & Data Consolidation

- **Constraint / Goal:** Ensure users logging in with Google whose email matches an existing Username/Password account's recovery email retain access to the exact same unified profile data.
- **Handling Strategy (`fetchSignInMethodsForEmail` & Credential Linking):**
    1. When a user attempts Google Sign-In, query Firebase Auth to check if an account with that primary/recovery email already exists via another provider (`password` or `google`).
    2. **Account Linking Flow:** If an existing password-based account shares the email, handle the `auth/account-exists-with-different-credential` pattern by prompting the user for their password (or verifying their existing session) to merge the Google credential (`linkWithCredential`).
    3. Ensure Firestore user document lookup uses a single primary `uid` (or maps synced emails to a consolidated `userId`) so that decks, game history, and statistics remain unified across sign-in methods.

---

### 🐺 2. Rebalanced Big Bad Wolf (Sói Đầu Đàn) — Unhealable Strike Logic

Enhance the Rebalanced Big Bad Wolf mechanics by introducing a distinct, lethal "Unhealable Strike" mechanic that operates independently of the standard Wolfpack kill.

#### A. Core Strike & Debuff System

- **Wolfpack Attack:** Standard night attack subject to normal defensive cancels (Bodyguard protection, Witch's Healing Potion, Hooker seducing a normal Werewolf).
- **Big Bad Wolf (BBW) Attack:** A standalone, unhealable execution strike.
    - Cannot be healed or dispelled by **Witch (Healing Potion)** or **Bodyguard**.
    - **Priest (Mục Sư) Exemption:** The **Priest (Mục Sư)** holy protection shield neutralizes _ALL_ killing attempts that night, successfully saving a target even against BBW's strike.

#### B. Dual-Kill Debuff & Interaction Matrix

If a player accumulates multiple kill debuffs in a single night (e.g., both Wolfpack and BBW target the same player—whether directly or redirected via **Leprechaun**):

1. **Targeting Synergy:** The player receives 2 distinct kill debuffs: `[WolfpackKill, BBWKill]`.
2. **Partial Dispels:** If Bodyguard or Witch attempts to save the target, they dispel only `WolfpackKill`. The `BBWKill` remains active, and the target **still dies**.
3. **Hooker Seduction Matrix:**
    - **Hooker seduces BBW:** Since BBW is part of the wolfpack, seducing BBW cancels **BOTH** the Wolfpack attack and BBW's individual strike (the target survives both attacks).
    - **Hooker seduces a standard Werewolf:** The Wolfpack attack is canceled. However, if BBW's target is that player (which is possible via Leprechaun for example), the target **still dies** from BBW's unhealable strike.

---

### 🌐 3. Terminology & Localization Update

- **Priest Translation:** Ensure the Priest role is officially translated as **"Mục Sư"** in Vietnamese across all UI elements, card descriptions, and chronicle logs.

---

### 🚀 Deliverables Checklist

Please deliver complete, production-grade code for:

1. `src/services/authService.ts` (Firebase Google OAuth provider, account-linking credential resolver, and error handlers).
2. `src/hooks/useNightSequence.ts` (Updated resolution queue implementing dual-debuff tracking `[WolfpackKill, BBWKill]` and immunity evaluations for Priest [Mục Sư], Bodyguard, Witch, and Hooker).
3. `src/components/night/NightActionModal.tsx` (Moderator prompts clearly detailing BBW unhealable target resolution).
