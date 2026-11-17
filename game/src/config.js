// Neon Bay Heist — every tuning number, colour and city constant in one place.
// The world is a fixed 3200 x 2400 top-down city; the renderer scales the camera view
// to the window, so no rule below depends on the screen size.

export const WORLD = { width: 3200, height: 2400 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

/** Roads run on a grid; each entry is the centre line of a road. */
export const ROADS_X = [400, 1000, 1600, 2200, 2800];
export const ROADS_Y = [400, 900, 1400, 1900];
export const ROAD_WIDTH = 120;
export const LANE = 30;

export const PLAYER = {
  radius: 14,
  walkSpeed: 230,
  runSpeed: 330,
  health: 100,
  punchRange: 34,
  punchDamage: 34,
  punchCooldown: 0.45,
};

export const CAR = {
  length: 54,
  width: 26,
  accel: 420,
  brake: 700,
  reverseAccel: 260,
  maxSpeed: 560,
  maxReverse: 180,
  steer: 2.6,
  drag: 0.55,
  trafficSpeed: 170,
  policeSpeed: 620,
};

export const WANTED = {
  /** Heat added by each crime; 100 heat is one star. */
  stealCar: 55,
  hitPed: 45,
  punchCop: 80,
  ramCop: 90,
  /** Heat lost per second while no cop can see the player. */
  coolRate: 2.2,
  /** Stars the police stop chasing at when the player hides. */
  maxStars: 5,
};

/** Cash rewards and pickups. */
export const ECONOMY = {
  pickupValue: 50,
  missionReward: [400, 700, 1500],
  bustFine: 150,
};

/** How many of each thing the city holds. */
export const POPULATION = { traffic: 14, parked: 10, peds: 26, policeMax: 6, pickups: 12 };

export const PALETTE = {
  backdrop: '#1a1030',
  grass: '#7fae5a',
  parkGrass: '#6da34e',
  sand: '#c9b489',
  asphalt: '#3a3a46',
  asphaltDark: '#33333e',
  roadLine: '#e8d44d',
  sidewalk: '#9a938a',
  water: '#2e7fa8',
  waterDeep: '#256b8f',
  building: ['#b5654a', '#c98a4b', '#7a6ba8', '#4a7a8c', '#a84a6b', '#5a8c6a', '#8c7a4a', '#6b5a8c'],
  roof: '#4a4450',
  neon: ['#ff2e88', '#00e5ff', '#ffe600', '#7cff00', '#ff7a00'],
  player: '#ff2e88',
  playerJacket: '#ff2e88',
  police: '#1e4fd8',
  policeLight: '#ff2e2e',
  hudPanel: 'rgba(12, 10, 28, 0.72)',
  text: '#f5f0ff',
  muted: '#b9b3cc',
  gold: '#ffd23e',
  star: '#ffd23e',
  danger: '#ff3b3b',
  objective: '#ffe600',
};

/** System font stack: no webfont is ever fetched, the game loads nothing over the network. */
export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the save lives between visits (this browser only). */
export const SAVE_KEY = 'neon-bay-heist.save.v1';
export const BEST_KEY = 'neon-bay-heist.best.v1';
