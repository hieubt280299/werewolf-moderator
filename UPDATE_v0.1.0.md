Act as a Principal Full-Stack Engineer specializing in React, TypeScript, and Firebase. You are updating and expanding the **Werewolf Gamemaster** mobile-first web application to version 0.1.0. 

Your goal is to implement new Auth & Dashboard structures, custom Deck management, updated gameplay flow, localized visual styling tweaks, and performance optimizations for mobile devices.

---

### 🛠️ Tech Stack & Constraints

- **Frontend:** React 18 + TypeScript (Vite)
- **Styling:** Tailwind CSS + lightweight animations (replace heavy framer-motion layers with hardware-accelerated CSS keyframes or lightweight GPU-driven animation libraries like `@formkit/auto-animate`).
- **State Management:** React Context API + Custom Hooks with local persistence / optional Firebase sync.
- **Audio:** No BGM + optional SFX cues.
- **Backend/Database/Auth:** Google Firebase (v10+ Modular SDK using Firestore and Auth).
- **Localization:** React i18n Context supporting **Vietnamese (VI)** as DEFAULT language, with **English (EN)** hot-swapping in settings.
- **Hosting/Deployment:** Vercel (SPA fallback via `vercel.json`).
- **Strict Rule:** Direct client-side SDK integration only. Do NOT generate Express/Node server files.

---

### 🎨 Visual & UI Design System (v0.1.0 Updates)

🎨 **The "Deluxe Grimoire" Color Scheme**
- Primary App Background: Solid Pitch Black (`#050505`).
- Card Containers & Panels: Dark Charcoal Gradient (`#12141C` transitioning to `#1A1D26`).
- Village Faction: Cosmic Cyan/Ocean Blue (`#00A3E0` / `#0082C8`).
- Wolf Faction: Crimson Red (`#C8102E` / `#D22630`).
- Text Color: Crisp Bone White (`#F5F5F7`).

🎛️ **Role Card UI & Layout Adjustments**
- **Dual-Language Card Format:**
  - **Right-side Character Name:** ALWAYS displayed in English (e.g., "WEREWOLF", "SEER", "HUNTER").
  - **Bottom Section:** Displays the Role Name **horizontally** in the active localized language (e.g., "Ma Sói", "Tiên Tri") for both full-size and small badge versions.
- **Avatar Illustrations:**
  - Replace plain/generic icon placeholders with styled character avatar SVG illustrations or high-resolution web-optimized graphic components inspired by classic dark-fantasy tabletop card art.
  - Avatar style must apply consistently across both full-size cards and small list variants.

---

### 🚀 Key Features & Architecture Requirements

#### 1. 🔐 Simple Auth & User Profile State
- **Unauthenticated Default Screen:** Renders simple Username + Password Login / Sign-up view (using Firebase Auth / Firestore shadow user records).
- **User Record Data Model:**
  - Moderator display name (editable).
  - Custom Role Pools (up to 10 stored pools).
  - Game History Logs (list of previous games containing player/character arrays, victory result, and ISO timestamp).
  - Lifetime Statistics (Total games moderated, total Werewolf wins, total Village wins).

#### 2. 🏠 Main Hub & Moderator Dashboard
- **Authenticated Default Screen:** Shows the main Moderator Dashboard hub with navigation to:
  - **Start New Game**
  - **Continue Game** (enabled only if an active game state exists in local cache/Firestore)
  - **Custom Role Pool** (saved sets of roles to play with)
  - **Game History & Analytics** (Career stats and game logs)
  - **Profile & Settings** (Change password, edit name, language switch). Opens as a **modal** over the current screen, from the header chip or the hub, so an in-progress setup or game keeps its place.
    - The Change password form is hidden by default; a **Change password** button in the bottom action group (above Sign out) reveals it, with Cancel to collapse it again.
- **Setup wizard progress** (current step and the deal board) is saved with the game, so leaving the screen or reloading never resets it to the Players step.
- **Back Navigation:** The header back arrow (and the browser / Android back gesture) returns to the *previous* screen, not always the hub — e.g. opening Profile mid-game and pressing back returns to the game.

#### 3. 🃏 Custom Role Pools (Max 10 Pools)
- Vietnamese terms: *Role* = **chức năng**, *Role pool* = **danh sách chức năng**.
- Moderators can build, edit and store up to 10 **role pools**: named sets of roles to play with, with no counts (e.g. "Beginner night", "Chaotic veterans"). The screen is called **Custom role pool**. It has no balance meter and no ± counters, just an include checkbox per role and **Select all / Deselect all**.
- **Card Preview:** tapping a card opens it full-size with its complete description (team, balance weight, difficulty, night behaviour). Selection is changed with the checkbox (pools) or the ± steppers (Deck step).
- **Role grids are grouped** into Village, Wolves and Other, sorted by difficulty and then by balance weight.

#### 4. 🎲 Gameplay Mechanics Updates
- **Setup flow: Players → Role Pool → Deck → Deal.**
  - **Villager and Werewolf** are always in a pool and can't be deselected. The **Village** and **Wolves** sections each have their own Select all / Deselect all.
  - **Role Pool step:** tick the roles allowed in this game, or tap one of **My pools** to load it (tap again to deselect). **Select all / Deselect all** toggles every role. **Save pool** asks for a name and whether to save as a new pool or replace an existing one. There is no balance meter or ± counter here.
  - **Deck step:** set counts for the pooled roles (Villagers and Werewolves are always available as fillers), or **Auto-balance** from the pool. The old "in pool" checkboxes are gone.
  - **Auto-balance** keeps Villagers strictly below 50% of the players (e.g. at most 4 of 10). Moderators may still add more by hand.
  - Disabled ± buttons are visibly dimmed and inert, distinct from the active state.
- **Role Deal (drag & drop):**
  - Player seats are fixed. The moderator drags each role card from the tray of undealt cards onto the seat of the player who received it. Only cards from the setup deck appear in the tray.
  - Dropping a card on a filled seat swaps the cards; dragging a seated card back to the tray unassigns it.
  - On touch screens, press and hold to drag; tapping a card and then a seat also works.
  - **Reshuffle** deals every card at random, and **Clear** returns them all to the tray. The game can start once every seat has a card.
- **Dawn Announcement:**
  - Each elimination reads only *"Player 2 was eliminated"* — never who or what killed them (the village doesn't learn the cause; the cause is kept in the moderator Timeline).
  - The row and its tag are coloured by the eliminated player's **side** (village blue, wolf red, vampire purple, cult green), with the tag showing their role.
- **Voting Logic (Accusations):**
  - The accused player is automatically prohibited from voting for themselves (their vote automatically counts as a "NO / Abstain" vote in the tally engine).
  - In the voter list the accused appears as a dashed chip showing **only their name**. Hovering (desktop) or tapping (mobile) the chip shows a tooltip explaining the abstain rule.
- **Timeline (EN) / Diễn biến (VI) — the game log:**
  - Events must explicitly include both **Player Name** and **Role Name** (e.g., *"Day 1: Alex (Werewolf) was executed by vote"*).
  - Chronological ordering: Oldest events first (Day 1 $\rightarrow$ Night 1 $\rightarrow$ Day 2...), tracking the true time flow of the game.

---

#### 5. 🐺 Expansion Roles, Teams & Difficulty

- **25 new roles** from the Ultimate Werewolf Deluxe set, with printed balance weights and rules, and portraits drawn after the original card art and palette:
  - **Village:** Apprentice Seer, Aura Seer, P.I., Priest, Mason, Mayor, Tough Guy, Village Idiot, Pacifist, Ghost, Old Hag, Troublemaker, Leprechaun, Drunk, Cupid, Doppelgänger, Virginia Woolf.
  - **Wolves:** Wolf Man, Big Bad Wolf, Dire Wolf, Fang Face, Fruit Brute, Wolverine, Minion.
  - **Solo:** Tanner (brown card).
- **Teams:** the two main teams are **Village** and **Wolves**. Cupid is on the Village team. **The Couple** forms only when Cupid links two players from *different* teams. Those lovers leave their original teams and win only as the last team standing, and while they live no other team can win. Lovers from the same team simply play on with that team, so no Couple team forms. Lone Wolf, Tanner, Vampires and Cult are rare extras.
- **Gameplay follows each card:** linked deaths (lovers, Dire Wolf companion, Virginia Woolf), role changes (Apprentice Seer → Seer, Doppelgänger copies its target, Drunk sobers up on night 3), delayed death (Tough Guy), first-night-only and once-per-game powers, adjacency (Big Bad Wolf, Leprechaun, P.I., Wolverine's metallic sound), forced votes (Village Idiot YES, Pacifist NO, Mayor ×2), Old Hag exile, two eliminations after the Troublemaker, Ghost eliminated on night 1, and a Tanner win when the Tanner is eliminated.
- **Difficulty Level (1–3)** for every role, shown in the card preview's facts. Auto-balance only uses roles up to the table's level: Beginner 1, Standard ≤ 2, Veteran ≤ 3. Rare third-party teams are difficulty 3.

---

### ⚡ Performance & Mobile Optimization Checklist

- **Animation Overhaul:** Eliminate lag/stutter on low-end mobile devices caused by heavy JavaScript layout recalculations or layout thrashing in Framer Motion.
- **GPU-Accelerated CSS Transitions:** Use pure CSS `transform: translate3d(...)`, `opacity`, and `will-change` properties for UI phase shifts and card flipping.
- **Asset Efficiency:** Ensure card avatars use optimized inline SVGs, vector assets, or lightweight CSS masking rather than unoptimized, heavy bitmapped assets.

---

### 🏗️ File Structure & Deliverables

```text
src/
├── @types/
│   └── game.ts          # Updated type definitions (User, Deck, Log, Player, Role)
├── context/
│   ├── AuthContext.tsx  # Simple Username/Password auth & profile sync
│   └── GameContext.tsx  # Game state machine, swap logic, timeline logging
├── utils/
│   └── gameCalculations.ts # Role balancing & dynamic timeline formatting
├── components/
│   ├── auth/
│   │   └── AuthScreen.tsx       # Combined login/signup view
│   ├── dashboard/
│   │   ├── DashboardHome.tsx    # Primary navigation hub
│   │   ├── DeckBuilder.tsx      # Up to 10 saved custom decks
│   │   └── HistoryStats.tsx     # Lifetime statistics & match logs
│   ├── game/
│   │   ├── DeckSelection.tsx    # Deck picker during game setup
│   │   ├── RoleDealPicker.tsx   # Swap-enabled role dealer
│   │   ├── VotingPanel.tsx      # Accusation panel with self-vote restriction
│   │   └── TimelineView.tsx     # Chronological game timeline (Timeline / Diễn biến)
│   └── shared/
│       └── RoleCard.tsx         # Dual-language card with character avatars
├── App.tsx
└── main.tsx
```

Please write the updated code implementation for the primary context models, dynamic role cards with avatars, and key dashboard screens.