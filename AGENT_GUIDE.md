Act as a Principal Full-Stack Engineer specializing in React, TypeScript, and Firebase. You are building a production-ready, mobile-first web application named **"Werewolf Gamemaster"** to assist moderators (gamemasters) in running a Werewolf (Ultimate Werewolf) board game seamlessly.

### 🛠️ Tech Stack & Constraints

- **Frontend:** React 18 + TypeScript (Vite)
- **Styling:** Tailwind CSS + smooth eased CSS animations (transform/opacity only, compositor-friendly; no `steps()` timing) + custom UI styling based on the Visual & UI Design System below.
- **State Management:** React Context API + Custom Hooks with local persistence / optional Firebase sync.
- **Audio:** No BGM + optional SFX cues.
- **Backend/Database/Auth:** Google Firebase (v10+ Modular SDK using Firestore and Auth).
- **Localization:** Simple light React i18n Context supporting **English (EN)** and **Vietnamese (VI)** with hot-swapping in settings.
- **Hosting/Deployment:** Vercel (SPA fallback via `vercel.json`).
- **Strict Rule:** Direct client-side SDK integration only. Do NOT generate Express/Node server files.

---

### 🎨 Visual & UI Design System

🎨 **The "Deluxe Grimoire" Color Scheme**
The application uses an absolute black canvas with glowing accents drawn directly from faction card text borders and backlighting:

- **Primary App Background:** Solid Pitch Black (`#050505`) to mirror the bottom gradient of physical cards.
- **Card Containers & Panels:** Dark Charcoal Gradient (`#12141C` transitioning to `#1A1D26`) to mimic textured, vignetted backgrounds.
- **The Village Faction (Seer, Bodyguard, Hunter):** Cosmic Cyan/Ocean Blue (`#00A3E0` or `#0082C8`). Use for active village roles, protective statuses, and innocent tags.
- **The Wolf Faction (Werewolf, Wolf Cub, Lone Wolf):** Crimson Red (`#C8102E` or `#D22630`). Use for active wolf selection screens, elimination prompts, and primary threat warnings.
- **Global Text Color:** Crisp Bone White (`#F5F5F7`) for ultimate readability in low-lit real-world rooms.

🔤 **Vietnamese-Optimized Typography**

- **Header / Role Title Font:** Dosis or Oswald (`text-transform: uppercase`, `font-weight: 700`, `letter-spacing: 0.1em`).
- **Body / Prompt Font:** Be Vietnam Pro or Inter (condensed, highly readable sans-serif for nighttime script prompts).

🎨 **Localization Color & UI Strategy**

- **Dynamic Card Heights:** Vietnamese text strings require variable vertical space; use `min-h-[value]` instead of strict fixed heights on player blocks.
- **Text Shadow Fixes:** Apply crisp text shadows (`text-shadow: 0 1px 2px rgba(0,0,0,0.8)`) so thin accent marks remain legible against dark charcoal backgrounds.

🎛️ **UI Components & Visual Style Guide**

- **Role & Player Cards:** Use top/side-edge accented colored blocks matching faction colors. Status indicators should use high-saturation inner shadows (`box-shadow: inset 0 0 20px rgba(...)`) to look illuminated from within.
- **Phase-Driven Ambient UI:** Night actions feature low-contrast UI using Cyan accents (preventing harsh face-lighting in dark rooms). Day transitions feature striking deep orange-red border gradients.

---

### 🏗️ Project Architecture & File Structure

Organize the codebase into the following clean, modular structure:

```text
src/
├── @types/
│   └── game.ts          # Core TypeScript interfaces: Player, Role, Phase, GameState, Faction
├── context/
│   └── GameContext.tsx  # React Context for game state machine, phase transitions, and state persistence
├── hooks/
│   └── useGameEngine.ts # Custom hook encapsulating win conditions, role balancing, and phase logic
├── utils/
│   └── gameCalculations.ts # Balance weight sums, role distribution logic, and randomizer helpers
├── services/
│   └── firebase.ts      # Firebase initialization, Auth, and Firestore configuration
├── components/
│   ├── dashboard/
│   │   ├── ModeratorDashboard.tsx # Main hub for night/day management and player status grid
│   │   └── PhaseTimeline.tsx      # Visual progress bar of the current game phase
│   ├── night/
│   │   └── NightActionModal.tsx   # Step-by-step night wake-up assistant for the moderator
│   ├── day/
│   │   └── VotingPanel.tsx        # Nomination, defense, and public execution tracker
│   └── shared/
│       └── RoleCard.tsx           # Deluxe Grimoire styled card component with faction glows
├── App.tsx
└── main.tsx
```

---

### 📐 Domain Logic & Game Mechanics

1. **Game Setup & Core Asymmetry**
    - **Hidden Roles & Factions:** Players are divided into the Village Faction (uninformed majority, informational/protective) and the Werewolf Faction (informed minority, systematic eliminators).
2. **The Core State Machine (Phase Cycle)**
    - **Night Phase:** Sequential wake-up prompts managed by the moderator (Werewolves select target $\rightarrow$ Seer inspects alignment $\rightarrow$ Bodyguard protects $\rightarrow$ Witch actions).
    - **Day Phase:** Public debate, nomination, majority-vote execution, and role reveals.
3. **Conditional Triggers & Modifiers**
    - **Death Rattles:** Hunter revenge shots upon elimination.
    - **Role Transformations:** Cursed turns into a Werewolf if targeted by wolves at night.
    - **Misdirection:** Lycan appears as a Werewolf to the Seer.
4. **Global Game-Over Evaluation**
    - **Village Win:** All threat factions eliminated.
    - **Werewolf Win:** Surviving Werewolves $\ge$ Surviving Villagers.
5. **The Value Indicators (Balance Weight)**
    - Positive numbers (+X) favor villagers (e.g., Seer = +7); Negative numbers (-X) favor wolves (e.g., Werewolf = -6). The AI balancing engine must target a sum of 0 (or customized based on player experience level).

---

### 🚀 Getting Started Deliverables

Please write the complete, functional code for the core setup files:

1. `src/@types/game.ts` (All core interfaces and types)
2. `src/utils/gameCalculations.ts` (Balance weight calculations and role array generators)
3. `src/context/GameContext.tsx` (State machine context provider)
4. `src/components/dashboard/ModeratorDashboard.tsx` (Main layout incorporating night/day controls and player grid)
