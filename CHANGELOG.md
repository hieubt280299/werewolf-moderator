# Changelog

All notable changes to Werewolf Gamemaster are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow [Semantic Versioning](https://semver.org/).

## [0.1.0] - Unreleased

Implements [`UPDATE_v0.1.0.md`](UPDATE_v0.1.0.md). In review in [PR #1](https://github.com/hieubt280299/werewolf-moderator/pull/1).

### Added
- **Moderator accounts:** username + password sign-up and sign-in. Uses Firebase Auth + Firestore when `VITE_FIREBASE_*` is configured, with a device-local fallback otherwise.
- **Profile data:** editable display name, up to 10 saved decks, game history, and lifetime stats (games moderated, Werewolf, Village and other wins).
- **Main hub:** Start new game, Continue game (only while a game is in progress), Custom decks, History & analytics, Profile & settings.
- **Deck studio:** build, edit and delete up to 10 role presets.
- **Deck selection** during setup: load a saved preset or build a role pool on the fly, then save it.
- **Card preview:** tapping a card in the deck builder or deck selection shows it full-size with the complete description, team, balance weight and night behavior.
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
- `firestore.rules`, plus a Firebase setup guide in the README.

### Changed
- **Cursed card** is split half Village blue, half Wolf red (backdrop, plate, badges), since the Cursed can end up on either team.
- **Card plate names** use Title Case instead of ALL CAPS.
- **Vietnamese role names:** Tiên Tri Chức Năng (Aura Seer), Mục Sư (Priest), Thanh Niên Cứng (Tough Guy), Con Bệnh (Diseased), Pháp Sư Câm (Spellcaster), Say Rượu (Drunk), Yêu Tinh (Leprechaun), Người Lai (Lycan), Sói Đầu Đàn (Big Bad Wolf), Sói Đau Khổ (Dire Wolf), Sói Răng Thỏ (Fang Face), Chán Đời (Tanner).
- **Dual-language cards:** the English name runs down the edge, as printed, and the localized name is on the plate.
- **Dawn announcement:** eliminations read only "Player X was eliminated", with no cause, tinted by the victim's side and tagged with their role.
- **Accused voter chip:** dashed and shows only the name. Hover or tap explains the abstain rule.
- **Default language:** Vietnamese is now the default; English is in settings.
- **Animations:** Framer Motion replaced by stepped CSS keyframes (transform/opacity only) and `@formkit/auto-animate`. Main bundle 372 kB → 329 kB.
- Saved games from earlier builds are upgraded on load, so new fields never break them.
- In-game components moved to `src/components/game/`. `src/components/dashboard/` now holds the hub screens.

### Fixed
- The accused can no longer be counted as voting on their own nomination, in both the UI and the rules engine.
- Sheets could render behind the footer and stop responding to taps (animation fill-mode left a transform on ancestors). Sheets are now portalled.
- Crash on sign-in in recent Chromium ("destroy is not a function"): an effect returned `scrollTo()`'s Promise as its cleanup.

- Opening Settings during game setup reset the wizard to the Players step.
- A page-wide horizontal scroll on the deck screens (the balance meter's marker layer overflowed).

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
