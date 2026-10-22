Act as a Principal Full-Stack Engineer specializing in React, TypeScript, and Firebase. You are implementing version **v1.1.0** of **"Werewolf Gamemaster"**, a mobile-first web application designed to assist game moderators running Werewolf board games.

---

### 🎨 1. Interactive & Rotatable Seat Map UI

Implement a dynamic **Seat Map View** alongside the existing Player List to help moderators visually track physical table arrangements during gameplay.

#### A. Radial Node Layout

- **Visual Presentation:** Display players arranged in a circular perimeter (representing the actual physical gaming table).
- **Node Details:** Each player node must display:
    - Seat position number (1..N)
    - Player name
    - Assigned role name formatted in the faction's color theme
    - Character avatar thumbnail integrated inside or atop each node
- **Interactivity:** Tapping/clicking any seat node opens the standard Player/Role Detail Modal (same modal triggered from the player list).

#### B. Table Rotation Gesture Controls

- **Purpose:** Allow moderators moving around the room to align the digital seat map with their physical viewpoint at the table.
- **Rotation Mechanics:**
    - Support touch drag / mouse drag / wheel gestures to smoothly rotate the entire circle around its central pivot point.
    - Include quick preset buttons (e.g., "Rotate +90°", "Reset Orientation") to re-center the map instantly.
    - Maintain upright text orientations for names/labels even when the wheel rotates (counter-rotate text labels to maintain legibility).

---

### 📜 2. Game History & Advanced Analytics Tab

#### A. Lineup Replay ("Start New Game from Lineup")

- When inspecting a completed game log in the Game History view, add a **"Start New Game from Lineup"** action button.
- **Workflow & State Initialization:**
    1. Clones the existing player list (player names and seat assignments) and the selected role card pool/deck from the historic game.
    2. Clears all game runtime states (resets death logs, night actions, chronicle history).
    3. Bypasses Setup/Pool selection and lands directly on the **Deal Phase** with cards ready to be re-shuffled/re-dealt.
    4. Allows the moderator to navigate backward to the Pool or Deck phases if adjustments are needed before dealing.

#### B. Victory Analytics & Extended Statistics

- **Faction Win Percentages:** Upgrade the game victory breakdown to show explicit percentages alongside total counts for each team (e.g., _Village Wins: 65% (13/20)_).
- **New Analytical Records:**
    1. **Most Played Role:** Displays role name, card thumbnail, and total count played.
    2. **Role with Most Wins:** Displays role name and absolute total win count.
    3. **Role with Highest Win Rate:** Displays role name and win rate percentage (_Filter Rule:_ Requires a minimum of **3+ wins** to qualify).
    4. **Longest Game:** Displays match record for the game with the highest total number of nights survived.
    5. **Game with Most Players:** Displays match record for the game with the largest player count.
- **Tie-Handling Logic:** If multiple roles or games tie for a top record, display up to **3 tied entries** in a multi-card row or carousel.
- **Deep-Linking / Interactivity:**
    - Clicking any **Role Record** opens a detail modal for that role card.
    - Clicking any **Game Record** opens the historical breakdown modal for that match.

---

### 🌐 3. QoL & Localization Polish

- **Terminology Standardization:** Update Vietnamese localization mappings so that all occurrences of `"grimoire"` are translated as **`"Cuốn bí kíp"`**.

---

### 🚀 Deliverables Checklist

Please deliver complete, production-grade code for:

1. `src/components/dashboard/SeatMap.tsx` (Rotatable SVG/Canvas radial seat map component with gesture support).
2. `src/components/history/GameHistoryDetail.tsx` (Updated historical match breakdown with "Start New Game from Lineup" action).
3. `src/components/statistics/AdvancedStatsPanel.tsx` (Analytics breakdown engine with win-rate thresholds, multi-tie handling, and interactive modal triggers).
