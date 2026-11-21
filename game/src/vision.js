// Shadow Ledger — line of sight. Guards see through open floor only: a wall or
// a crate between two points blocks the view. Everything here is pure geometry
// over rectangles, so the same helpers serve both the guard AI and the cone
// the renderer draws.

// Does the segment (x1,y1)-(x2,y2) cross the rectangle r? Uses the slab test
// on the segment's parameter t in [0, 1].
export function segmentHitsRect(x1, y1, x2, y2, r) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  let tMin = 0;
  let tMax = 1;
  // X slab.
  if (dx === 0) {
    if (x1 < r.x || x1 > r.x + r.w) return false;
  } else {
    let a = (r.x - x1) / dx;
    let b = (r.x + r.w - x1) / dx;
    if (a > b) { const t = a; a = b; b = t; }
    tMin = Math.max(tMin, a);
    tMax = Math.min(tMax, b);
    if (tMin > tMax) return false;
  }
  // Y slab.
  if (dy === 0) {
    if (y1 < r.y || y1 > r.y + r.h) return false;
  } else {
    let a = (r.y - y1) / dy;
    let b = (r.y + r.h - y1) / dy;
    if (a > b) { const t = a; a = b; b = t; }
    tMin = Math.max(tMin, a);
    tMax = Math.min(tMax, b);
    if (tMin > tMax) return false;
  }
  return true;
}

// True when no solid blocks the straight line between the two points.
export function hasLineOfSight(x1, y1, x2, y2, solids) {
  for (let i = 0; i < solids.length; i += 1) {
    if (segmentHitsRect(x1, y1, x2, y2, solids[i])) return false;
  }
  return true;
}

// Distance from (ox,oy) along the ray at angle `a` to the nearest solid, or
// maxDist when nothing is hit. Also a slab test, this time on t in [0, max].
export function rayDistance(ox, oy, a, maxDist, solids) {
  const dx = Math.cos(a);
  const dy = Math.sin(a);
  let best = maxDist;
  for (let i = 0; i < solids.length; i += 1) {
    const r = solids[i];
    let tMin = 0;
    let tMax = best;
    let ok = true;
    if (dx === 0) {
      if (ox < r.x || ox > r.x + r.w) ok = false;
    } else {
      let near = (r.x - ox) / dx;
      let far = (r.x + r.w - ox) / dx;
      if (near > far) { const t = near; near = far; far = t; }
      tMin = Math.max(tMin, near);
      tMax = Math.min(tMax, far);
      if (tMin > tMax) ok = false;
    }
    if (ok) {
      if (dy === 0) {
        if (oy < r.y || oy > r.y + r.h) ok = false;
      } else {
        let near = (r.y - oy) / dy;
        let far = (r.y + r.h - oy) / dy;
        if (near > far) { const t = near; near = far; far = t; }
        tMin = Math.max(tMin, near);
        tMax = Math.min(tMax, far);
        if (tMin > tMax) ok = false;
      }
    }
    if (ok && tMin >= 0 && tMin < best) best = tMin;
  }
  return best;
}

// The visible part of a guard's cone as a polygon: the guard's position plus
// one point per sampled ray, each cut short by the first wall it meets. The
// renderer fills this; the AI uses hasLineOfSight + the same angles.
export function conePolygon(x, y, angle, range, halfFov, solids) {
  const points = [{ x, y }];
  const rays = 26;
  for (let i = 0; i <= rays; i += 1) {
    const a = angle - halfFov + (2 * halfFov * i) / rays;
    const d = rayDistance(x, y, a, range, solids);
    points.push({ x: x + Math.cos(a) * d, y: y + Math.sin(a) * d });
  }
  return points;
}

// Is the point inside the cone (range + angle), ignoring walls?
export function inCone(x, y, angle, range, halfFov, px, py) {
  const dx = px - x;
  const dy = py - y;
  const dist = Math.hypot(dx, dy);
  if (dist > range) return { inside: false, dist };
  const toTarget = Math.atan2(dy, dx);
  let diff = toTarget - angle;
  while (diff > Math.PI) diff -= 2 * Math.PI;
  while (diff < -Math.PI) diff += 2 * Math.PI;
  return { inside: Math.abs(diff) <= halfFov, dist };
}
