# Changelog

All notable changes to Werewolf Gamemaster are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow [Semantic Versioning](https://semver.org/).

## [1.2.0] - Unreleased

Implements [`UPDATE_v1.2.0.md`](UPDATE_v1.2.0.md).

### Added
- **Continue with Google** on the sign-in screen (Firebase mode).
  - A first Google sign-in creates a profile at once. The display name comes from the Google account; stats and role pools start empty.
  - The Google window opens as a popup. It switches to a full-page redirect when the popup is blocked, or in the installed home-screen app.
  - `vercel.json` proxies Firebase's sign-in helper (`/__/auth`), so redirects keep working in browsers that block third-party storage. Setup steps are in the README.
- **One profile per email.** Signing in with Google using a username account's email opens that same account: same decks, history, stats and settings.
  - Google addresses (@gmail.com, Workspace) merge automatically.
  - Any other address asks once for the account's password, then links Google to it.
- **Sign-in methods** in Profile & settings:
  - Connect or disconnect Google.
  - Add username & password to an account made with Google.
  - Verify your email.
  - Disconnecting Google is refused while it is the only way to sign in. Connecting is refused if that Google account already has its own profile.
  - While a Google account with the same address as the recovery email is linked, **Change verification email** is hidden, and the Account section says to disconnect Google first. The Firebase store refuses the change as well. A linked Google account with a different address doesn't lock the email.
  - **Connect Google** is refused while a recovery-email change waits for confirmation. Opening that link later would move the account off the Google address. The same applies to linking Google after a password sign-in: the moderator is signed in, Google stays unlinked, and the app says why. A new **Cancel change** next to "Waiting for confirmation" clears a pending change that will never be confirmed.
- **Email verification.** New sign-ups get a verification email.
  - If Google replaced an unverified account's password, the app offers once to set a new one, so the username keeps working.
- **Kill debuffs** (rebalanced Big Bad Wolf). Each victim carries `WolfpackKill` and/or `BBWKill`:
  - The Bodyguard and the Witch's Healing Potion lift only `WolfpackKill`.
  - Only the Priest's (Mục Sư) blessing lifts `BBWKill`, and it lifts every debuff.
  - A victim with both, saved by the Bodyguard or Witch, still dies. The timeline notes that the Big Bad Wolf's strike couldn't be stopped.
- **Tonight's wolf attacks** panel at the Big Bad Wolf's and Leprechaun's calls (moderator only). It lists each victim's debuffs, what has lifted them so far, and the result at dawn: dies, survives, turns, or wounded.
  - The Witch's call warns the moderator when a victim she can heal was also struck by the Big Bad Wolf.

### Changed
- **The rebalanced Big Bad Wolf's strike is unhealable.** The Bodyguard no longer stops it; the Witch still can't. Only the Priest's blessing does.
- **The pack's kill and the Big Bad Wolf's strike can stack on one player**, through the Leprechaun moving the pack's kill onto the strike's target. The Big Bad Wolf still strikes only a neighbour of a pack target, never the target itself. On a Wolf Cub night, a neighbour of either target.
  - Seducing the Big Bad Wolf cancels both attacks. Seducing another Werewolf cancels only the pack's, so a stacked victim still dies.
  - For a Cursed or a Tough Guy, a stack is one wolf attack: the Cursed turns once, the Tough Guy is wounded once.
  - A Diseased killed by the strike (even when the Bodyguard or Witch lifted the pack's kill) makes the pack **and** the Big Bad Wolf skip the next night, as when he is seduced. The rules engine drops any wolf target set on a skipped night, and the Big Bad Wolf's call says his strike is off too.
- **The Leprechaun plays blind.** They are no longer shown the Werewolves' target. They point left, point right, or shake their head.
  - Everyone faces the middle of the table, so left means one seat clockwise and right one seat counter-clockwise. Dead players are skipped.
  - The move shifts every pack target alike: both victims on a Wolf Cub night or with the standard Big Bad Wolf.
  - It can land on a Werewolf or on the Leprechaun themselves.
  - The call shows **Left / No move / Right** buttons, and the moderator sees where each attack lands.
  - The reworked Tanner still takes the Leprechaun down when the move lands on them.
  - The timeline records the direction and who the attack landed on, or that there was nothing to move.
  - A night saved before this update restarts the Leprechaun's call with no move.
- **The Witch heals one player only**, even when two were attacked. Her call says so when there are two victims.
- **Night-1 setup can't be skipped.** Until the Cupid, Doppelgänger, Virginia Woolf and Dire Wolf calls have their picks, Next and Finish night stay off and later calls can't be jumped to. Every other call can still be passed.
- **The Witch still sees a seduced pack's victims.** An empty list would tell her the Hooker found a wolf. Healing one spends the potion for nothing. A seduced Witch already gets no effect from either potion, and both are spent; tests now cover this.
- **The Doppelgänger is never called aloud.** When her target dies, the next night's script tells the moderator to silently tap her shoulder and show her the new role, the same way a bitten Cursed is woken. A spoken call would tell the table her target had died.
- The Witch's call reminds the moderator to call her even after both potions are used.
- **The seat map shows the Lovers**, as the list does: a purple heart badge on each lover's portrait, and a dashed purple line across the table joining their seats. The line turns with the table and dims once both lovers are dead. This works on the board and in the night script's player choices. Screen readers hear "Lover" with the seat.
- **Virginia Woolf's and the Dire Wolf's links are shown**, in the list and on the seat map.
  - In the list, the board's tiles and the player sheet get a chip on both ends: "Takes {name} along" on the player whose death drags the other down, "Dies with {name}" on the one who dies along. The chip is in the linking role's colour.
  - On the seat map, a dotted arrow crosses the table towards whoever dies along, with a link badge on both portraits. Each kind of link has its own line, so a pair joined twice still shows both. The arrows dim once either end is dead.
  - Like the Lovers, the links appear once night 1 is resolved and stay after the deaths. A Doppelgänger who becomes Virginia Woolf or the Dire Wolf carries the link too.
- **Shorter role descriptions** in both languages. 38 descriptions ran past the card's three lines and were cut off; every description now fits in about 90 characters, with the same rules. Every Werewolf-team role says whether it wakes with the pack: the Sorceress and the Minion don't, Fang Face does only on night 1 and as the last wolf, and a turned Cursed does. A test keeps new descriptions under 100 characters, and another checks the wolf-team wake wording in both languages.
- Firestore rules: an account made with Google may set its username once.

## [1.1.1] - Unreleased

### Changed
- **Auto-balance picks a fuller mix of roles.** It first keeps the deck balanced for the table's experience. It then tries to include each group below, highest priority first, as far as the pool and the number of seats allow:
  1. At least one Villager and one Werewolf.
  2. A role that wakes every night, a role that wakes only on night 1, and a role with no night action.
  3. A Werewolf-team role with an ability, a role that can kill, a role that protects or saves, and a role that gathers information.
  - The plain Villager and Werewolf don't count toward groups 2 and 3.
  - Kill: Hunter, Witch, Wolf Cub, Big Bad Wolf, Vampire, and the reworked Tanner. Protect or save: Bodyguard, Priest, Witch, Hooker, Leprechaun. Information: Seer, Apprentice Seer, Aura Seer, P.I., Sorceress, Ghost.
  - An auto-balanced deck always has at least one Villager now.
- **Role order:** in the Role Pool and Deck steps (and the pool editor), each team's roles are sorted by difficulty (Beginner first), then by how strongly they favour that team (for the Village, highest weight first; for Wolves and the other teams, lowest first), then by English name (A to Z).

## [1.1.0] - Unreleased

Implements [`UPDATE_v1.1.0.md`](UPDATE_v1.1.0.md).

### Added
- **Seat map:** the moderator board's Players section switches between the list and a seat map. The map shows the players round the table in seat order (seat 1 at the top, then clockwise). Each seat shows its number, the player's name, their role in the team's colour and the role's portrait. Tapping a seat opens the same player sheet as the list.
  - Turn the table with a drag (touch or mouse) or the arrow keys, or with **Rotate −90°**, **Rotate +90°** and **Reset orientation**. Names and roles stay upright while it turns.
  - The night script's player choices (every call that picks players, and the Witch's poison) offer the same list / seat map switch. Only the players the call can pick are tappable; picked seats are ringed in the call's colour, and locked seats (the Bodyguard's last protégé, the Hooker's past visits) show a lock with the reason under the map.
  - One view and one orientation for the whole app: switching or turning the table in the night script changes the board too, and the other way round. Both are remembered on the device.
  - Large tables alternate seats between two rings so every seat stays readable.
- **Start new game from lineup:** a finished game's breakdown in History has a button that starts a new game with the same players in the same seats and the same cards and pool. Nothing else carries over: no deaths, night actions or timeline. The game opens on the Deal step with every card back in the tray. Back leads to the Deck and Role Pool steps. If the lineup breaks today's deck rules, such as a fourth team, it opens on the Deck step instead, where the problem is shown.
- **Records** in History, from the games in the history list:
  - most played role (Villagers and Werewolves are left out, since nearly every game has them)
  - role with the most wins
  - highest win rate (roles with 3 or more wins only)
  - Role records count games, not cards: two Werewolves in one game are one game played, and one win if they win.
  - longest game (most nights)
  - game with the most players
  - Up to three tied holders are shown side by side, and a note counts any more ties. Tapping a role opens its card; tapping a game opens its breakdown.

### Changed
- **Timeline names the voters, not the accusers:** an execution reads e.g. "D (Spellcaster) was executed by vote (voted by 5 people)", and hovering or tapping "5 people" lists who voted, with their roles. A Prince surviving the vote gets the same. A withdrawn or dropped accusation had no vote, so its line names no one.
  - The optional "Accused by" picker is gone from the accusation sheet, and so is the "Accused by N players" line on the vote.
  - Timelines logged before this version still show their "(accused by …)" lines.
- **Rematch** at the end of a game works like "Start new game from lineup": the same players in the same seats with the same cards and pool, straight onto the Deal board (or the Deck step if the deck breaks today's rules). **New Game** stays the clean start: the names and pool are kept, the deck is chosen again from the Players step.
- **Fresh deaths stand out:** at dawn, the players who died in the night are tagged "Died last night"; once the day is over, the day's deaths are tagged "Died today" (and the last phase's when the game ends). They keep their colours with a red glow and sit right after the living players, while earlier deaths stay grey at the bottom. On the seat map they are ringed in red. The tag goes once the next phase starts.
- **The day is over** also names anyone the vote's victim took down with them (a broken-hearted lover, a link, the Hunter's shot): "Also eliminated: …", without the reason.
- **Victory split** shows each team's percentage next to its count, e.g. "Village wins: 65% (13/20)".
- History roster: players are listed in seat order with their seat number, and role names are tinted in their team's colour.
- **Night script:** the Back / Next buttons sit in a footer outside the scrolling content, so a long step (e.g. with the Seer's result) no longer shows players underneath or through them.
- Finished games now record their Role Pool, which "Start new game from lineup" restores. Older games fall back to the roles that were dealt.
- **Vietnamese:** "grimoire" is now **Cuốn bí kíp** ("Cuốn bí kíp của quản trò", "Đang mở Cuốn bí kíp…").

## [1.0.1] - Unreleased

### Added
- **New game keeps the table:** starting a new game keeps the player names (as typed) and the table experience from the last game, so the moderator doesn't retype the whole table.
- **Easier dealing:** on the Deal board, the whole seat is the drag handle, so pressing anywhere on a filled seat picks up its card, not just on the card itself. Seats are tighter around a slightly larger card.
- **Coloured timeline:** role names in the timeline are tinted in their team's colour (Village blue, Wolf red, Vampire violet, Cult green, Tanner brown), and so is the winning team in the game-over line.
- **One line per accusation:** the timeline no longer writes a line per accuser. The accusation is logged once it ends, e.g. "D (Spellcaster) was executed by vote (accused by 4 people)". Hovering or tapping "4 people" lists the accusers and their roles. A Prince surviving the vote, a withdrawn accusation and one dropped when the day ends without an elimination get the same treatment.

### Changed
- **Win conditions**, checked among the living players:
  - Only one team left: it wins.
  - Three or more teams, or two teams without the Village: play goes on.
  - The Village against one other team:
    - The Village has no kill power left and is strictly outnumbered: the other team wins.
    - Neither team can kill or change anyone's team, and they are equal in number: a draw.
    - Anything else: play goes on.
  - Kill powers: the Werewolves (not a lone Fruit Brute), Vampires, the Hunter, the Witch's unused poison and the reworked Tanner. Team-changing powers: the Cult Leader, the Drunk before night 3, and a Doppelgänger with a target. Day votes don't count.
  - Parity alone no longer hands the Werewolves the game. They win once they outnumber a Village that can't kill.
  - The Tanner (standard rules) and a Cult Leader who has recruited everyone still win at once. A standard Tanner never holds the game open, and only the Cult Leader counts as the Cult: recruits keep their team.
  - The Lone Wolf counts with the Werewolves, but still only wins as the last player alive.
- **At most 3 teams:** Village, Werewolves and one of The Couple (Cupid), Vampires, Cult or Tanner (standard rules). The Lone Wolf counts with the Werewolves, and the reworked Tanner is a Villager.
  - The Deck step locks + on roles that would bring a fourth team and blocks dealing such a deck.
  - Auto-balance never builds one, and the Drunk's real role can't bring one in.
- **Big Bad Wolf (house rule):** the Witch is shown, and can heal, only the pack's victim, never the Big Bad Wolf's own strike. His strike may hit anyone next to the pack's victim except himself, even another wolf.
- **Dire Wolf:** choosing a companion is a setup ability, so the Dire Wolf now wakes alone among the night-1 setup roles (after the Masons), before the pack, instead of with the Threats.
- **Leprechaun:** both neighbours of the wolves' target are offered, wolves included, since the Leprechaun doesn't know who the wolves are.
- **Lovers:** on night 1, a new "The Lovers" call follows Cupid's. Its **Show the Lovers** button opens a full-screen view with only the two lovers' names and roles, for the moderator to show them. Cupid's script no longer wakes the lovers.
- **Cursed:** never has a night call of their own. The night after being bitten, the wolves' turn shows a note to silently wake them with the pack (like the Wolf Cub's double-kill note).
- **Drunk:**
  - The real role can only be a Village or Werewolf role (the Lone Wolf counts with the Werewolves). Vampires, Cult and the standard Tanner are excluded, as are the night-1 setup roles (Cupid, Doppelgänger, Virginia Woolf, Mason, Dire Wolf, Minion) and the Ghost.
  - The pick takes effect at once. The Drunk uses the new role later that same night, and the Seer and other inspectors see it. Changing or clearing the pick swaps it back.
- **Priest:** "That player cannot be eliminated by any killing ability that night." The blessing now also stops the Witch's poison and the Hunter's aim (house rule). The Bodyguard still only stops Werewolf attacks. A broken heart and the reworked Tanner still go through every protection.
- The Witch's note no longer starts with "House rule:".

## [1.0.0] - Unreleased

Implements [`UPDATE_v1.0.0.md`](UPDATE_v1.0.0.md). In review in [PR #3](https://github.com/hieubt280299/werewolf-moderator/pull/3).

### Added
- **Recovery email:** required at sign-up. Profile & settings has **Change verification email** next to Change password. It asks for the new address and the current password.
- **Forgot password?** on the sign-in screen: username → verify → new password (entered twice) → success, then back to sign in. Sending starts a 120-second cooldown before **Re-send** unlocks.
  - Device-local accounts get a 6-digit verification code, shown on screen because a device can't send email. The code is valid for 10 minutes and allows 5 attempts.
  - Firebase accounts get Firebase's password-reset link at the recovery email. The app has no server, so it can't set a password from a 6-digit code. If the console's action URL points at the app, the link opens the app's own New Password form.
- **New role: Hooker (Mỹ Nhân)**, Village, +7, intermediate, with a portrait. Each night she seduces a player, and that player's night power fails. She can seduce each player only once per game.
  - A seduced Werewolf ruins the pack's kill. The Fruit Brute is immune.
  - A seduced Seer is told the opposite. So are the Aura Seer, P.I. and Sorceress.
  - A seduced Witch's potions are spent with no effect.
  - The night script warns the moderator on every call the seduction cancels.
- **Recommended rebalances** in Profile & settings: a master toggle ("Enable all rebalanced roles") and one toggle per role. Each game freezes the rules when its cards are dealt, so changing them never affects a game in progress.
  - **Hunter:** no longer shoots a player upon dying. Instead, each night the Hunter aims at a player, and if the Hunter dies that night, that player dies too, unless the Hunter was seduced.
  - **Witch:** once the Healing Potion is used, she no longer sees who the Werewolves attacked.
  - **Big Bad Wolf:** takes its own turn after the pack and picks a second victim seated next to the first. Seducing the Big Bad Wolf saves both victims. Seducing another wolf saves only the first.
  - **Tanner:** joins the Village. Anyone who targets the Tanner at night dies with them, through any shield, even if the Hooker seduced them. For a wolf attack, the strongest Werewolf (lowest weight) dies.
  - While a rule is on, the role's card and card preview show the rebalanced description: the dealt game's rules in play, your current settings while setting up.
- Night calls to tell a bitten **Cursed** they are a Werewolf now, and a **Doppelgänger** which role she took. Each happens once, on the next night.

### Changed
- **Night order** is called strictly in five blocks, each labelled in the night script:
  1. Night-1 setup: Cupid, Doppelgänger, Virginia Woolf, Masons.
  2. Transformations: Cursed, Doppelgänger, Drunk (night 3).
  3. Protection and distraction: Hooker, Bodyguard, Priest.
  4. Threats: Vampires → Werewolves (then the Big Bad Wolf's own strike and the Dire Wolf's companion) → Minion / Sorceress.
  5. Everyone else.
- **Protection** (Bodyguard, Priest) stops only Werewolf attacks. The Witch's poison now kills a protected player. A broken heart still takes a protected or healed lover.

- **Deck reset:** changing the Role Pool empties the Deck step and the deal board, so no stale cards survive. Choosing the same roles again keeps the deck.
- **Restriction warnings:** the Bodyguard's description says they can't protect the same player two nights in a row. The night script repeats it, and repeats the Hooker's once-per-player rule. Locked players are shown greyed out with the reason.
- **Vietnamese:** Sói Đau Khổ reads "Mỗi đêm, thức dậy cùng bầy Sói. Đêm đầu tiên, chọn một người để yêu thầm. Nếu người đó bị loại, bạn cũng bị loại." The Doppelgänger is now **Nhân Bản**.
- The timeline logs the Hooker's, the Hunter's and the Big Bad Wolf's picks, and records the night's actions in call order.
- Firebase: each account's email is now its recovery email, and `usernames/{username}` maps usernames to it. Republish [`firestore.rules`](firestore.rules). Accounts made before v1.0.0 keep working; sign in once so the app can register the username.

## [0.1.1] - Unreleased

Performance update: smooth animations and lighter screens. In review in [PR #2](https://github.com/hieubt280299/werewolf-moderator/pull/2).

### Changed
- **Smooth animations:** every animation and transition now uses eased curves at the display's full frame rate, replacing the choppy stepped (frame-by-frame) timing. Sheets slide with an iOS-style curve, cards deal in with a gentle ease, pop-ins have a slight overshoot, and the balance meter glides.
- **Role portraits are cached images:** each portrait is drawn once as an image and reused everywhere, instead of a live vector drawing per card. The Role Pool screen has about 75% fewer page elements (≈3,070 → ≈815), and the game board about 70% fewer.
- **Press feedback** animates only the button's scale (GPU-composited), with no permanent layer per button. Buttons and cards no longer each sit on their own graphics layer while idle.
- **List animations** (player board, nominations, saved pools) use a small built-in FLIP animation instead of `@formkit/auto-animate`, which kept per-item observers and polling timers running in the background.
- **Fonts are bundled** (Oswald, Be Vietnam Pro via `@fontsource`) instead of loaded from Google Fonts: no render-blocking third-party request. Fonts are cached for offline use on first load.
- **Faster first load:** the game, setup, pools and history screens (with the drag-and-drop library) load on demand and are prefetched in idle time. Main bundle 456 kB → 320 kB (136 → 99 kB gzipped).
- **Starting Night 1** no longer stalls the page: about 180–210 ms → 65–90 ms from tap to frame in a headless benchmark, with no long tasks.
- Saving the game to the device is batched instead of running on every keystroke, vote or card drop. Anything pending is written when the app is hidden or closed.
- Role grids and the player board only re-render the cards that changed.
- Full-height screens use `svh` instead of `dvh`, so the page no longer relays out while the mobile address bar slides.
- `@dnd-kit/core` 6.1 → 6.3.

### Fixed
- Buttons' colour transitions were silently disabled by the press animation's CSS. Colour changes are now intentionally instant: one tap can restyle dozens of buttons, and fading them all at once caused jank.
- Card grids stuttered while scrolling, because every card re-rendered as it scrolled into view (`content-visibility`).
- Sheets open one render sooner.

### Removed
- `@formkit/auto-animate` dependency.

## [0.1.0] - Unreleased

Implements [`UPDATE_v0.1.0.md`](UPDATE_v0.1.0.md). In review in [PR #1](https://github.com/hieubt280299/werewolf-moderator/pull/1).

### Added
- **Moderator accounts:** username + password sign-up and sign-in. Uses Firebase Auth + Firestore when `VITE_FIREBASE_*` is configured, with a device-local fallback otherwise.
- **Profile data:** editable display name, up to 10 saved role pools, game history, and lifetime stats (games moderated, Werewolf, Village and other wins).
- **Main hub:** Start new game, Continue game (only while a game is in progress), Custom decks, History & analytics, Profile & settings.
- **Custom role pools:** build, edit and delete up to 10 named role pools (sets of roles, no counts), with Select all / Deselect all.
- **Setup flow: Players → Role Pool → Deck → Deal.** The Role Pool step loads, selects/deselects and saves pools (new or replacing one). The Deck step sets counts and auto-balances from the pool.
- **Role grids** are grouped into Village / Wolves / Other and sorted by difficulty, then balance weight.
- **Card preview:** tapping a card in the pool editor, Role Pool or Deck step shows it full-size with the complete description, team, balance weight and night behavior.
- **Drag-and-drop dealing:** fixed player seats and a tray of the deck's cards. Drag a card onto a seat (dropping on a filled seat swaps), or tap a card and then a seat. Reshuffle and Clear are available.
- **History & analytics:** finished games with roster, winners and the full game timeline. Victory split chart.
- **Profile & settings** opens as a modal over the current screen.
- **Setup wizard progress** (step and deal board) is saved, so leaving the screen or reloading keeps your place.
- **Profile & settings:** change display name, language, sound cues, sign out. Password change opens on demand from a **Change password** button.
- **Character portraits:** 16 inline-SVG role illustrations, used on cards and as round badges in lists.
- **Timeline / Diễn biến:** the game log, oldest first and grouped by Night/Day. Every event names the player and their role, and night actions are now logged too.
- **25 expansion roles** with card-accurate rules and portraits drawn after the Deluxe card art: Apprentice Seer, Aura Seer, P.I., Priest, Mason, Mayor, Tough Guy, Village Idiot, Pacifist, Ghost, Old Hag, Troublemaker, Leprechaun, Drunk, Cupid, Doppelgänger, Virginia Woolf, Tanner, Minion, Wolf Man, Big Bad Wolf, Dire Wolf, Fang Face, Fruit Brute, Wolverine.
- **Teams:** Village and Wolves as the main teams. **The Couple** forms only from lovers on different teams and wins as the last team standing; while it lives, no other team can win. Lone Wolf, Tanner, Vampires and Cult are rare extras. New win conditions for The Couple and the Tanner.
- **Difficulty Level (1–3)** for every role, shown in the card preview. Auto-balance only picks roles up to the table's experience level.
- New mechanics: linked deaths, role changes on death, delayed death, first-night-only and once-per-game powers, seat adjacency, forced and double votes, a day exile, double-elimination days, and the Wolverine's metallic sound (with a sound cue).
- **Back navigation:** the back arrow, browser Back and the Android back gesture return to the previous screen.
- **Installable app (PWA):** add Werewolf Gamemaster to the home screen or install it from the browser. It opens full-screen with its own icon and works offline after the first visit. Updates download in the background and apply on the next launch, never in the middle of a game.
- `firestore.rules`, plus a Firebase setup guide in the README.

### Changed
- **Cursed card** is split half Village blue, half Wolf red (backdrop, plate, badges), since the Cursed can end up on either team.
- **Card plate names** use Title Case instead of ALL CAPS.
- **Vietnamese role names:** Tiên Tri Chức Năng (Aura Seer), Mục Sư (Priest), Thanh Niên Cứng (Tough Guy), Con Bệnh (Diseased), Pháp Sư Câm (Spellcaster), Say Rượu (Drunk), Yêu Tinh (Leprechaun), Người Lai (Lycan), Sói Đầu Đàn (Big Bad Wolf), Sói Đau Khổ (Dire Wolf), Sói Răng Thỏ (Fang Face), Chán Đời (Tanner).
- **Dual-language cards:** the English name runs down the edge, as printed, and the localized name is on the plate.
- **Dawn announcement:** eliminations read only "Player X was eliminated", with no cause, tinted by the victim's side and tagged with their role.
- **Accusations** can name several accusers (the card shows how many); each gets their own timeline line.
- **One nomination per day:** a new nomination opens only after the current one is withdrawn, or after an elimination on a Troublemaker day.
- **Vietnamese voting terms:** nominating is "đưa lên giàn", eliminating by vote is "treo cổ"; other eliminations stay "loại / bị loại".
- **Hub stats** add an "Other team wins" tile beside Werewolf and Village wins.
- **Accused voter chip:** dashed and shows only the name. Hover or tap explains the abstain rule.
- **Default language:** Vietnamese is now the default; English is in settings.
- **Animations:** Framer Motion replaced by stepped CSS keyframes (transform/opacity only) and `@formkit/auto-animate`. Main bundle 372 kB → 329 kB.
- Saved games from earlier builds are upgraded on load, so new fields never break them.
- In-game components moved to `src/components/game/`. `src/components/dashboard/` now holds the hub screens.

- Role pools are stored in the profile's own `pools` field. Saved decks from earlier builds are discarded on first load. `firestore.rules` now caps `pools` at 10, so republish the rules.
- Villager and Werewolf are always part of a pool and can't be deselected. Village and Wolves sections have their own Select all / Deselect all.
- Auto-balance keeps Villagers strictly below half the table (e.g. at most 4 of 10) whenever the pool allows. Manual counts are unrestricted.
- Vietnamese: "role" is "chức năng" and "role pool" is "danh sách chức năng".
- Disabled ± buttons are clearly dimmed and inert.

### Fixed
- The accused can no longer be counted as voting on their own nomination, in both the UI and the rules engine.
- Sheets could render behind the footer and stop responding to taps (animation fill-mode left a transform on ancestors). Sheets are now portalled.
- Crash on sign-in in recent Chromium ("destroy is not a function"): an effect returned `scrollTo()`'s Promise as its cleanup.

- Opening Settings during game setup reset the wizard to the Players step.
- A page-wide horizontal scroll on the deck screens (the balance meter's marker layer overflowed).
- Resizing the window lagged on the card screens, showing a clipped, stale layout. Cards now keep a fixed width per breakpoint, columns adjust around them, and off-screen cards skip rendering. Blurred sticky bars are now solid.
- Swiping down at the top of the page no longer triggers pull-to-refresh or a rubber-band bounce.
- Player name rows overflowed on screens narrower than 300 px.

### Removed
- Settings sheet and manual cloud-sync toggle. With Firebase configured, the in-progress game syncs automatically.

## [0.0.1] - 2026-10-13

First release.

### Added
- React 18 + TypeScript + Vite app, styled after the Ultimate Werewolf Deluxe cards ("Deluxe Grimoire" theme: pitch black, charcoal panels, faction colors).
- Role catalog for 16 Deluxe roles with printed balance weights.
- Setup wizard: players, deck builder with balance meter and weight-based auto-balance (experience targets), random deal with manual correction.
- Night script: wake order built from the deck, ghost calls for dead roles, Seer/Sorceress results, Witch potions.
- Dawn report, day nominations with majority voting and a debate timer.
- Rules: Hunter shot, Wolf Cub double kill, Diseased skip, Cursed transformation, Lycan misdirection, Prince reveal, Vampire delayed kill, Cult win, Lone Wolf win, parity win checks.
- EN/VI localization, optional SFX cues, undo, localStorage persistence, optional Firebase backup.
- Vercel SPA config.

[0.1.0]: https://github.com/hieubt280299/werewolf-moderator/pull/1
[0.0.1]: https://github.com/hieubt280299/werewolf-moderator/commit/420f5cd
