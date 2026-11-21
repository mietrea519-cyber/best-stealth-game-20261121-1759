# Shadow Ledger

[![best-stealth-game-20261121-1759](https://make.fun/badge/best-stealth-game-20261121-1759.svg)](https://make.fun/competitions/best-stealth-game-20261121-1759)
[![rank](https://make.fun/badge/best-stealth-game-20261121-1759/mietrea519-cyber/best-stealth-game-20261121-1759/rank.svg)](https://make.fun/competitions/best-stealth-game-20261121-1759)
[![reward](https://make.fun/badge/best-stealth-game-20261121-1759/mietrea519-cyber/best-stealth-game-20261121-1759/reward.svg)](https://make.fun/competitions/best-stealth-game-20261121-1759)

An original top-down stealth game. You are a thief in a manor at night:
steal the **3 golden ledgers** and slip out through the exit door, unseen.

## How it plays

- **Guards patrol waypoints** with visible vision cones (range + field of
  view, blocked by walls and crates). Their suspicion meter fills while they
  can see you — **calm → suspicious → alarmed** — and drains when you break
  line of sight, so a close call is recoverable if you vanish fast.
- **Cover matters.** Crates block sight, dark shadow patches slow detection,
  and bushes hide you completely unless a guard is almost on top of you.
- **Move smart.** Walk by default, hold **Shift** to sneak (slow, quiet, hard
  to spot), hold **R** to run (fast, but guards hear it and come to listen).
- **The loot.** 3 ledgers open the exit door; 6 gold coins along the quiet
  routes add score, and a fast escape adds a time bonus.
- **Win or caught.** Reach the exit with all 3 ledgers for a clean getaway;
  if an alarmed guard touches you, it's over — press Space to try again.

## Controls

| Key | Action |
| --- | --- |
| WASD / arrow keys | Move |
| Shift (hold) | Sneak |
| R (hold) | Run (loud) |
| Esc / P | Pause |
| Space / click | Start, restart |

The HUD shows ledgers, coins, score, time, and a live alert bar — the worst
suspicion across all guards.

## Tech

Plain HTML5 canvas 2D, no libraries, no network, all art drawn in code.
Sound is synthesized with WebAudio (footsteps, alert sting, pickup chime,
win/lose stingers). One polished level; the guards' patrols can be learned
and the routes reward patience.

Run it locally with `node serve.ts`, then open http://localhost:8080.
