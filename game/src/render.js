// Drawing only: the city's state and the current screen in, pixels out. The camera
// follows the player across the 3200 x 2400 city; the HUD (cash, health, wanted stars,
// objective, speed) and the minimap are painted in screen space on top. Flat shapes,
// canvas text and a few gradients — no images, no fonts fetched, nothing over the network.

import { FONT, PALETTE, ROADS_X, ROADS_Y, ROAD_WIDTH, WORLD } from './config.js';
import { PLACES } from './city.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_BUSTED = 'busted';
export const SCREEN_WASTED = 'wasted';

const VIEW = { width: 1280, height: 720 };
const MINIMAP = { width: 232, height: 174, x: 0, y: 0 };
const HALF_ROAD = ROAD_WIDTH / 2;

export function createRenderer(canvas, city) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };
  const camera = { x: PLACES.start.x, y: PLACES.start.y };
  const fonts = new Map();

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    view.scale = Math.min(width / VIEW.width, height / VIEW.height);
    view.x = (width - VIEW.width * view.scale) / 2;
    view.y = (height - VIEW.height * view.scale) / 2;
    MINIMAP.x = VIEW.width - MINIMAP.width - 16;
    MINIMAP.y = 16;
  }

  function text(value, x, y, size, color, align, baseline) {
    if (!fonts.has(size)) fonts.set(size, `${size}px ${FONT}`);
    context.font = fonts.get(size);
    context.fillStyle = color;
    context.textAlign = align ?? 'left';
    context.textBaseline = baseline ?? 'alphabetic';
    context.fillText(value, x, y);
  }

  function drawGround() {
    // Base ground: warm sand-toned blocks, with the bay along the west edge.
    context.fillStyle = PALETTE.sand;
    context.fillRect(0, 0, WORLD.width, WORLD.height);
    context.fillStyle = PALETTE.water;
    context.fillRect(city.water.x, city.water.y, city.water.width, city.water.height);
    context.fillStyle = PALETTE.waterDeep;
    for (let y = 0; y < WORLD.height; y += 90) {
      context.fillRect(20, y + 30, 130, 6);
    }
    // Marina pier.
    context.fillStyle = '#8a6a4a';
    context.fillRect(150, 1600, 90, 14);
    context.fillRect(150, 1700, 90, 14);
    // Parks.
    for (const park of city.parks) {
      context.fillStyle = PALETTE.parkGrass;
      context.fillRect(park.x, park.y, park.width, park.height);
    }
    // Roads: asphalt with sidewalks.
    context.fillStyle = PALETTE.sidewalk;
    for (const rx of ROADS_X) context.fillRect(rx - HALF_ROAD - 14, 0, ROAD_WIDTH + 28, WORLD.height);
    for (const ry of ROADS_Y) context.fillRect(0, ry - HALF_ROAD - 14, WORLD.width, ROAD_WIDTH + 28);
    context.fillStyle = PALETTE.asphalt;
    for (const rx of ROADS_X) context.fillRect(rx - HALF_ROAD, 0, ROAD_WIDTH, WORLD.height);
    for (const ry of ROADS_Y) context.fillRect(0, ry - HALF_ROAD, WORLD.width, ROAD_WIDTH);
    // Lane dashes.
    context.fillStyle = PALETTE.roadLine;
    for (const rx of ROADS_X) {
      for (let y = 20; y < WORLD.height; y += 80) context.fillRect(rx - 3, y, 6, 40);
    }
    for (const ry of ROADS_Y) {
      for (let x = 220; x < WORLD.width; x += 80) context.fillRect(x, ry - 3, 40, 6);
    }
    // Crosswalk stripes at every intersection.
    context.fillStyle = 'rgba(245,240,255,0.85)';
    for (const rx of ROADS_X) {
      for (const ry of ROADS_Y) {
        for (let i = -2; i <= 2; i += 1) {
          context.fillRect(rx + i * 22 - 6, ry - HALF_ROAD - 12, 12, 24);
          context.fillRect(rx - HALF_ROAD - 12, ry + i * 22 - 6, 24, 12);
        }
      }
    }
    // Trees.
    for (const tree of city.trees) {
      context.fillStyle = '#4a7a3a';
      context.beginPath();
      context.arc(tree.x, tree.y, tree.r, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#5d9448';
      context.beginPath();
      context.arc(tree.x - 4, tree.y - 4, tree.r * 0.6, 0, Math.PI * 2);
      context.fill();
    }
  }

  function drawBuildings(time) {
    for (const building of city.buildings) {
      if (building.x < -100) continue;
      // Soft shadow, offset to the south-east.
      context.fillStyle = 'rgba(0,0,0,0.18)';
      context.fillRect(building.x + 10, building.y + 12, building.width, building.height);
      context.fillStyle = building.color;
      context.fillRect(building.x, building.y, building.width, building.height);
      context.fillStyle = PALETTE.roof;
      context.fillRect(building.x + 8, building.y + 8, building.width - 16, building.height - 16);
      // Windows.
      context.fillStyle = 'rgba(255, 240, 180, 0.75)';
      const cols = Math.max(1, Math.floor(building.width / 46));
      const rows = Math.max(1, Math.floor(building.height / 46));
      for (let c = 0; c < cols; c += 1) {
        for (let r = 0; r < rows; r += 1) {
          if ((c * 7 + r * 3) % 3 === 0) continue;
          context.fillRect(building.x + 16 + c * 46, building.y + 16 + r * 46, 18, 14);
        }
      }
      // Neon sign, pulsing gently.
      if (building.sign) {
        const pulse = 0.65 + 0.35 * Math.sin(time * 2 + building.x);
        context.globalAlpha = pulse;
        context.fillStyle = building.neon;
        context.fillRect(building.x + building.width / 2 - 26, building.y - 8, 52, 10);
        context.globalAlpha = 1;
        text(building.name, building.x + building.width / 2, building.y + building.height + 18, 13, building.neon, 'center');
      }
    }
  }

  function drawPlaceMarkers(target, time) {
    // The story places get a small label; the active target gets a pulsing beacon.
    for (const key of Object.keys(PLACES)) {
      if (key === 'start') continue;
      const place = PLACES[key];
      context.fillStyle = 'rgba(12,10,28,0.6)';
      context.beginPath();
      context.arc(place.x, place.y, 26, 0, Math.PI * 2);
      context.fill();
      text(place.label, place.x, place.y + 44, 13, PALETTE.text, 'center');
    }
    if (target) {
      const pulse = 1 + 0.18 * Math.sin(time * 5);
      context.strokeStyle = PALETTE.objective;
      context.lineWidth = 4;
      context.beginPath();
      context.arc(target.x, target.y, 44 * pulse, 0, Math.PI * 2);
      context.stroke();
      context.fillStyle = PALETTE.objective;
      context.beginPath();
      context.arc(target.x, target.y, 8, 0, Math.PI * 2);
      context.fill();
      // A bouncing diamond above the beacon.
      const bob = Math.sin(time * 4) * 8;
      context.save();
      context.translate(target.x, target.y - 62 + bob);
      context.rotate(Math.PI / 4);
      context.fillRect(-9, -9, 18, 18);
      context.restore();
    }
  }

  function drawCar(car, time) {
    context.save();
    context.translate(car.x, car.y);
    context.rotate(car.angle);
    context.fillStyle = 'rgba(0,0,0,0.25)';
    context.fillRect(-26, -12, 54, 28);
    context.fillStyle = car.color;
    roundRect(-27, -13, 54, 26, 8);
    context.fill();
    // Windshield and rear window.
    context.fillStyle = '#1d2733';
    context.fillRect(6, -10, 10, 20);
    context.fillRect(-16, -10, 7, 20);
    // Headlights.
    context.fillStyle = '#fff8c0';
    context.fillRect(25, -11, 4, 6);
    context.fillRect(25, 5, 4, 6);
    if (car.kind === 'police') {
      const flash = Math.floor(time * 4) % 2 === 0;
      context.fillStyle = flash ? '#ff2e2e' : '#2e7bff';
      context.fillRect(-6, -13, 12, 5);
      context.fillStyle = flash ? '#2e7bff' : '#ff2e2e';
      context.fillRect(-6, 8, 12, 5);
      text('PD', 0, 4, 11, '#ffffff', 'center', 'middle');
    }
    if (car.kind === 'player') {
      context.strokeStyle = PALETTE.objective;
      context.lineWidth = 2;
      roundRect(-27, -13, 54, 26, 8);
      context.stroke();
    }
    context.restore();
  }

  function roundRect(x, y, width, height, radius) {
    context.beginPath();
    context.moveTo(x + radius, y);
    context.arcTo(x + width, y, x + width, y + height, radius);
    context.arcTo(x + width, y + height, x, y + height, radius);
    context.arcTo(x, y + height, x, y, radius);
    context.arcTo(x, y, x + width, y, radius);
    context.closePath();
  }

  function drawPed(ped) {
    if (ped.down > 0) {
      // Lying flat, dazed.
      context.fillStyle = ped.color;
      context.beginPath();
      context.ellipse(ped.x, ped.y, 14, 7, ped.angle, 0, Math.PI * 2);
      context.fill();
      return;
    }
    const bob = Math.sin(ped.walkPhase) * 2;
    context.fillStyle = 'rgba(0,0,0,0.2)';
    context.beginPath();
    context.ellipse(ped.x, ped.y + 8, 10, 4, 0, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = ped.color;
    context.beginPath();
    context.arc(ped.x, ped.y + bob * 0.3, 11, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = '#f2c9a0';
    context.beginPath();
    context.arc(ped.x + Math.cos(ped.angle) * 4, ped.y + Math.sin(ped.angle) * 4 + bob * 0.3, 6, 0, Math.PI * 2);
    context.fill();
  }

  function drawCop(cop) {
    if (cop.down > 0) {
      context.fillStyle = PALETTE.police;
      context.beginPath();
      context.ellipse(cop.x, cop.y, 14, 7, cop.angle, 0, Math.PI * 2);
      context.fill();
      return;
    }
    context.fillStyle = PALETTE.police;
    context.beginPath();
    context.arc(cop.x, cop.y, 12, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = '#ffffff';
    context.beginPath();
    context.arc(cop.x, cop.y - 2, 6, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = '#1d2733';
    context.fillRect(cop.x - 7, cop.y - 12, 14, 5);
  }

  function drawPlayer(player, time) {
    if (player.inCar) return;
    if (player.invulnerable > 0 && Math.floor(time * 10) % 2 === 0) return;
    const bob = player.moving ? Math.sin(time * 14) * 2 : 0;
    context.fillStyle = 'rgba(0,0,0,0.25)';
    context.beginPath();
    context.ellipse(player.x, player.y + 10, 12, 5, 0, 0, Math.PI * 2);
    context.fill();
    // Rico Vane: neon-pink jacket, dark jeans, always easy to spot.
    context.fillStyle = PALETTE.playerJacket;
    context.beginPath();
    context.arc(player.x, player.y + bob * 0.3, 13, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = '#f2c9a0';
    context.beginPath();
    context.arc(player.x + Math.cos(player.angle) * 5, player.y + Math.sin(player.angle) * 5 + bob * 0.3, 7, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = '#1d2733';
    context.beginPath();
    context.arc(player.x + Math.cos(player.angle) * 5, player.y + Math.sin(player.angle) * 5 + bob * 0.3 - 2, 7, Math.PI, 0);
    context.fill();
    // Punch arc while swinging.
    if (player.punchTimer > 0.25) {
      context.strokeStyle = 'rgba(255,255,255,0.8)';
      context.lineWidth = 3;
      context.beginPath();
      context.arc(player.x, player.y, 30, player.angle - 0.7, player.angle + 0.7);
      context.stroke();
    }
  }

  function drawParticles(particles) {
    for (const particle of particles) {
      context.globalAlpha = Math.max(0, particle.life / particle.maxLife);
      context.fillStyle = particle.color;
      context.fillRect(particle.x - particle.size / 2, particle.y - particle.size / 2, particle.size, particle.size);
    }
    context.globalAlpha = 1;
  }

  function drawPickups(pickups, time) {
    for (const pickup of pickups) {
      if (pickup.taken > 0) continue;
      const bob = Math.sin(pickup.bob) * 3;
      context.fillStyle = PALETTE.gold;
      context.beginPath();
      context.arc(pickup.x, pickup.y + bob, 10, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#7a5b00';
      text('$', pickup.x, pickup.y + bob + 4, 13, '#7a5b00', 'center', 'middle');
    }
  }

  function drawHud(ui) {
    // Top-left: cash and health.
    context.fillStyle = PALETTE.hudPanel;
    roundRect(16, 16, 250, 84, 10);
    context.fill();
    text(`$${ui.cash.toLocaleString('en-US')}`, 30, 48, 30, PALETTE.gold, 'left');
    context.fillStyle = '#333';
    context.fillRect(30, 62, 180, 14);
    context.fillStyle = ui.health > 30 ? '#37d67a' : '#ff3b3b';
    context.fillRect(30, 62, 180 * Math.max(0, ui.health / 100), 14);
    text('RICO VANE', 252, 36, 12, PALETTE.muted, 'right');
    // Wanted stars, top-centre-right.
    if (ui.stars > 0) {
      for (let i = 0; i < 5; i += 1) {
        text('★', VIEW.width / 2 - 60 + i * 26, 44, 26, i < ui.stars ? PALETTE.star : 'rgba(255,255,255,0.25)', 'left');
      }
      text('WANTED', VIEW.width / 2, 70, 13, PALETTE.danger, 'center');
    }
    // Objective bar, top centre.
    if (ui.objective) {
      const width = Math.min(760, 40 + ui.objective.length * 8.4);
      context.fillStyle = PALETTE.hudPanel;
      roundRect((VIEW.width - width) / 2, 84, width, 34, 8);
      context.fill();
      text(`◆ ${ui.objective}`, VIEW.width / 2, 107, 16, PALETTE.objective, 'center');
    }
    // Toast, centre.
    if (ui.toast) {
      context.fillStyle = 'rgba(12,10,28,0.85)';
      const width = Math.min(860, 60 + ui.toast.length * 9);
      roundRect((VIEW.width - width) / 2, 300, width, 44, 10);
      context.fill();
      text(ui.toast, VIEW.width / 2, 330, 20, PALETTE.text, 'center');
    }
    // Speed and controls, bottom-left.
    if (ui.driving) {
      text(`${Math.round(Math.abs(ui.speed) * 0.36)} km/h`, 30, VIEW.height - 66, 30, PALETTE.text, 'left');
      text('WASD drive · E exit car', 30, VIEW.height - 36, 14, PALETTE.muted, 'left');
    } else {
      text('WASD move · E steal car · SPACE punch · P pause · M mute', 30, VIEW.height - 36, 14, PALETTE.muted, 'left');
    }
    if (ui.muted) text('MUTED', VIEW.width - 30, VIEW.height - 36, 14, PALETTE.muted, 'right');
    // Off-screen objective arrow.
    if (ui.targetArrow) {
      const { angle, distance } = ui.targetArrow;
      const cx = VIEW.width / 2 + Math.cos(angle) * 250;
      const cy = VIEW.height / 2 + Math.sin(angle) * 190;
      context.save();
      context.translate(cx, cy);
      context.rotate(angle);
      context.fillStyle = PALETTE.objective;
      context.beginPath();
      context.moveTo(18, 0);
      context.lineTo(-10, -12);
      context.lineTo(-10, 12);
      context.closePath();
      context.fill();
      context.restore();
      text(`${Math.round(distance)}m`, cx, cy + 28, 13, PALETTE.objective, 'center');
    }
  }

  function drawMinimap(state, target) {
    const scaleX = MINIMAP.width / WORLD.width;
    const scaleY = MINIMAP.height / WORLD.height;
    context.fillStyle = 'rgba(12,10,28,0.8)';
    roundRect(MINIMAP.x - 6, MINIMAP.y - 6, MINIMAP.width + 12, MINIMAP.height + 12, 8);
    context.fill();
    context.save();
    context.beginPath();
    context.rect(MINIMAP.x, MINIMAP.y, MINIMAP.width, MINIMAP.height);
    context.clip();
    context.fillStyle = '#2a2a38';
    context.fillRect(MINIMAP.x, MINIMAP.y, MINIMAP.width, MINIMAP.height);
    context.fillStyle = '#2e7fa8';
    context.fillRect(MINIMAP.x, MINIMAP.y, 180 * scaleX, MINIMAP.height);
    context.fillStyle = '#55555f';
    for (const rx of ROADS_X) context.fillRect(MINIMAP.x + rx * scaleX - 3, MINIMAP.y, 6, MINIMAP.height);
    for (const ry of ROADS_Y) context.fillRect(MINIMAP.x, MINIMAP.y + ry * scaleY, MINIMAP.width, 6);
    // Cash pickups as gold dots.
    context.fillStyle = PALETTE.gold;
    for (const pickup of state.pickups) {
      if (pickup.taken > 0) continue;
      context.fillRect(MINIMAP.x + pickup.x * scaleX - 1, MINIMAP.y + pickup.y * scaleY - 1, 3, 3);
    }
    // Police as blue dots.
    context.fillStyle = '#4d8dff';
    for (const car of state.cars) {
      if (car.kind !== 'police') continue;
      context.beginPath();
      context.arc(MINIMAP.x + car.x * scaleX, MINIMAP.y + car.y * scaleY, 3, 0, Math.PI * 2);
      context.fill();
    }
    // Target as a pulsing yellow diamond.
    if (target) {
      context.fillStyle = PALETTE.objective;
      context.save();
      context.translate(MINIMAP.x + target.x * scaleX, MINIMAP.y + target.y * scaleY);
      context.rotate(Math.PI / 4);
      context.fillRect(-5, -5, 10, 10);
      context.restore();
    }
    // Player as a white arrow.
    const player = state.player;
    context.save();
    context.translate(MINIMAP.x + player.x * scaleX, MINIMAP.y + player.y * scaleY);
    context.rotate(player.angle);
    context.fillStyle = '#ffffff';
    context.beginPath();
    context.moveTo(8, 0);
    context.lineTo(-6, -5);
    context.lineTo(-6, 5);
    context.closePath();
    context.fill();
    context.restore();
    context.restore();
    text('NEON BAY', MINIMAP.x + 4, MINIMAP.y + MINIMAP.height + 16, 11, PALETTE.muted, 'left');
  }

  function drawPanel(title, lines, prompt, accent) {
    const width = 640;
    const height = 150 + lines.length * 32 + 70;
    const x = (VIEW.width - width) / 2;
    const y = (VIEW.height - height) / 2;
    context.fillStyle = 'rgba(10, 8, 24, 0.88)';
    roundRect(x, y, width, height, 14);
    context.fill();
    context.strokeStyle = accent ?? PALETTE.neon[1];
    context.lineWidth = 3;
    roundRect(x, y, width, height, 14);
    context.stroke();
    text(title, VIEW.width / 2, y + 72, 46, PALETTE.text, 'center');
    for (let i = 0; i < lines.length; i += 1) {
      text(lines[i], VIEW.width / 2, y + 122 + i * 32, 18, PALETTE.muted, 'center');
    }
    text(prompt, VIEW.width / 2, y + height - 34, 20, PALETTE.gold, 'center');
  }

  function drawTitle(state, best, hasSaveGame, time) {
    // Slow pan across the city behind the title.
    camera.x = 1600 + Math.cos(time * 0.05) * 500;
    camera.y = 1200 + Math.sin(time * 0.04) * 350;
    drawWorld(state, time, null);
    context.fillStyle = 'rgba(10, 8, 24, 0.45)';
    context.fillRect(0, 0, VIEW.width, VIEW.height);
    text('NEON BAY', VIEW.width / 2, 190, 84, '#ff2e88', 'center');
    text('HEIST', VIEW.width / 2, 268, 84, '#00e5ff', 'center');
    text('An original open-world crime story — no kings, no empires, just one driver, one city, one vault.', VIEW.width / 2, 312, 17, PALETTE.text, 'center');
    const lines = [
      'Explore Neon Bay on foot or behind the wheel. Steal cars, dodge the Bay PD,',
      'run three story missions for Rico Vane — and grab every cash bag you see.',
      '',
      'WASD / arrows — move & drive      E — steal / exit car      SPACE — punch',
      'P — pause      M — mute      Progress saves automatically',
    ];
    if (best > 0) lines.push(`Best haul so far: $${best.toLocaleString('en-US')}`);
    const prompt = hasSaveGame ? 'Press SPACE to continue your story — or N for a new game' : 'Press SPACE or click to start';
    drawPanelLines(lines, prompt, time);
  }

  function drawPanelLines(lines, prompt, time) {
    void time;
    const y = 350;
    for (let i = 0; i < lines.length; i += 1) {
      text(lines[i], VIEW.width / 2, y + i * 28, 17, PALETTE.muted, 'center');
    }
    const pulse = 0.7 + 0.3 * Math.sin(time * 3);
    context.globalAlpha = pulse;
    text(prompt, VIEW.width / 2, y + lines.length * 28 + 26, 21, PALETTE.gold, 'center');
    context.globalAlpha = 1;
  }

  function drawWorld(state, time, target) {
    // Camera follows the player, clamped to the city.
    const focus = state.player;
    camera.x = Math.max(VIEW.width / 2 - 40, Math.min(WORLD.width - VIEW.width / 2 + 40, focus.x));
    camera.y = Math.max(VIEW.height / 2 - 40, Math.min(WORLD.height - VIEW.height / 2 + 40, focus.y));
    const left = camera.x - VIEW.width / 2;
    const top = camera.y - VIEW.height / 2;
    context.save();
    context.translate(-left, -top);
    drawGround();
    drawPlaceMarkers(target, time);
    drawPickups(state.pickups, time);
    drawBuildings(time);
    for (const car of state.cars) drawCar(car, time);
    for (const ped of state.peds) drawPed(ped);
    for (const cop of state.cops) drawCop(cop);
    drawPlayer(state.player, time);
    drawParticles(state.particles);
    context.restore();
  }

  /** Paint one frame: the world, then the HUD or a panel for the screen the game is on. */
  function draw(state, screen, ui) {
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = PALETTE.backdrop;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    const time = state.time;
    if (screen === SCREEN_TITLE) {
      drawTitle(state, ui.best, ui.hasSave, time);
      return;
    }
    drawWorld(state, time, ui.target);
    drawHud(ui);
    drawMinimap(state, ui.target);
    if (screen === SCREEN_PAUSED) {
      context.fillStyle = 'rgba(10, 8, 24, 0.55)';
      context.fillRect(0, 0, VIEW.width, VIEW.height);
      drawPanel('PAUSED', ['Neon Bay waits for no one — except now.', `Cash so far: $${ui.cash.toLocaleString('en-US')}`], 'Press P to resume · progress is saved', PALETTE.neon[1]);
    } else if (screen === SCREEN_BUSTED) {
      context.fillStyle = 'rgba(10, 8, 24, 0.55)';
      context.fillRect(0, 0, VIEW.width, VIEW.height);
      drawPanel('BUSTED', ['The Bay PD caught Rico Vane.', 'You paid the fine and walked out of Bay General.', `Cash left: $${ui.cash.toLocaleString('en-US')}`], 'Press SPACE to get back out there', PALETTE.danger);
    } else if (screen === SCREEN_WASTED) {
      context.fillStyle = 'rgba(10, 8, 24, 0.55)';
      context.fillRect(0, 0, VIEW.width, VIEW.height);
      drawPanel('WASTED', ['Rico Vane went down — but Neon Bay never sleeps.', 'You woke up at Bay General, lighter in the pocket.', `Cash left: $${ui.cash.toLocaleString('en-US')}`], 'Press SPACE to get back out there', PALETTE.danger);
    }
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw, camera };
}
