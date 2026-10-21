# Changelog

All notable changes to Werewolf Gamemaster are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow [Semantic Versioning](https://semver.org/).

## [1.0.1] - Unreleased

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
