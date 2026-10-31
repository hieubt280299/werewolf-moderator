Act as a Principal Full-Stack Engineer specializing in React, TypeScript, and Firebase. You are implementing version **v1.3.0** of **"Werewolf Gamemaster"**, focusing on gameplay win-condition math, interactive moderator tools, visual badge indicators, and dynamic role deck auto-balancing.

### 🎲 1. Gameplay Logic & Rule Updates

#### A. Role Tweaks
- **Hooker Balance Weight:** Update Hooker's card balance weight from +7 to **+3**.
- **Prince Nomination Immunity:**
  - When the Prince is nominated during the Day Phase, immediately reveal his role card.
  - Skip the public elimination vote for the Prince (since he is immune to execution once per game).

#### B. End-Game Evaluation Engine Adjustments
1. **Lone Wolf Win Condition:**
   - **Solo Survival:** Lone Wolf wins if he is the last surviving player.
   - **Inability to Reciprocate Kills:** If Lone Wolf and 1 Villager remain, and the surviving Villager lacks night kill abilities or team conversion abilities, Lone Wolf wins immediately.
2. **Mayor-Aware Voting Power Tie-Breaker (Village vs. Threat Faction):**
   - *Previous Logic:* Evaluated absolute headcounts between Village and opposing threat faction.
   - *Updated Logic:* Evaluate **Eliminating Votes** instead of headcounts:
     - The opposing team wins if the Village has **no remaining kill power** AND the Village's total possible eliminating voting power is **less than or equal to** the opposing team's voting power (e.g., handles Mayor double-vote edge cases correctly).
     - A **Draw** is declared if neither team has killing or conversion abilities, and both teams have the **exact same total possible eliminating votes**.
     - **Special Rule:** The **Pacifist** contributes **0 eliminating votes** (cannot vote for execution).

---

### 🎨 2. UI/UX & Visual System Refinement

#### A. Role Indicators & Custom Badges
- **Custom Role Indicator:** Display a distinct visual tag/badge (e.g., "Custom Role") on the Hooker card.
- **Rebalanced Role Indicator:** When a role is modified by active House Rules rebalances (e.g., Rebalanced Hunter, Rebalanced Tanner), display a "Rebalanced" badge on its role card.

#### B. Silent Moderator Notification Screen
- Add a dedicated **Silent Notification Screen** designed to be shown directly to specific players in silence (functioning similarly to the "Show the Lovers" screen).
- It allows the moderator to show a clear visual alert on-screen to a player without revealing any secret information to eavesdroppers or bystanders (e.g., silently notifying Werewolves: *"Wolf Cub died: Werewolves get 2 kills tonight"*).

#### C. Typography Audit (Capitalization Cleanup)
- Perform a thorough UI audit across all screens and components.
- Reduce excessive `uppercase` CSS styling. Limit ALL CAPS strictly to primary role titles or high-level status tags to improve legibility and readability.

---

### 🛠️ 3. Quality of Life (QoL) & Deck Engine Enhancements

#### A. Player Phase Reordering & Name Validation
- **Drag-and-Swap / Seat Reordering:** In the Players phase, enable direct swapping of player positions to easily handle seat changes or mid-table additions.
- **Duplicate Name Safeguard:** Upon clicking "Next" at the end of the Players phase, check for identical player names. If duplicates exist, prompt the moderator with a confirmation dialog: *"Duplicate names detected ([Name]). Confirm these are distinct players before proceeding."*

#### B. Stealth Night Call Option ("Full Pool Calls")
- In the Deck phase screen, add a toggle/checkbox: **"Call all roles in selected pool during the night"**.
- **Behavior:** When enabled, the night engine prompts the moderator to call every role present in the selected pool (even if unassigned to any active player) to mask the actual dealt roles from eavesdropping players.
- **Persistence:** Save this preference in local storage / user settings across sessions.

#### C. Smart Deck Auto-Balancer Upgrades
1. **Toleranced Target Weight:** Allow the auto-balancing algorithm to return a deck balance sum within a $\pm 1$ **range** of the target score (e.g., a target score of `0` accepts total deck weights from `-1` to `+1`).
2. **Lineup Variation Constraint:** Auto-balancing must avoid outputting the exact same role configuration as the previous match. Require a **minimum 10% role variance** (at least 1 different role for a 10-player game) compared to the previous match's deck while keeping the total weight score within tolerance.

---

### 🚀 Deliverables Checklist

Please deliver complete, production-grade code for:
1. `src/utils/gameEvaluator.ts` (Updated victory check functions incorporating Mayor double votes, Pacifist zero vote weight, and Lone Wolf endgames).
2. `src/utils/deckBalancer.ts` (Auto-balancer with $\pm 1$ tolerance and 10% role variance from prior matches).
3. `src/components/setup/PlayerSetupPanel.tsx` (Seat swap controls and duplicate name modal confirmation).
4. `src/components/night/SilentNotificationModal.tsx` (Discreet player-facing alert screen modeled after the Lovers reveal view).
5. `src/components/shared/RoleCard.tsx` (Custom & Rebalanced badge indicators, reduced uppercase styling).