// The living city: the player on foot and behind the wheel, traffic that follows the
// roads, pedestrians on the sidewalks, police who answer the wanted level, cash
// pickups and the particles every crash and punch throws off. step() advances one fixed
// step and reports what happened as bit flags, so the caller can play sounds and toasts
// without the simulation knowing about screens or audio.

import { CAR, ECONOMY, PALETTE, PLAYER, POPULATION, WANTED, WORLD } from './config.js';
import { pick, range } from './random.js';
import { PLACES } from './city.js';

export const EVENT_PUNCH = 1;
export const EVENT_CRASH = 2;
export const EVENT_PICKUP = 4;
export const EVENT_BUSTED = 8;
export const EVENT_WASTED = 16;
export const EVENT_STEAL = 32;

const CAR_COLORS = ['#e8e8e8', '#c0392b', '#2980b9', '#f39c12', '#27ae60', '#8e44ad', '#2c3e50', '#e67e22', '#16a085', '#dfe6e9'];

function angleTo(fromX, fromY, toX, toY) {
  return Math.atan2(toY - fromY, toX - fromX);
}

function angleDiff(a, b) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

function dist(x1, y1, x2, y2) {
  return Math.hypot(x2 - x1, y2 - y1);
}

export function createEntities(city, random) {
  const player = {
    x: PLACES.start.x, y: PLACES.start.y, angle: -Math.PI / 2,
    health: PLAYER.health, inCar: null, punchTimer: 0, moving: false,
    bustTimer: 0, invulnerable: 0,
  };
  const state = {
    player, cars: [], peds: [], cops: [], pickups: [], particles: [],
    cash: 0, wantedHeat: 0, time: 0, busted: false, wasted: false,
    carsStolen: 0, pedsDown: 0, chases: 0,
  };

  function stars() {
    return Math.min(WANTED.maxStars, Math.floor(state.wantedHeat / 100));
  }

  function addHeat(amount) {
    state.wantedHeat = Math.min(WANTED.maxStars * 100, state.wantedHeat + amount);
  }

  function spawnParticle(x, y, color, count, speed) {
    for (let i = 0; i < count; i += 1) {
      const angle = random() * Math.PI * 2;
      const v = range(random, speed * 0.4, speed);
      state.particles.push({
        x, y, vx: Math.cos(angle) * v, vy: Math.sin(angle) * v,
        life: range(random, 0.3, 0.7), maxLife: 0.7, color, size: range(random, 2, 5),
      });
    }
  }

  function makeCar(x, y, angle, kind, color) {
    return {
      x, y, angle, speed: 0, color: color ?? pick(random, CAR_COLORS),
      kind, driver: kind === 'traffic' ? 'traffic' : null,
      waypoint: null, turnTimer: 0, stuckTimer: 0, health: 100,
      skid: 0,
    };
  }

  function spawnTraffic() {
    for (let i = 0; i < POPULATION.traffic; i += 1) {
      const point = city.randomRoadPoint();
      const car = makeCar(point.x, point.y, point.vertical ? Math.PI / 2 : 0, 'traffic');
      car.speed = CAR.trafficSpeed * range(random, 0.8, 1.1);
      car.waypoint = nextWaypoint(car);
      state.cars.push(car);
    }
    for (let i = 0; i < POPULATION.parked; i += 1) {
      const point = city.randomParkedPoint();
      const car = makeCar(point.x, point.y, point.angle, 'parked');
      state.cars.push(car);
    }
  }

  function spawnPeds() {
    for (let i = 0; i < POPULATION.peds; i += 1) {
      const point = city.randomSidewalkPoint();
      state.peds.push({
        x: point.x, y: point.y, angle: random() * Math.PI * 2,
        speed: range(random, 40, 70), color: pick(random, PALETTE.neon),
        down: 0, flee: 0, target: null, walkPhase: random() * 10,
      });
    }
  }

  function spawnPickups() {
    for (let i = 0; i < POPULATION.pickups; i += 1) {
      const point = city.randomSidewalkPoint();
      state.pickups.push({ x: point.x, y: point.y, taken: 0, bob: random() * 6 });
    }
  }

  /** The next road waypoint for a traffic car: the next intersection along its heading. */
  function nextWaypoint(car) {
    const heading = Math.round(car.angle / (Math.PI / 2)) % 4;
    const dirX = [1, 0, -1, 0][((heading % 4) + 4) % 4];
    const dirY = [0, 1, 0, -1][((heading % 4) + 4) % 4];
    // Drive to a point 300-700 px ahead on the same road, then choose a turn at the junction.
    const distance = range(random, 300, 700);
    const road = city.nearestRoad(car.x, car.y);
    const lane = dirX !== 0 ? (dirY === 0 ? (dirX > 0 ? 1 : -1) : 0) : 0;
    let wx = car.x + dirX * distance;
    let wy = car.y + dirY * distance;
    // Keep on the road centre line with a right-hand lane offset.
    if (dirX !== 0) wy = road.y + (dirX > 0 ? 30 : -30);
    if (dirY !== 0) wx = road.x + (dirY > 0 ? -30 : 30);
    void lane;
    wx = Math.max(220, Math.min(WORLD.width - 40, wx));
    wy = Math.max(40, Math.min(WORLD.height - 40, wy));
    return { x: wx, y: wy };
  }

  function stepTraffic(car, dt) {
    if (!car.waypoint) car.waypoint = nextWaypoint(car);
    const target = angleTo(car.x, car.y, car.waypoint.x, car.waypoint.y);
    const diff = angleDiff(car.angle, target);
    car.angle += Math.max(-1.9 * dt, Math.min(1.9 * dt, diff));
    const cruise = CAR.trafficSpeed;
    car.speed += (cruise - car.speed) * Math.min(1, dt * 1.5);
    // Slow for a car ahead on the same road.
    for (const other of state.cars) {
      if (other === car || other.kind === 'parked') continue;
      const ahead = Math.cos(car.angle) * (other.x - car.x) + Math.sin(car.angle) * (other.y - car.y);
      const side = Math.abs(-Math.sin(car.angle) * (other.x - car.x) + Math.cos(car.angle) * (other.y - car.y));
      if (ahead > 0 && ahead < 90 && side < 28) car.speed = Math.min(car.speed, other.speed * 0.6);
    }
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
    const fixed = city.resolveCircle(car.x, car.y, 24);
    car.x = fixed.x;
    car.y = fixed.y;
    if (dist(car.x, car.y, car.waypoint.x, car.waypoint.y) < 46) {
      // At the junction: mostly straight on, sometimes turn.
      if (random() < 0.3) car.angle += (random() < 0.5 ? 1 : -1) * Math.PI / 2;
      car.waypoint = nextWaypoint(car);
    }
    // A car that got wedged somewhere re-joins the road network.
    car.stuckTimer += dt;
    if (car.stuckTimer > 14) {
      const point = city.randomRoadPoint();
      car.x = point.x;
      car.y = point.y;
      car.angle = point.vertical ? Math.PI / 2 : 0;
      car.waypoint = nextWaypoint(car);
      car.stuckTimer = 0;
    } else if (car.speed > 20) car.stuckTimer = 0;
  }

  function stepPolice(car, dt) {
    const target = player.inCar ? player.inCar : player;
    const tx = target.x;
    const ty = target.y;
    const want = angleTo(car.x, car.y, tx, ty);
    const diff = angleDiff(car.angle, want);
    const steer = Math.max(-2.8 * dt, Math.min(2.8 * dt, diff));
    car.angle += steer;
    const distance = dist(car.x, car.y, tx, ty);
    const cruise = distance > 500 ? CAR.policeSpeed : CAR.policeSpeed * 0.75;
    car.speed += (cruise - car.speed) * Math.min(1, dt * 2);
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
    const fixed = city.resolveCircle(car.x, car.y, 24);
    car.x = fixed.x;
    car.y = fixed.y;
    // Ramming the player hurts: on foot it knocks health down, in a car it crunches.
    if (player.inCar) {
      const pc = player.inCar;
      if (dist(car.x, car.y, pc.x, pc.y) < 52) {
        pc.speed *= 0.6;
        car.speed *= 0.5;
        spawnParticle((car.x + pc.x) / 2, (car.y + pc.y) / 2, '#ffd23e', 6, 160);
      }
    } else if (distance < 30 && car.speed > 60) {
      hurtPlayer(18);
      car.speed *= 0.3;
      spawnParticle(player.x, player.y, '#ff3b3b', 8, 180);
    }
  }

  function stepPlayerOnFoot(axis, dt, punchPressed) {
    const running = false;
    const speed = PLAYER.walkSpeed;
    const mx = axis.x;
    const my = axis.y;
    player.moving = mx !== 0 || my !== 0;
    if (player.moving) {
      const len = Math.hypot(mx, my);
      const nx = mx / len;
      const ny = my / len;
      player.angle = Math.atan2(ny, nx);
      const next = city.resolveCircle(player.x + nx * speed * dt, player.y + ny * speed * dt, PLAYER.radius);
      player.x = next.x;
      player.y = next.y;
    }
    void running;
    if (player.punchTimer > 0) player.punchTimer -= dt;
    if (player.invulnerable > 0) player.invulnerable -= dt;
    if (punchPressed && player.punchTimer <= 0) {
      player.punchTimer = PLAYER.punchCooldown;
      punch();
      return EVENT_PUNCH;
    }
    return 0;
  }

  function punch() {
    const px = player.x + Math.cos(player.angle) * (PLAYER.radius + PLAYER.punchRange / 2);
    const py = player.y + Math.sin(player.angle) * (PLAYER.radius + PLAYER.punchRange / 2);
    spawnParticle(px, py, '#ffffff', 5, 140);
    for (const ped of state.peds) {
      if (ped.down > 0) continue;
      if (dist(px, py, ped.x, ped.y) < PLAYER.punchRange + 14) {
        ped.down = 2.2;
        ped.flee = 6;
        state.pedsDown += 1;
        addHeat(WANTED.hitPed);
        if (random() < 0.4) {
          state.cash += 20;
          spawnParticle(ped.x, ped.y, PALETTE.gold, 6, 120);
        }
      }
    }
    for (const cop of state.cops) {
      if (cop.down > 0) continue;
      if (dist(px, py, cop.x, cop.y) < PLAYER.punchRange + 14) {
        cop.health -= PLAYER.punchDamage;
        cop.down = cop.health <= 0 ? 3 : 0.6;
        addHeat(WANTED.punchCop);
        spawnParticle(cop.x, cop.y, '#ff3b3b', 6, 160);
      }
    }
  }

  function stepPlayerInCar(car, input, dt) {
    const steering = input.axis().x;
    const throttle = input.up ? 1 : 0;
    const brake = input.down ? 1 : 0;
    if (throttle) car.speed += CAR.accel * dt;
    if (brake) {
      if (car.speed > 10) car.speed -= CAR.brake * dt;
      else car.speed -= CAR.reverseAccel * dt;
    }
    car.speed -= car.speed * CAR.drag * dt;
    car.speed = Math.max(-CAR.maxReverse, Math.min(CAR.maxSpeed, car.speed));
    const steerAmount = steering * CAR.steer * Math.min(1, Math.abs(car.speed) / 120) * (car.speed >= 0 ? 1 : -1);
    car.angle += steerAmount * dt;
    const wasX = car.x;
    const wasY = car.y;
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
    // Buildings stop the car: check both ends against their post-move position,
    // bounce off with a crunch.
    const frontX = car.x + Math.cos(car.angle) * 26;
    const frontY = car.y + Math.sin(car.angle) * 26;
    const rearX = car.x - Math.cos(car.angle) * 26;
    const rearY = car.y - Math.sin(car.angle) * 26;
    const frontFixed = city.resolveCircle(frontX, frontY, 14);
    const rearFixed = city.resolveCircle(rearX, rearY, 14);
    const hitWall = Math.abs(frontFixed.x - frontX) > 0.5 || Math.abs(frontFixed.y - frontY) > 0.5
      || Math.abs(rearFixed.x - rearX) > 0.5 || Math.abs(rearFixed.y - rearY) > 0.5;
    if (hitWall) {
      if (Math.abs(car.speed) > 200) {
        spawnParticle(frontX, frontY, '#ffd23e', 8, 200);
      }
      car.x = wasX;
      car.y = wasY;
      car.speed *= -0.25;
    }
    if (Math.abs(car.speed) > 300 && Math.abs(steering) > 0.4) {
      car.skid = 0.12;
      if (random() < 0.5) {
        state.particles.push({
          x: rearX, y: rearY, vx: 0, vy: 0, life: 0.5, maxLife: 0.5,
          color: 'rgba(20,20,30,0.5)', size: 7,
        });
      }
    } else if (car.skid > 0) car.skid -= dt;
    // Running over a pedestrian is a crime, and it hurts.
    for (const ped of state.peds) {
      if (ped.down > 0) continue;
      if (dist(car.x, car.y, ped.x, ped.y) < 34 && Math.abs(car.speed) > 60) {
        ped.down = 3;
        ped.flee = 8;
        state.pedsDown += 1;
        addHeat(WANTED.hitPed);
        car.speed *= 0.7;
        spawnParticle(ped.x, ped.y, '#ff3b3b', 8, 180);
      }
    }
    player.x = car.x;
    player.y = car.y;
    player.angle = car.angle;
  }

  function stepPeds(dt) {
    for (const ped of state.peds) {
      if (ped.down > 0) {
        ped.down -= dt;
        continue;
      }
      // Flee from the player's car or a recent punch.
      let threat = null;
      if (player.inCar && Math.abs(player.inCar.speed) > 100 && dist(ped.x, ped.y, player.x, player.y) < 160) threat = player;
      if (ped.flee > 0) {
        ped.flee -= dt;
        threat = threat ?? player;
      }
      if (threat) {
        const away = angleTo(threat.x, threat.y, ped.x, ped.y);
        ped.angle = away;
        const next = city.resolveCircle(ped.x + Math.cos(away) * 150 * dt, ped.y + Math.sin(away) * 150 * dt, 10);
        ped.x = next.x;
        ped.y = next.y;
        continue;
      }
      if (!ped.target || dist(ped.x, ped.y, ped.target.x, ped.target.y) < 24) {
        ped.target = city.randomSidewalkPoint();
      }
      const target = angleTo(ped.x, ped.y, ped.target.x, ped.target.y);
      const diff = angleDiff(ped.angle, target);
      ped.angle += Math.max(-3 * dt, Math.min(3 * dt, diff));
      const next = city.resolveCircle(ped.x + Math.cos(ped.angle) * ped.speed * dt, ped.y + Math.sin(ped.angle) * ped.speed * dt, 10);
      ped.x = next.x;
      ped.y = next.y;
      ped.walkPhase += dt * 6;
    }
  }

  function stepCops(dt) {
    const want = stars();
    for (const cop of state.cops) {
      if (cop.down > 0) {
        cop.down -= dt;
        continue;
      }
      if (player.inCar) {
        // Foot cops cannot catch a car: they jog back toward the road.
        const road = city.nearestRoad(cop.x, cop.y);
        const target = angleTo(cop.x, cop.y, road.x, road.y);
        cop.angle = target;
        cop.x += Math.cos(target) * 120 * dt;
        cop.y += Math.sin(target) * 120 * dt;
        continue;
      }
      const d = dist(cop.x, cop.y, player.x, player.y);
      const target = angleTo(cop.x, cop.y, player.x, player.y);
      const diff = angleDiff(cop.angle, target);
      cop.angle += Math.max(-4 * dt, Math.min(4 * dt, diff));
      cop.x += Math.cos(cop.angle) * 200 * dt;
      cop.y += Math.sin(cop.angle) * 200 * dt;
      if (d < 30) {
        hurtPlayer(26 * dt);
        player.bustTimer += dt;
        if (player.bustTimer > 1.6) return EVENT_BUSTED;
      }
    }
    if (want >= 2 && state.cops.length < 2 && player.inCar === null) {
      const point = city.randomRoadPoint();
      if (dist(point.x, point.y, player.x, player.y) > 300) {
        state.cops.push({ x: point.x, y: point.y, angle: 0, health: 100, down: 0 });
      }
    }
    if (want === 0) {
      state.cops = [];
    }
    return 0;
  }

  function hurtPlayer(amount) {
    if (player.invulnerable > 0) return;
    player.health -= amount;
    player.invulnerable = 0.4;
    if (player.health <= 0) {
      state.wasted = true;
    }
  }

  function stepPoliceSpawning(dt) {
    const want = stars();
    const policeCars = state.cars.filter((car) => car.kind === 'police');
    const wantedCount = Math.min(POPULATION.policeMax, want === 0 ? 0 : want + 1);
    if (policeCars.length < wantedCount) {
      const point = city.randomRoadPoint();
      if (dist(point.x, point.y, player.x, player.y) > 350 && dist(point.x, point.y, player.x, player.y) < 900) {
        const car = makeCar(point.x, point.y, 0, 'police', PALETTE.police);
        car.speed = CAR.policeSpeed * 0.7;
        state.cars.push(car);
        state.chases += 1;
      }
    }
    // Wanted cools off when no police car can see the player.
    const nearestCop = policeCars.reduce((best, car) => Math.min(best, dist(car.x, car.y, player.x, player.y)), Infinity);
    if (want > 0 && nearestCop > 650) {
      state.wantedHeat = Math.max(0, state.wantedHeat - WANTED.coolRate * dt);
    }
    // Cops that lost the trail drive off and despawn.
    if (want === 0) {
      for (let i = state.cars.length - 1; i >= 0; i -= 1) {
        if (state.cars[i].kind === 'police' && dist(state.cars[i].x, state.cars[i].y, player.x, player.y) > 900) {
          state.cars.splice(i, 1);
        }
      }
    }
  }

  function stepCarCollisions(dt) {
    void dt;
    const cars = state.cars;
    for (let i = 0; i < cars.length; i += 1) {
      for (let j = i + 1; j < cars.length; j += 1) {
        const a = cars[i];
        const b = cars[j];
        const d = dist(a.x, a.y, b.x, b.y);
        if (d < 36 && d > 0.01) {
          const push = (36 - d) / 2;
          const nx = (b.x - a.x) / d;
          const ny = (b.y - a.y) / d;
          a.x -= nx * push;
          a.y -= ny * push;
          b.x += nx * push;
          b.y += ny * push;
          const impact = Math.abs(a.speed - b.speed);
          if (impact > 160) {
            spawnParticle((a.x + b.x) / 2, (a.y + b.y) / 2, '#ffd23e', 6, 180);
            if (a === player.inCar || b === player.inCar) {
              a.speed *= 0.6;
              b.speed *= 0.6;
              if (a.kind === 'police' || b.kind === 'police') addHeat(WANTED.ramCop);
              return EVENT_CRASH;
            }
            a.speed *= 0.7;
            b.speed *= 0.7;
          }
        }
      }
    }
    return 0;
  }

  function stepPickups(dt) {
    for (const pickup of state.pickups) {
      pickup.bob += dt * 3;
      if (pickup.taken > 0) {
        pickup.taken -= dt;
        if (pickup.taken <= 0) {
          const point = city.randomSidewalkPoint();
          pickup.x = point.x;
          pickup.y = point.y;
        }
        continue;
      }
      if (dist(player.x, player.y, pickup.x, pickup.y) < 34) {
        pickup.taken = 60;
        state.cash += ECONOMY.pickupValue;
        spawnParticle(pickup.x, pickup.y, PALETTE.gold, 10, 160);
        return EVENT_PICKUP;
      }
    }
    return 0;
  }

  function stepParticles(dt) {
    for (let i = state.particles.length - 1; i >= 0; i -= 1) {
      const particle = state.particles[i];
      particle.life -= dt;
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.vx *= 0.9;
      particle.vy *= 0.9;
      if (particle.life <= 0) state.particles.splice(i, 1);
    }
  }

  /** Steal or enter the nearest car, or step out of the one being driven. */
  function enterExitCar() {
    if (player.inCar) {
      const car = player.inCar;
      car.driver = null;
      car.kind = 'parked';
      car.speed = 0;
      player.inCar = null;
      const side = city.resolveCircle(player.x - Math.sin(player.angle) * 34, player.y + Math.cos(player.angle) * 34, PLAYER.radius);
      player.x = side.x;
      player.y = side.y;
      return 0;
    }
    let best = null;
    let bestDist = 78;
    for (const car of state.cars) {
      const d = dist(player.x, player.y, car.x, car.y);
      if (d < bestDist) {
        bestDist = d;
        best = car;
      }
    }
    if (!best) return 0;
    if (best.kind === 'police') return 0;
    const wasParked = best.kind === 'parked';
    const wasTraffic = best.kind === 'traffic';
    best.kind = 'player';
    best.driver = 'player';
    player.inCar = best;
    player.x = best.x;
    player.y = best.y;
    if (wasParked || wasTraffic) {
      state.carsStolen += 1;
      // A stolen car gets Rico's signature hot-pink respray: it is unmistakably yours.
      best.color = PALETTE.player;
      addHeat(WANTED.stealCar);
      return EVENT_STEAL;
    }
    return 0;
  }

  function resetAfterBustOrWaste() {
    const fine = Math.min(state.cash, ECONOMY.bustFine);
    state.cash -= fine;
    player.health = PLAYER.health;
    player.x = PLACES.hospital.x;
    player.y = PLACES.hospital.y;
    player.angle = -Math.PI / 2;
    player.bustTimer = 0;
    player.invulnerable = 2;
    if (player.inCar) {
      player.inCar.driver = null;
      player.inCar.kind = 'parked';
      player.inCar.speed = 0;
      player.inCar = null;
    }
    state.wantedHeat = 0;
    state.cops = [];
    state.cars = state.cars.filter((car) => car.kind !== 'police');
    state.busted = false;
    state.wasted = false;
  }

  function reset() {
    state.cars = [];
    state.peds = [];
    state.cops = [];
    state.pickups = [];
    state.particles = [];
    state.cash = 0;
    state.wantedHeat = 0;
    state.time = 0;
    state.busted = false;
    state.wasted = false;
    state.carsStolen = 0;
    state.pedsDown = 0;
    state.chases = 0;
    player.x = PLACES.start.x;
    player.y = PLACES.start.y;
    player.angle = -Math.PI / 2;
    player.health = PLAYER.health;
    player.inCar = null;
    player.punchTimer = 0;
    player.bustTimer = 0;
    player.invulnerable = 0;
    spawnTraffic();
    spawnPeds();
    spawnPickups();
  }

  function step(dt, input, actions) {
    let events = 0;
    state.time += dt;
    if (player.health < PLAYER.health) player.health = Math.min(PLAYER.health, player.health + 1.2 * dt);
    if (actions && (actions & 4)) events |= enterExitCar();
    const punchPressed = Boolean(actions && (actions & 8));
    if (player.inCar) stepPlayerInCar(player.inCar, input, dt);
    else events |= stepPlayerOnFoot(input.axis(), dt, punchPressed);
    for (const car of state.cars) {
      if (car.kind === 'traffic') stepTraffic(car, dt);
      else if (car.kind === 'police') stepPolice(car, dt);
    }
    events |= stepCops(dt);
    if (events & EVENT_BUSTED) resetAfterBustOrWaste();
    stepPeds(dt);
    events |= stepCarCollisions(dt);
    events |= stepPickups(dt);
    stepPoliceSpawning(dt);
    stepParticles(dt);
    if (player.bustTimer > 0 && state.cops.every((cop) => dist(cop.x, cop.y, player.x, player.y) > 60)) {
      player.bustTimer = Math.max(0, player.bustTimer - dt * 2);
    }
    if (state.wasted) {
      resetAfterBustOrWaste();
      events |= EVENT_WASTED;
    }
    return events;
  }

  reset();
  return {
    state, stars, addHeat, enterExitCar, reset,
    step,
    get playerCar() {
      return player.inCar;
    },
  };
}
