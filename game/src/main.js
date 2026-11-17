// Boot and the one loop: input is read every frame, the world advances in fixed 1/60 s
// steps (several in a slow frame, none in a fast one), and the renderer paints what is
// there. The game moves between five screens: title, play, paused, busted and wasted.
// Progress saves to localStorage on pause, on every mission and every few seconds.
//
// ?seed=N fixes the city and the traffic. ?shot=cover|chase|mission|start (with
// &seed=N) stages that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.
import { BEST_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import { createCity } from './city.js';
import { createEntities, EVENT_BUSTED, EVENT_CRASH, EVENT_PICKUP, EVENT_PUNCH, EVENT_STEAL, EVENT_WASTED } from './entities.js';
import { createMissions, EVENT_MISSION_DONE, EVENT_MISSION_STAGE } from './missions.js';
import { ACTION_CONFIRM, ACTION_ENTER, ACTION_MUTE, ACTION_PAUSE, ACTION_PUNCH, createInput } from './input.js';
import { createAudio } from './audio.js';
import { applySave, hasSave, loadGame, saveGame } from './save.js';
import { createRenderer, SCREEN_BUSTED, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WASTED } from './render.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;
/** Seconds between automatic saves while playing. */
const AUTOSAVE_SECONDS = 5;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const random = createRandom(seed);
const city = createCity(random);
const entities = createEntities(city, random);
const missions = createMissions(entities);
const renderer = createRenderer(canvas, city);
const audio = createAudio();

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best haul then lasts this visit only.
  }
}

function buildUi() {
  const state = entities.state;
  const player = state.player;
  const target = missions.target();
  let targetArrow = null;
  if (target) {
    const dx = target.x - player.x;
    const dy = target.y - player.y;
    const distance = Math.hypot(dx, dy);
    // The camera shows 1280x720 around the player: off-screen means beyond that.
    if (Math.abs(dx) > 560 || Math.abs(dy) > 300) {
      targetArrow = { angle: Math.atan2(dy, dx), distance };
    }
  }
  return {
    cash: state.cash,
    health: Math.max(0, Math.ceil(player.health)),
    stars: entities.stars(),
    objective: missions.objectiveText(),
    toast: missions.toast,
    speed: player.inCar ? player.inCar.speed : 0,
    driving: Boolean(player.inCar),
    target,
    targetArrow,
    muted: audio.muted,
    best: readBest(),
    hasSave: hasSave(),
  };
}

function runShot(name) {
  const game = { entities, missions, city };
  const scene = stageShot(name, game);
  let painted = 0;
  function paint() {
    renderer.draw(entities.state, scene.screen, buildUi());
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();
  let autosaveTimer = AUTOSAVE_SECONDS;
  let newGameKey = false;

  window.addEventListener('keydown', (event) => {
    if (event.code === 'KeyN' && !event.repeat) newGameKey = true;
  });

  // Screen readers (and anyone watching the page's text) hear the screen changes.
  function announce(message) {
    status.textContent = message;
  }

  function noteBest() {
    if (entities.state.cash > best) {
      best = entities.state.cash;
      saveBest(best);
    }
  }

  function persist() {
    noteBest();
    saveGame(entities, missions);
  }

  function startNewGame() {
    entities.reset();
    missions.state.index = 0;
    missions.state.stage = 0;
    missions.state.storyComplete = false;
    missions.state.active = true;
    missions.start();
    accumulator = 0;
    screen = SCREEN_PLAY;
    announce('New game. Mission 1: Hot Wheels. Steal a car.');
  }

  function continueGame() {
    const saved = loadGame();
    entities.reset();
    missions.state.index = 0;
    missions.state.stage = 0;
    missions.state.storyComplete = false;
    missions.state.active = true;
    if (saved) {
      applySave(entities, missions, saved);
      missions.start();
    } else {
      missions.start();
    }
    accumulator = 0;
    screen = SCREEN_PLAY;
    announce(saved ? 'Continuing your story.' : 'New game. Mission 1: Hot Wheels. Steal a car.');
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_MUTE) {
      const muted = audio.toggleMute();
      announce(muted ? 'Muted.' : 'Sound on.');
    }
    if (screen === SCREEN_TITLE) {
      if (newGameKey) {
        newGameKey = false;
        audio.unlock();
        audio.click();
        startNewGame();
        return 0;
      }
      if (actions & ACTION_CONFIRM) {
        audio.unlock();
        audio.click();
        if (hasSave()) continueGame();
        else startNewGame();
        return 0;
      }
      newGameKey = false;
      return 0;
    }
    if (screen === SCREEN_BUSTED || screen === SCREEN_WASTED) {
      if (actions & ACTION_CONFIRM) {
        audio.click();
        screen = SCREEN_PLAY;
        announce('Back on the streets of Neon Bay.');
      }
      return 0;
    }
    if (actions & ACTION_PAUSE && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      persist();
      announce('Paused. Progress saved.');
      return 0;
    }
    if (actions & (ACTION_PAUSE | ACTION_CONFIRM) && screen === SCREEN_PAUSED) {
      screen = SCREEN_PLAY;
      announce('Playing.');
      return 0;
    }
    if (screen === SCREEN_PLAY) {
      audio.unlock();
      return actions & (ACTION_ENTER | ACTION_PUNCH);
    }
    return 0;
  }

  function step(actions) {
    const events = entities.step(STEP, input, actions);
    const missionEvents = missions.step(STEP, actions);
    if (events & EVENT_PUNCH) audio.punch();
    if (events & EVENT_CRASH) audio.crash();
    if (events & EVENT_PICKUP) audio.pickup();
    if (events & EVENT_STEAL) audio.door();
    if (missionEvents & EVENT_MISSION_STAGE) audio.click();
    if (missionEvents & EVENT_MISSION_DONE) {
      audio.missionDone();
      persist();
    }
    if (events & EVENT_BUSTED) {
      audio.busted();
      screen = SCREEN_BUSTED;
      persist();
      announce('Busted. The Bay PD caught you.');
    } else if (events & EVENT_WASTED) {
      audio.busted();
      screen = SCREEN_WASTED;
      persist();
      announce('Wasted. You woke up at Bay General.');
    }
    audio.setEngine(entities.state.player.inCar ? entities.state.player.inCar.speed : 0, Boolean(entities.state.player.inCar));
    audio.setSiren(entities.stars());
    autosaveTimer -= STEP;
    if (autosaveTimer <= 0) {
      autosaveTimer = AUTOSAVE_SECONDS;
      persist();
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    const actions = handleActions();
    if (screen === SCREEN_PLAY) {
      while (accumulator >= STEP && screen === SCREEN_PLAY) {
        step(actions);
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(entities.state, screen, buildUi());
  }

  // Leaving the tab pauses a running game rather than letting the cops close in unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      persist();
      announce('Paused.');
    }
  });

  announce('Neon Bay Heist. Press Space or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
