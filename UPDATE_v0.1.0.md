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
  - Favorite Custom Decks (up to 10 stored decks).
  - Game History Logs (list of previous games containing player/character arrays, victory result, and ISO timestamp).
  - Lifetime Statistics (Total games moderated, total Werewolf wins, total Village wins).

#### 2. 🏠 Main Hub & Moderator Dashboard
- **Authenticated Default Screen:** Shows the main Moderator Dashboard hub with navigation to:
  - **Start New Game**
  - **Continue Game** (enabled only if an active game state exists in local cache/Firestore)
  - **Custom Decks** (Deck builder studio)
  - **Game History & Analytics** (Career stats and game logs)
  - **Profile & Settings** (Change password, edit name, language switch)

#### 3. 🃏 Custom Deck Management (Max 10 Decks)
- Moderators can build, edit, and store up to 10 favorite role decks.
- Each deck defines a preset role pool (e.g., "Standard 10-Player", "Chaotic Veteran Deck").

#### 4. 🎲 Gameplay Mechanics Updates
- **Deck Selection Phase:** Include an interactive deck selector before card distribution so moderators can load one of their saved presets or create a custom role pool on the fly.
- **Role Deal & Swap System:**
  - The "Deal" phase role picker MUST ONLY list cards/roles included in the setup deck.
  - Selecting a role for a player that is already assigned to another player automatically **swaps** roles between the two players.
- **Voting Logic (Accusations):**
  - The accused player is automatically prohibited from voting for themselves (their vote automatically counts as a "NO / Abstain" vote in the tally engine).
- **Chronicle (Game Log Timeline):**
  - Events must explicitly include both **Player Name** and **Role Name** (e.g., *"Day 1: Alex (Werewolf) was executed by vote"*).
  - Chronological ordering: Oldest events first (Day 1 $\rightarrow$ Night 1 $\rightarrow$ Day 2...), tracking the true time flow of the game.

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
│   └── GameContext.tsx  # Game state machine, swap logic, chronicle logging
├── utils/
│   └── gameCalculations.ts # Role balancing & dynamic chronicle formatting
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
│   │   └── ChronicleView.tsx    # Chronological history timeline
│   └── shared/
│       └── RoleCard.tsx         # Dual-language card with character avatars
├── App.tsx
└── main.tsx
```

Please write the updated code implementation for the primary context models, dynamic role cards with avatars, and key dashboard screens.