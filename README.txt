NEXORA — ALL-IN-ONE PLAYABLE BATTLE BUILD

This build combines the real battle UI, card selection, targeting, turn flow, KO handling, and server-authoritative validation.

Core battle flow:
- 40-card deck required
- 5-card opening hand
- Automatic draw at the start of each turn
- One Energy attachment per turn
- Basic Nexora can be benched (up to 5)
- Evolutions require the matching Basic active Nexora
- Supporters are one-use and go to discard
- Search/Recovery effects use explicit card selection
- Heal and Switch use explicit Nexora selection
- Attacks require at least 1 Energy and end the turn
- Deadly cards resolve and end the turn
- Final Cyclone switches the opponent when a bench exists
- Safe Turn blocks the next damaging attack
- Power Up adds +30 to the next attack/Deadly damage
- KO promotes a bench Nexora; if none remains, the battle ends
- First player to 3 KOs wins
- Opponent hand/deck/discard contents stay hidden from the opponent

Prototype note: account passwords are still stored as plaintext and must be replaced with secure password hashing before production deployment.


ALL-IN-ONE COMPLETION PASS
- Automatic draw at start of every turn.
- Server validates 40-card decks, max 4 copies, and at least 1 Basic Nexora.
- Real card targeting for Search, Recovery, Heal, and Switch.
- Proper KO promotion and 3-KO victory.
- Deadly cards require Energy and resolve server-side.
- Evolution replaces the active form and preserves attached Energy.
- Room reconnect support using a per-player room ID.
- Invalid actions return clear messages instead of silently failing.
- Opponent hand contents remain hidden.
- This remains a prototype: account passwords are still stored in plaintext and must be replaced with password hashing before public launch.
