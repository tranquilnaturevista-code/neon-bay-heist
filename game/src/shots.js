// The screenshot scenes behind ?shot=cover|chase|mission|start. Each one plays the real
// rules forward from a fresh world for a fixed number of steps, steered by a scripted
// driver (throttle on, gentle steering, the same keys a player would press), so the
// frame is what a short game really looks like and the same seed always gives the
// same frame.

import { STEP } from './config.js';
import { PLACES } from './city.js';
import { SCREEN_PLAY, SCREEN_TITLE } from './render.js';

const DRIVE_SECONDS = 3.5;
const CHASE_SECONDS = 5;
const MISSION_SECONDS = 3;
const TITLE_SECONDS = 4;

/** A scripted driver: full throttle, steering to stay on the road ahead. */
function driverInput(entities, city) {
  const car = entities.state.player.inCar;
  return {
    axis() {
      if (!car) return { x: 0, y: -1 };
      // Steer toward the road centre ahead of the car.
      const aheadX = car.x + Math.cos(car.angle) * 120;
      const aheadY = car.y + Math.sin(car.angle) * 120;
      const road = city.nearestRoad(aheadX, aheadY);
      const targetX = road.vertical ? road.x : aheadX;
      const targetY = road.vertical ? aheadY : road.y;
      const side = -Math.sin(car.angle) * (targetX - car.x) + Math.cos(car.angle) * (targetY - car.y);
      return { x: side > 12 ? 1 : side < -12 ? -1 : 0, y: -1 };
    },
    get up() {
      return true;
    },
    get down() {
      return false;
    },
  };
}

const idleInput = {
  axis() {
    return { x: 0, y: 0 };
  },
  get up() {
    return false;
  },
  get down() {
    return false;
  },
};

function putPlayerInCar(entities, x, y, angle) {
  const state = entities.state;
  // Find the nearest parked car, drive it to the staging point, and get in.
  let best = null;
  let bestDist = Infinity;
  for (const car of state.cars) {
    if (car.kind !== 'parked') continue;
    const d = Math.hypot(car.x - x, car.y - y);
    if (d < bestDist) {
      bestDist = d;
      best = car;
    }
  }
  if (!best) return false;
  best.x = x;
  best.y = y;
  best.angle = angle;
  best.speed = 0;
  state.player.x = x;
  state.player.y = y;
  entities.enterExitCar();
  return true;
}

function stepFor(entities, missions, seconds, input) {
  const steps = Math.round(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    entities.step(STEP, input, 0);
    missions.step(STEP, 0);
  }
}

/**
 * Set the game to the named scene and return the screen to draw over it.
 * cover: Rico driving through downtown traffic, mission 1 live.
 * chase: three-star wanted, Bay PD cars in pursuit.
 * mission: on foot at the bank for the vault grab, cops closing in.
 * start (or anything else): the title screen over a living city.
 */
export function stageShot(name, game) {
  const { entities, missions, city } = game;
  entities.reset();
  missions.state.index = 0;
  missions.state.stage = 0;
  missions.state.storyComplete = false;
  missions.state.active = true;

  if (name === 'cover') {
    putPlayerInCar(entities, 1600, 1650, -Math.PI / 2);
    stepFor(entities, missions, DRIVE_SECONDS, driverInput(entities, city));
    return { screen: SCREEN_PLAY };
  }
  if (name === 'chase') {
    putPlayerInCar(entities, 600, 1400, 0);
    entities.addHeat(320);
    stepFor(entities, missions, CHASE_SECONDS, driverInput(entities, city));
    return { screen: SCREEN_PLAY };
  }
  if (name === 'mission') {
    missions.state.index = 2;
    missions.state.stage = 1;
    const player = entities.state.player;
    player.x = PLACES.bank.x - 120;
    player.y = PLACES.bank.y + 60;
    player.angle = 0;
    entities.addHeat(160);
    stepFor(entities, missions, MISSION_SECONDS, idleInput);
    return { screen: SCREEN_PLAY };
  }
  stepFor(entities, missions, TITLE_SECONDS, idleInput);
  return { screen: SCREEN_TITLE };
}
