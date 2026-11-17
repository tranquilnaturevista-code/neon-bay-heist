// Neon Bay itself: the city the game plays in. A road grid with blocks between the roads,
// each block holding buildings, a park, a parking lot or the bay waterfront on the west
// edge. Key story places are fixed so missions always know where to point: the chop
// shop, the marina, the neon sign shop, the bank and the hideout. Collision is circle
// against the buildings' rectangles; roads and sidewalks are open ground.

import { PALETTE, ROADS_X, ROADS_Y, ROAD_WIDTH, WORLD } from './config.js';
import { pick, range } from './random.js';

const HALF_ROAD = ROAD_WIDTH / 2;
const BLOCK_MARGIN = 26;

/** The story places, fixed on the map so missions can point at them. */
export const PLACES = {
  garage: { x: 2620, y: 1760, label: 'Chop Shop' },
  marina: { x: 180, y: 1650, label: 'Marina' },
  neonShop: { x: 1450, y: 320, label: 'Neon Signs' },
  bank: { x: 1600, y: 900, label: 'Neon Bay Bank' },
  hideout: { x: 2720, y: 300, label: 'Hideout' },
  hospital: { x: 600, y: 1150, label: 'Bay General' },
  start: { x: 1600, y: 1150 },
};

export function createCity(random) {
  const buildings = [];
  const trees = [];
  const parks = [];

  // The bay: water along the whole west edge, with a marina pier near the south.
  const water = { x: 0, y: 0, width: 180, height: WORLD.height };

  // Blocks between the roads. The westmost column is the waterfront promenade.
  for (let ix = 0; ix <= ROADS_X.length; ix += 1) {
    const left = ix === 0 ? water.width + 40 : ROADS_X[ix - 1] + HALF_ROAD;
    const right = ix === ROADS_X.length ? WORLD.width - 40 : ROADS_X[ix] - HALF_ROAD;
    for (let iy = 0; iy <= ROADS_Y.length; iy += 1) {
      const top = iy === 0 ? 40 : ROADS_Y[iy - 1] + HALF_ROAD;
      const bottom = iy === ROADS_Y.length ? WORLD.height - 40 : ROADS_Y[iy] - HALF_ROAD;
      const block = { x: left, y: top, width: right - left, height: bottom - top };
      if (block.width < 120 || block.height < 120) continue;
      // One block in three is a park; the rest hold one to three buildings.
      if (random() < 0.3) {
        parks.push(block);
        const count = Math.floor(random() * 5) + 3;
        for (let t = 0; t < count; t += 1) {
          trees.push({
            x: range(random, block.x + 30, block.x + block.width - 30),
            y: range(random, block.y + 30, block.y + block.height - 30),
            r: range(random, 12, 20),
          });
        }
        continue;
      }
      const rows = block.height > 320 ? 2 : 1;
      const cols = block.width > 380 ? 2 : 1;
      for (let r = 0; r < rows; r += 1) {
        for (let c = 0; c < cols; c += 1) {
          const bw = block.width / cols - BLOCK_MARGIN * 2;
          const bh = block.height / rows - BLOCK_MARGIN * 2;
          const bx = block.x + BLOCK_MARGIN + c * (block.width / cols);
          const by = block.y + BLOCK_MARGIN + r * (block.height / rows);
          buildings.push({
            x: bx,
            y: by,
            width: bw,
            height: bh,
            color: pick(random, PALETTE.building),
            neon: pick(random, PALETTE.neon),
            name: pick(random, ['HOTEL', 'BAR', '24H', 'PIZZA', 'GYM', 'CLUB', 'MALL', 'CAFE', 'TATTOO', 'ARCADE']),
            sign: random() < 0.55,
          });
        }
      }
    }
  }

  // Keep the story places clear of buildings: shove any overlapping building aside.
  function clearAround(place, radius) {
    for (const building of buildings) {
      const cx = building.x + building.width / 2;
      const cy = building.y + building.height / 2;
      if (Math.abs(cx - place.x) < radius && Math.abs(cy - place.y) < radius) {
        building.x = -9999;
        building.y = -9999;
      }
    }
  }
  clearAround(PLACES.garage, 200);
  clearAround(PLACES.marina, 200);
  clearAround(PLACES.neonShop, 200);
  clearAround(PLACES.bank, 200);
  clearAround(PLACES.hideout, 200);
  clearAround(PLACES.hospital, 200);

  function isRoad(x, y) {
    for (const rx of ROADS_X) if (Math.abs(x - rx) < HALF_ROAD) return true;
    for (const ry of ROADS_Y) if (Math.abs(y - ry) < HALF_ROAD) return true;
    return false;
  }

  function onRoadPoint(x, y) {
    return isRoad(x, y);
  }

  /** A random point on a road centre line, for spawning traffic. */
  function randomRoadPoint() {
    if (random() < 0.5) {
      return { x: pick(random, ROADS_X), y: range(random, 80, WORLD.height - 80), vertical: true };
    }
    return { x: range(random, 220, WORLD.width - 80), y: pick(random, ROADS_Y), vertical: false };
  }

  /** A random point on a sidewalk beside a road, for spawning pedestrians. */
  function randomSidewalkPoint() {
    const point = randomRoadPoint();
    const off = (random() < 0.5 ? -1 : 1) * (HALF_ROAD + 14);
    if (point.vertical) return { x: Math.min(WORLD.width - 20, Math.max(200, point.x + off)), y: point.y };
    return { x: point.x, y: Math.min(WORLD.height - 20, Math.max(20, point.y + off)) };
  }

  /** A parking spot in the kerbside lane of a road, so a stolen car can drive straight off. */
  function randomParkedPoint() {
    if (random() < 0.5) {
      const road = pick(random, ROADS_X);
      const side = random() < 0.5 ? -1 : 1;
      return {
        x: road + side * (HALF_ROAD + 8),
        y: range(random, 80, WORLD.height - 80),
        angle: side > 0 ? Math.PI / 2 : -Math.PI / 2,
      };
    }
    const road = pick(random, ROADS_Y);
    const side = random() < 0.5 ? -1 : 1;
    return {
      x: range(random, 240, WORLD.width - 80),
      y: road + side * (HALF_ROAD + 8),
      angle: side > 0 ? 0 : Math.PI,
    };
  }

  /** True when a circle at (x, y) with radius r overlaps a building or the water. */
  function collidesCircle(x, y, r) {
    if (x < water.width + r || x > WORLD.width - r || y < r || y > WORLD.height - r) return true;
    for (const building of buildings) {
      if (building.x < -100) continue;
      if (x + r > building.x && x - r < building.x + building.width && y + r > building.y && y - r < building.y + building.height) return true;
    }
    return false;
  }

  /** Push a circle out of buildings and the water; returns the corrected position. */
  function resolveCircle(x, y, r) {
    if (x < water.width + r) x = water.width + r;
    if (x > WORLD.width - r) x = WORLD.width - r;
    if (y < r) y = r;
    if (y > WORLD.height - r) y = WORLD.height - r;
    for (const building of buildings) {
      if (building.x < -100) continue;
      const nearestX = Math.max(building.x, Math.min(x, building.x + building.width));
      const nearestY = Math.max(building.y, Math.min(y, building.y + building.height));
      const dx = x - nearestX;
      const dy = y - nearestY;
      const dist2 = dx * dx + dy * dy;
      if (dist2 < r * r) {
        if (dist2 === 0) {
          x = building.x + building.width + r;
        } else {
          const dist = Math.sqrt(dist2);
          x = nearestX + (dx / dist) * r;
          y = nearestY + (dy / dist) * r;
        }
      }
    }
    return { x, y };
  }

  /** The nearest road centre to a point, and whether it runs vertically. */
  function nearestRoad(x, y) {
    let bestX = ROADS_X[0];
    let bestDx = Infinity;
    for (const rx of ROADS_X) {
      const dx = Math.abs(x - rx);
      if (dx < bestDx) {
        bestDx = dx;
        bestX = rx;
      }
    }
    let bestY = ROADS_Y[0];
    let bestDy = Infinity;
    for (const ry of ROADS_Y) {
      const dy = Math.abs(y - ry);
      if (dy < bestDy) {
        bestDy = dy;
        bestY = ry;
      }
    }
    return bestDx <= bestDy ? { x: bestX, y, vertical: true } : { x, y: bestY, vertical: false };
  }

  return {
    buildings, trees, parks, water,
    isRoad, onRoadPoint, randomRoadPoint, randomSidewalkPoint, randomParkedPoint,
    collidesCircle, resolveCircle, nearestRoad,
  };
}
