Act as a Principal Full-Stack Engineer specializing in React, TypeScript, and Firebase. You are implementing **v1.0.0** of **"Werewolf Gamemaster"**, a mobile-first web application to assist game moderators running Werewolf board games.

---

### 🛠️ Core Tech Stack & Constraints

- **Frontend:** React 18 + TypeScript (Vite)
- **Styling:** Tailwind CSS + eased CSS keyframe animations (`transform` / `opacity` only, no Framer Motion — replaced in v0.1.0 and kept since v0.1.1; optimized for low-end mobile devices, 60fps performance)
- **Backend / Auth / DB:** Firebase v10+ Modular SDK (Auth & Firestore)
- **Localization:** React i18n Context (**Vietnamese (VI)** as default language; **English (EN)** switchable in Settings)
- **Rule Engine:** Pure client-side state machine with snapshot isolation for active games.

---

### 🔑 1. Authentication & Security Updates

#### A. Registration & Email Recovery

- **Sign-Up Requirements:** Include a mandatory **Recovery Email** field during user registration.
- **Forgot Password Workflow:**
    1. Add a **"Forgot Password?"** action on the Login screen.
    2. Display an input for **Username** with a **"Send Verification Code"** button.
    3. Clicking "Send Verification Code" triggers a 6-digit OTP code sent to the recovery email and starts a **120-second cooldown timer**.
    4. While the cooldown is active, replace the username input with a **6-Digit Verification Code** input field, and rename the button to **"Re-send Code"** (disabled until the 120s timer expires).
    5. Upon entering a valid verification code, transition to a **New Password** form with **Confirm New Password** validation.
    6. Successful password updates show a success toast/dialog and prompt redirection back to Login.

#### B. Profile & Security Settings

- Add a **"Change Verification Email"** section adjacent to "Change Password" in Profile Settings.
- Required inputs: **New Recovery Email** + **Current Password**.

---

### 🎲 2. Gameplay & Role Logic Updates

#### A. New Role: Hooker (Mỹ Nhân)

- **Faction:** Village | **Balance Weight:** +7 | **Difficulty:** Intermediate
- **Night Action:** Can target one player per night to seduce.
    - Seducing a player **cancels their nighttime ability** for that night.
    - **Single-Use Restriction:** Hooker can target each player only **once per game**.
- **Role Interaction Rules:**
    - **Werewolf:** If a Werewolf is seduced, the wolves' kill target survives that night (_Exception:_ Does NOT affect **Fruit Brute**, who is immune).
    - **Seer:** If seduced, the Seer receives inverted/opposite inspection results (e.g., Villager displays as Werewolf). The same applies to the other inspectors: Aura Seer, P.I. and Sorceress.
    - **Witch:** If seduced, any potion used that night is consumed/lost with no effect.
- **Scope:** The Hooker only cancels every-night abilities, never first-night setup abilities (Cupid, Doppelgänger, Virginia Woolf, Masons, the Dire Wolf's companion, the Minion's meeting).

#### B. Chronological Night Action Order

Execute night calls strictly in the following sequence:

1. **Night 1 Only:** Setup & initialization roles.
2. **Transformations & Delayed Roles:** Cursed (when bitten) / Doppelgänger (when her target died) / Drunk (Night 3 awakening).
3. **Protective & Distraction Roles:** The Hooker / Bodyguard.
4. **Threat Factions:** Vampires $\rightarrow$ Werewolves (all wolf types) $\rightarrow$ Minion / Sorceress.
5. **Remaining Active Roles:** All other night action roles.

#### C. Protective Skill Mechanics

- **Scope:** Protective skills (e.g., Bodyguard) defend **ONLY against Werewolf attacks**.
- **Witch Poison Interaction:** If the Witch uses a Poison Potion on a player protected by the Bodyguard, the target **still dies** (poison bypasses physical protection).
- **Lovers Interaction:** If one Lover is protected but the other dies from any attack, **both Lovers die** (broken heart bypasses all protective shields and potions).

---

### ⚙️ 3. House Rules: Recommended Rebalances

Add a **"Recommended Rebalances"** section under Profile & Settings with a **Master Toggle** ("Enable All Rebalanced Roles") and individual toggles for:

1. **Hunter (Thợ Săn) Rebalance:**
    - Replaces the Hunter's revenge shot with a night action: Select one player to link with. If the Hunter dies that night, the linked player is also eliminated. (It is an ability change, not an addition: the rebalanced Hunter never gets the revenge shot.)
    - _Hooker Interaction:_ If the Hunter is seduced, their link target is NOT eliminated.
2. **Witch (Phù Thủy) Rebalance:**
    - Once the Healing Potion has been consumed, the Witch no longer sees who the Werewolves target on subsequent nights.
3. **Big Bad Wolf (Sói Đầu Đàn) Rebalance:**
    - Takes a second individual turn immediately after the Werewolf turn.
    - Selects a second victim, who **must be seated adjacent** to the primary Werewolf target.
    - _Hooker Interaction:_ If Big Bad Wolf is seduced, both targets survive. If another Werewolf is seduced, target #1 survives, but target #2 still dies from BBW's individual strike.
4. **Tanner (Chán Đời) Rework:**
    - Moves to **Village Faction** (wins with Villagers).
    - **Passive Ability:** If interacted with by ANY role at night (including Hooker or Werewolves, and roles the Hooker seduced that night), Tanner and ALL interactors die that night. If Werewolves attack, the strongest Werewolf (lowest negative balance weight) dies alongside Tanner.

> **Card Text Rule:** While a rebalance is on, that role's card and card preview show its rebalanced description. The settings toggles describe only the main ability change (not the Hooker interactions).

> **Snapshot Isolation Rule:** Active games freeze rule configurations at card-dealing time. Changing toggles in Settings only affects newly generated games.

---

### 🛠️ 4. Quality of Life (QoL) & UI/UX Enhancements

- **Deck Phase Reset:** Returning to the Pool phase and modifying roles auto-resets the Deck phase selection state to eliminate stale role cards.
- **Action Restriction Warnings:** Roles restricted from targeting the same player on consecutive nights (e.g., Bodyguard) must explicitly state this constraint in their UI role description.
- **Localization & Translations:**
    - Default language: **Vietnamese (VI)**.
    - Corrected translation for **Sói Đau Khổ**: _"Mỗi đêm, thức dậy cùng bầy Sói. Đêm đầu tiên, chọn một người để yêu thầm. Nếu người đó bị loại, bạn cũng bị loại."_
    - Corrected character name for **Doppelganger**: _"Nhân Bản"_.
- **Role Card Styling:**
    - Role titles on the right vertical edge must remain in **English**.
    - Bottom section displays localized role names **horizontally**.
    - Custom illustrative avatars for all cards across both small grid tiles and full-sized cards.
- **Chronicle Improvements:** Log entries must display both player name and assigned role (e.g., _"Player 1 (Werewolf) was killed"_), structured in strict chronological time order (Night 1 $\rightarrow$ Day 1 $\rightarrow$ Night 2 ...). The game begins with Night 1, and the day after Night N is Day N.

---

### 🚀 Deliverables Checklist

Please deliver complete, production-grade code for:

1. `src/@types/game.ts` & `src/@types/auth.ts` (Updated interfaces for Hooker, Rebalances, & Recovery Auth).
2. `src/context/AuthContext.tsx` (OTP Verification & Recovery Email flow).
3. `src/hooks/useNightSequence.ts` (Sequential night call engine with Hooker & Rebalance logic).
4. `src/components/settings/RebalancesSection.tsx` (Master/Child toggle controls).
