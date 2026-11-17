// The story of Neon Bay Heist: three missions, each with a chain of objectives that
// point at a place on the map. Missions unlock in order; between them the player is
// free to roam, grab cash bags and cause trouble. Completing a mission pays cash and
// advances the story; finishing all three closes the story and opens free roam for good.

import { ECONOMY, WANTED } from './config.js';
import { PLACES } from './city.js';

export const EVENT_MISSION_STAGE = 1;
export const EVENT_MISSION_DONE = 2;

export const MISSIONS = [
  {
    id: 'hot-wheels',
    title: 'Mission 1 — Hot Wheels',
    intro: 'Rico needs wheels. Steal any car and bring it to the Chop Shop.',
    stages: [
      { text: 'Steal a car (press E next to one)', target: null, check: 'steal' },
      { text: 'Drive to the Chop Shop', target: PLACES.garage, check: 'reach' },
    ],
  },
  {
    id: 'marina-drop',
    title: 'Mission 2 — The Marina Drop',
    intro: 'A package is waiting at the Marina. Pick it up, then deliver it to Neon Signs.',
    stages: [
      { text: 'Pick up the package at the Marina', target: PLACES.marina, check: 'reach' },
      { text: 'Deliver the package to Neon Signs', target: PLACES.neonShop, check: 'reach', heat: WANTED.stealCar },
    ],
  },
  {
    id: 'neon-vault',
    title: 'Mission 3 — The Neon Vault',
    intro: 'The big one: crack the Neon Bay Bank vault, then lose the cops and reach the Hideout.',
    stages: [
      { text: 'Reach the Neon Bay Bank', target: PLACES.bank, check: 'reach' },
      { text: 'Grab the vault cash (press E at the vault)', target: PLACES.bank, check: 'grab' },
      { text: 'Escape to the Hideout — the whole Bay PD is coming', target: PLACES.hideout, check: 'reach', heat: 260 },
    ],
  },
];

const REACH_RADIUS = 90;

export function createMissions(entities) {
  const state = {
    index: 0,
    stage: 0,
    done: false,
    storyComplete: false,
    active: true,
    toast: '',
    toastTimer: 0,
  };

  function current() {
    return MISSIONS[state.index] ?? null;
  }

  function currentStage() {
    const mission = current();
    return mission ? mission.stages[state.stage] : null;
  }

  /** The place the HUD arrow and minimap should point at, or null. */
  function target() {
    if (!state.active || state.storyComplete) return null;
    const stage = currentStage();
    return stage ? stage.target : null;
  }

  function objectiveText() {
    if (state.storyComplete) return 'Story complete — Neon Bay is yours. Grab cash bags, steal cars, stay free.';
    if (!state.active) return '';
    const mission = current();
    const stage = currentStage();
    if (!mission || !stage) return '';
    return `${mission.title}: ${stage.text}`;
  }

  function showToast(text, seconds) {
    state.toast = text;
    state.toastTimer = seconds;
  }

  function advance() {
    const mission = current();
    const stage = currentStage();
    if (stage && stage.heat) entities.addHeat(stage.heat);
    state.stage += 1;
    if (state.stage >= mission.stages.length) {
      const reward = ECONOMY.missionReward[state.index];
      entities.state.cash += reward;
      showToast(`${mission.title} complete! +$${reward}`, 4);
      state.index += 1;
      state.stage = 0;
      if (state.index >= MISSIONS.length) {
        state.storyComplete = true;
        state.active = false;
        showToast('STORY COMPLETE — Neon Bay is yours!', 6);
      } else {
        const next = MISSIONS[state.index];
        showToast(`${next.title}: ${next.intro}`, 5);
      }
      return EVENT_MISSION_DONE;
    }
    showToast(currentStage().text, 3);
    return EVENT_MISSION_STAGE;
  }

  function step(dt, actions) {
    let events = 0;
    if (state.toastTimer > 0) state.toastTimer -= dt;
    if (!state.active || state.storyComplete) return events;
    const stage = currentStage();
    if (!stage) return events;
    const player = entities.state.player;
    if (stage.check === 'steal') {
      if (entities.state.carsStolen > 0) events |= advance();
    } else if (stage.check === 'reach') {
      const targetPlace = stage.target;
      if (Math.hypot(player.x - targetPlace.x, player.y - targetPlace.y) < REACH_RADIUS) {
        events |= advance();
      }
    } else if (stage.check === 'grab') {
      const targetPlace = stage.target;
      const near = Math.hypot(player.x - targetPlace.x, player.y - targetPlace.y) < REACH_RADIUS;
      if (near && actions && (actions & 4)) events |= advance();
    }
    return events;
  }

  function start() {
    const mission = MISSIONS[0];
    showToast(`${mission.title}: ${mission.intro}`, 5);
  }

  return {
    state, current, currentStage, target, objectiveText, start, step,
    get toast() {
      return state.toastTimer > 0 ? state.toast : '';
    },
  };
}
