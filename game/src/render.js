// Shadow Ledger — everything the player sees. One canvas, drawn in code:
// a wooden manor floor at night, stone walls, crates, dark shadow patches,
// bushes, golden ledgers, the glowing exit door, guards with their vision
// cones (yellow when calm, red when alarmed), and the hooded thief. The HUD
// sits on top, and the title / paused / caught / win screens are overlays.
import { GUARD, VIEW } from './config.js';
import { conePolygon } from './vision.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_CAUGHT = 'caught';
export const SCREEN_WIN = 'win';

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');

  function fitCanvas() {
    const scale = Math.min(window.innerWidth / VIEW.width, window.innerHeight / VIEW.height);
    canvas.width = VIEW.width;
    canvas.height = VIEW.height;
    canvas.style.width = `${Math.floor(VIEW.width * scale)}px`;
    canvas.style.height = `${Math.floor(VIEW.height * scale)}px`;
  }
  fitCanvas();
  window.addEventListener('resize', fitCanvas);

  function drawFloor() {
    ctx.fillStyle = '#2a1f16';
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    // Wooden planks.
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.lineWidth = 2;
    for (let y = 24; y < VIEW.height; y += 48) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(VIEW.width, y);
      ctx.stroke();
    }
    for (let y = 24; y < VIEW.height; y += 48) {
      const offset = ((y / 48) % 2) * 160;
      for (let x = offset; x < VIEW.width; x += 320) {
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x, y + 48);
        ctx.stroke();
      }
    }
    // A worn rug in the hall.
    ctx.fillStyle = '#4a2430';
    ctx.fillRect(500, 300, 280, 130);
    ctx.strokeStyle = '#7a3a48';
    ctx.lineWidth = 3;
    ctx.strokeRect(508, 308, 264, 114);
  }

  function drawShadows(level) {
    for (const s of level.shadows) {
      ctx.fillStyle = 'rgba(4,6,18,0.55)';
      ctx.fillRect(s.x, s.y, s.w, s.h);
      ctx.strokeStyle = 'rgba(120,140,220,0.18)';
      ctx.lineWidth = 2;
      ctx.strokeRect(s.x + 1, s.y + 1, s.w - 2, s.h - 2);
    }
  }

  function drawSolids(level) {
    for (const r of level.solids) {
      if (r.kind === 'wall') {
        ctx.fillStyle = '#565064';
        ctx.fillRect(r.x, r.y, r.w, r.h);
        ctx.fillStyle = '#6d6780';
        ctx.fillRect(r.x, r.y, r.w, 5);
        ctx.strokeStyle = 'rgba(0,0,0,0.4)';
        ctx.lineWidth = 2;
        ctx.strokeRect(r.x + 1, r.y + 1, r.w - 2, r.h - 2);
      } else {
        // Crate: wooden box with cross planks.
        ctx.fillStyle = '#7a5a30';
        ctx.fillRect(r.x, r.y, r.w, r.h);
        ctx.strokeStyle = '#4a3517';
        ctx.lineWidth = 3;
        ctx.strokeRect(r.x + 2, r.y + 2, r.w - 4, r.h - 4);
        ctx.beginPath();
        ctx.moveTo(r.x, r.y);
        ctx.lineTo(r.x + r.w, r.y + r.h);
        ctx.moveTo(r.x + r.w, r.y);
        ctx.lineTo(r.x, r.y + r.h);
        ctx.stroke();
      }
    }
  }

  function drawBushes(level) {
    for (const b of level.bushes) {
      ctx.fillStyle = 'rgba(34,84,44,0.9)';
      for (let i = 0; i < 5; i += 1) {
        const cx = b.x + (b.w * (i + 0.5)) / 5;
        const cy = b.y + b.h / 2 + (i % 2 === 0 ? -6 : 6);
        ctx.beginPath();
        ctx.arc(cx, cy, b.h / 2 - 2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = 'rgba(90,160,90,0.7)';
      for (let i = 0; i < 4; i += 1) {
        ctx.beginPath();
        ctx.arc(b.x + 12 + i * 22, b.y + 14, 5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  function drawPickups(level, time) {
    const bob = Math.sin(time * 3) * 3;
    for (const l of level.ledgers) {
      if (l.taken) continue;
      ctx.save();
      ctx.translate(l.x, l.y + bob);
      ctx.fillStyle = 'rgba(255,210,90,0.25)';
      ctx.beginPath();
      ctx.arc(0, 0, 26, 0, Math.PI * 2);
      ctx.fill();
      // A golden ledger book.
      ctx.fillStyle = '#d9a521';
      ctx.fillRect(-13, -9, 26, 18);
      ctx.fillStyle = '#8a6a10';
      ctx.fillRect(-2, -9, 3, 18);
      ctx.fillStyle = '#fff2c0';
      ctx.fillRect(-10, -5, 8, 10);
      ctx.restore();
    }
    for (const c of level.coins) {
      if (c.taken) continue;
      ctx.save();
      ctx.translate(c.x, c.y + bob * 0.6);
      ctx.fillStyle = '#ffd94a';
      ctx.beginPath();
      ctx.arc(0, 0, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#b8860b';
      ctx.beginPath();
      ctx.arc(0, 0, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  function drawExit(level, open) {
    const e = level.exit;
    const glow = open ? 'rgba(90,255,140,0.35)' : 'rgba(120,120,120,0.18)';
    ctx.fillStyle = glow;
    ctx.fillRect(e.x - 8, e.y - 8, e.w + 16, e.h + 16);
    ctx.fillStyle = open ? '#2fae5f' : '#5a5a5a';
    ctx.fillRect(e.x, e.y, e.w, e.h);
    ctx.strokeStyle = open ? '#b6ffd0' : '#888';
    ctx.lineWidth = 3;
    ctx.strokeRect(e.x + 2, e.y + 2, e.w - 4, e.h - 4);
    ctx.fillStyle = open ? '#eafff0' : '#ccc';
    ctx.font = 'bold 15px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(open ? 'EXIT' : 'LOCKED', e.x + e.w / 2, e.y + e.h / 2 + 5);
  }

  function drawGuard(g, level) {
    // Vision cone, clipped by walls, yellow when calm, red when alarmed.
    const poly = conePolygon(g.x, g.y, g.angle, GUARD.visionRange, GUARD.halfFov, level.solids);
    ctx.beginPath();
    ctx.moveTo(poly[0].x, poly[0].y);
    for (let i = 1; i < poly.length; i += 1) ctx.lineTo(poly[i].x, poly[i].y);
    ctx.closePath();
    if (g.state === 'alarmed') ctx.fillStyle = 'rgba(255,60,50,0.30)';
    else if (g.state === 'suspicious' || g.state === 'search') ctx.fillStyle = 'rgba(255,190,60,0.26)';
    else ctx.fillStyle = 'rgba(255,220,90,0.16)';
    ctx.fill();
    // Body: a lamplighter in a dark coat, facing his angle.
    ctx.fillStyle = g.state === 'alarmed' ? '#a03028' : '#3a4a6b';
    ctx.beginPath();
    ctx.arc(g.x, g.y, g.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#d8c690';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(g.x, g.y, g.radius - 2, 0, Math.PI * 2);
    ctx.stroke();
    // Lantern dot showing which way he looks.
    ctx.fillStyle = '#ffe9a0';
    ctx.beginPath();
    ctx.arc(g.x + Math.cos(g.angle) * 10, g.y + Math.sin(g.angle) * 10, 4, 0, Math.PI * 2);
    ctx.fill();
    // Suspicion: a rising "?" then a "!" over his head.
    if (g.suspicion > 0.05 && g.state !== 'alarmed') {
      ctx.fillStyle = '#ffd94a';
      ctx.font = 'bold 22px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('?', g.x, g.y - 22);
    }
    if (g.state === 'alarmed') {
      ctx.fillStyle = '#ff5040';
      ctx.font = 'bold 26px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('!', g.x, g.y - 22);
    }
  }

  function drawPlayer(p, time) {
    // A soft pool of moonlight around the thief, fainter while sneaking.
    ctx.fillStyle = p.sneaking ? 'rgba(150,180,255,0.06)' : 'rgba(150,180,255,0.10)';
    ctx.beginPath();
    ctx.arc(p.x, p.y, 30, 0, Math.PI * 2);
    ctx.fill();
    // Hooded figure: dark cloak, pale face, darker while sneaking.
    ctx.fillStyle = p.sneaking ? '#1d2733' : '#2e3d55';
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#9fb6d8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius - 1, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#e8dcc0';
    ctx.beginPath();
    ctx.arc(p.x + p.dirX * 6, p.y + p.dirY * 6, 5, 0, Math.PI * 2);
    ctx.fill();
    // A little bounce while walking so movement reads at a glance.
    if (p.moving) {
      const bob = Math.sin(time * 14) * 2;
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.beginPath();
      ctx.arc(p.x - p.dirX * 8, p.y - p.dirY * 8 + bob, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawHud(state, screen) {
    const ledgers = state.level.ledgers.filter((l) => l.taken).length;
    const minutes = Math.floor(state.time / 60);
    const seconds = Math.floor(state.time % 60);
    ctx.fillStyle = 'rgba(8,10,18,0.72)';
    ctx.fillRect(0, 0, VIEW.width, 34);
    ctx.fillStyle = '#f2e6c0';
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`Ledgers ${ledgers}/3`, 16, 23);
    ctx.fillText(`Coins ${state.coins}`, 150, 23);
    ctx.fillText(`Score ${state.score}`, 250, 23);
    ctx.fillText(`Time ${minutes}:${String(seconds).padStart(2, '0')}`, 380, 23);
    // Alert bar: the worst suspicion across all guards.
    const barX = 560;
    const barW = 260;
    ctx.fillStyle = '#222';
    ctx.fillRect(barX, 10, barW, 14);
    ctx.fillStyle = state.worstSuspicion > 0.66 ? '#ff5040' : state.worstSuspicion > 0.33 ? '#ffb63c' : '#ffd94a';
    ctx.fillRect(barX, 10, barW * Math.min(1, state.worstSuspicion), 14);
    ctx.strokeStyle = '#888';
    ctx.lineWidth = 1;
    ctx.strokeRect(barX, 10, barW, 14);
    ctx.fillStyle = '#f2e6c0';
    ctx.fillText(state.alarmed ? 'SPOTTED!' : 'ALERT', barX + barW + 12, 23);
    // Context hints at the bottom.
    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(242,230,192,0.75)';
    ctx.font = '14px sans-serif';
    const hint = state.player.inBush
      ? 'Hidden in the bushes'
      : state.player.inShadow
        ? 'In shadow — harder to spot'
        : state.player.sneaking
          ? 'Sneaking…'
          : state.player.running
            ? 'Running — loud!'
            : 'WASD move · Shift sneak · R run · Esc pause';
    ctx.fillText(hint, VIEW.width - 16, VIEW.height - 12);
    if (screen === SCREEN_PLAY && ledgers === 3) {
      ctx.textAlign = 'center';
      ctx.fillStyle = '#8affab';
      ctx.font = 'bold 20px sans-serif';
      ctx.fillText('All ledgers stolen — reach the EXIT door, top right!', VIEW.width / 2, 66);
    }
  }

  function overlay(title, lines, accent) {
    ctx.fillStyle = 'rgba(6,8,16,0.78)';
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    ctx.textAlign = 'center';
    ctx.fillStyle = accent;
    ctx.font = 'bold 54px sans-serif';
    ctx.fillText(title, VIEW.width / 2, 210);
    ctx.fillStyle = '#f2e6c0';
    ctx.font = '20px sans-serif';
    let y = 280;
    for (const line of lines) {
      ctx.fillText(line, VIEW.width / 2, y);
      y += 32;
    }
  }

  function draw(state, screen, bestMs) {
    ctx.clearRect(0, 0, VIEW.width, VIEW.height);
    drawFloor();
    drawShadows(state.level);
    drawExit(state.level, state.ledgersTaken === 3);
    drawPickups(state.level, state.time);
    drawSolids(state.level);
    for (const g of state.guards) drawGuard(g, state.level);
    drawBushes(state.level);
    drawPlayer(state.player, state.time);
    drawHud(state, screen);
    if (screen === SCREEN_TITLE) {
      overlay('SHADOW LEDGER', [
        'A top-down stealth game. Steal the 3 ledgers and slip out unseen.',
        '',
        'WASD / arrows — move      Shift — sneak (slow, quiet)',
        'Hold R — run (fast, but guards hear you)',
        'Hide in bushes and shadows. Watch the vision cones.',
        'Esc — pause      Click or press Space to begin',
      ], '#ffd94a');
    } else if (screen === SCREEN_PAUSED) {
      overlay('PAUSED', ['Take a breath. The guards wait for no one.', '', 'Esc or Space — resume'], '#9fb6d8');
    } else if (screen === SCREEN_CAUGHT) {
      overlay('CAUGHT!', [
        'A guard caught you in the lamplight.',
        `Ledgers stolen: ${state.ledgersTaken} of 3   ·   Time ${Math.floor(state.time / 60)}:${String(Math.floor(state.time % 60)).padStart(2, '0')}`,
        '',
        'Click or press Space to try again',
      ], '#ff5040');
    } else if (screen === SCREEN_WIN) {
      const best = bestMs ? `Best escape: ${(bestMs / 1000).toFixed(1)}s` : '';
      overlay('CLEAN GETAWAY!', [
        'All three ledgers stolen. The manor never knew you were there.',
        `Time ${(state.time).toFixed(1)}s   ·   Score ${state.score}      ${best}`,
        '',
        'Click or press Space to play again',
      ], '#8affab');
    }
  }

  return { draw };
}
