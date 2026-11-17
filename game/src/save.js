// Saving and loading: cash, story progress, the player's place in the city and health,
// kept in localStorage so a run survives closing the tab. Nothing here touches the
// network; a browser with storage off simply starts fresh each visit.

import { SAVE_KEY } from './config.js';

export function saveGame(entities, missions) {
  try {
    const player = entities.state.player;
    const data = {
      version: 1,
      cash: entities.state.cash,
      missionIndex: missions.state.index,
      missionStage: missions.state.stage,
      storyComplete: missions.state.storyComplete,
      carsStolen: entities.state.carsStolen,
      x: Math.round(player.x),
      y: Math.round(player.y),
      health: Math.round(player.health),
      savedAt: Date.now(),
    };
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function loadGame() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || data.version !== 1) return null;
    return data;
  } catch {
    return null;
  }
}

export function applySave(entities, missions, data) {
  if (!data) return;
  entities.state.cash = data.cash || 0;
  entities.state.carsStolen = data.carsStolen || 0;
  missions.state.index = Math.min(data.missionIndex || 0, 2);
  missions.state.stage = data.missionStage || 0;
  missions.state.storyComplete = Boolean(data.storyComplete);
  missions.state.active = !missions.state.storyComplete;
  const player = entities.state.player;
  player.x = data.x;
  player.y = data.y;
  player.health = data.health ?? 100;
  player.inCar = null;
}

/** True when a save exists to continue from. */
export function hasSave() {
  return loadGame() !== null;
}
