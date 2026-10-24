export type TeamSide = 'left' | 'right';

export type CameraPreset = 'broadcast' | 'pro_behind' | 'sky';

export type PlayDifficulty = 'rookie' | 'pro' | 'champion';

export interface NationTeam {
  code: string;
  country: string;
  playerName: string;
  jerseyNumber: string;
  styleTag: string;
  specialty: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  skinTone: string;
  stats: {
    moveSpeed: number; // units/sec
    jumpSpeed: number; // vertical impulse
    spikePower: number; // ball speed on spike
    reachRadius: number; // hit cylinder/sphere tolerance
    diveSpeed: number;
    speedRating: number;
    jumpRating: number;
    powerRating: number;
  };
}

export const INTERNATIONAL_TEAMS: NationTeam[] = [
  {
    code: 'IND',
    country: 'India',
    playerName: 'Aarav Verma',
    jerseyNumber: '07',
    styleTag: 'All-Round Captain',
    specialty: 'Balanced Spike Power · Fast Surge Gain',
    primaryColor: '#1D4ED8',
    secondaryColor: '#0F172A',
    accentColor: '#F59E0B',
    skinTone: '#D99B66',
    stats: {
      moveSpeed: 7.4,
      jumpSpeed: 9.4,
      spikePower: 16.8,
      reachRadius: 1.55,
      diveSpeed: 12.2,
      speedRating: 88,
      jumpRating: 88,
      powerRating: 92,
    },
  },
  {
    code: 'BRA',
    country: 'Brazil',
    playerName: 'Lucas Silva',
    jerseyNumber: '10',
    styleTag: 'Power Spiker',
    specialty: 'Heavy Topspin Smash · High Elevation',
    primaryColor: '#EAB308',
    secondaryColor: '#1E3A8A',
    accentColor: '#16A34A',
    skinTone: '#C68642',
    stats: {
      moveSpeed: 7.2,
      jumpSpeed: 9.7,
      spikePower: 17.6,
      reachRadius: 1.52,
      diveSpeed: 11.8,
      speedRating: 85,
      jumpRating: 93,
      powerRating: 97,
    },
  },
  {
    code: 'JPN',
    country: 'Japan',
    playerName: 'Ren Takahashi',
    jerseyNumber: '14',
    styleTag: 'Lightning Specialist',
    specialty: 'Fastest Court Sprint · Extended Dive Reach',
    primaryColor: '#DC2626',
    secondaryColor: '#111827',
    accentColor: '#F8FAFC',
    skinTone: '#F1C27D',
    stats: {
      moveSpeed: 8.3,
      jumpSpeed: 9.3,
      spikePower: 15.9,
      reachRadius: 1.62,
      diveSpeed: 13.8,
      speedRating: 98,
      jumpRating: 87,
      powerRating: 84,
    },
  },
  {
    code: 'USA',
    country: 'United States',
    playerName: 'Marcus Cole',
    jerseyNumber: '09',
    styleTag: 'Net Blocker',
    specialty: 'Towering Net Reach · Thunderous Block',
    primaryColor: '#1E293B',
    secondaryColor: '#991B1B',
    accentColor: '#F8FAFC',
    skinTone: '#8D5524',
    stats: {
      moveSpeed: 7.0,
      jumpSpeed: 9.9,
      spikePower: 17.1,
      reachRadius: 1.68,
      diveSpeed: 11.4,
      speedRating: 82,
      jumpRating: 97,
      powerRating: 91,
    },
  },
  {
    code: 'POL',
    country: 'Poland',
    playerName: 'Jakub Kowalski',
    jerseyNumber: '08',
    styleTag: 'Perimeter Cannon',
    specialty: 'Deep Line Drives · High Block Wall',
    primaryColor: '#F8FAFC',
    secondaryColor: '#B91C1C',
    accentColor: '#DC2626',
    skinTone: '#F3CFA4',
    stats: {
      moveSpeed: 7.1,
      jumpSpeed: 9.6,
      spikePower: 17.4,
      reachRadius: 1.6,
      diveSpeed: 11.6,
      speedRating: 84,
      jumpRating: 92,
      powerRating: 95,
    },
  },
  {
    code: 'FRA',
    country: 'France',
    playerName: 'Theo Laurent',
    jerseyNumber: '11',
    styleTag: 'Tactical Setter',
    specialty: 'Pinpoint Angles · Agile Counter Dives',
    primaryColor: '#1E40AF',
    secondaryColor: '#F8FAFC',
    accentColor: '#EF4444',
    skinTone: '#E0AC69',
    stats: {
      moveSpeed: 7.9,
      jumpSpeed: 9.2,
      spikePower: 16.3,
      reachRadius: 1.6,
      diveSpeed: 13.1,
      speedRating: 93,
      jumpRating: 86,
      powerRating: 87,
    },
  },
  {
    code: 'ITA',
    country: 'Italy',
    playerName: 'Matteo Conti',
    jerseyNumber: '05',
    styleTag: 'Counter Striker',
    specialty: 'Sharp Cross Angles · Composed Defense',
    primaryColor: '#0284C7',
    secondaryColor: '#0F172A',
    accentColor: '#F8FAFC',
    skinTone: '#E5B887',
    stats: {
      moveSpeed: 7.6,
      jumpSpeed: 9.4,
      spikePower: 16.7,
      reachRadius: 1.58,
      diveSpeed: 12.6,
      speedRating: 90,
      jumpRating: 89,
      powerRating: 90,
    },
  },
  {
    code: 'AUS',
    country: 'Australia',
    playerName: 'Liam Cooper',
    jerseyNumber: '12',
    styleTag: 'Beach Ace',
    specialty: 'Sand Dive Recovery · High Loft Control',
    primaryColor: '#047857',
    secondaryColor: '#CA8A04',
    accentColor: '#FACC15',
    skinTone: '#DFAA78',
    stats: {
      moveSpeed: 7.7,
      jumpSpeed: 9.5,
      spikePower: 16.6,
      reachRadius: 1.57,
      diveSpeed: 12.9,
      speedRating: 91,
      jumpRating: 90,
      powerRating: 89,
    },
  },
];

export function getNationByCode(code: string): NationTeam {
  return INTERNATIONAL_TEAMS.find((t) => t.code === code) || INTERNATIONAL_TEAMS[0];
}

// 3D Court Constants (meters / Three.js world units)
export const COURT_HALF_X = 9.0; // Total length 18m (-9 to +9), Net at X = 0
export const COURT_HALF_Z = 4.5; // Total width 9m (-4.5 to +4.5)
export const NET_HEIGHT = 2.35;
export const BALL_RADIUS = 0.36;
export const GRAVITY = 21.5;
export const PLAYER_RADIUS = 0.55;

export interface PlayerInputState {
  moveX: number; // -1 to 1 (world X)
  moveZ: number; // -1 to 1 (world Z)
  actionPressed: boolean; // Jump / Spike / Serve
  divePressed: boolean; // Sand dive lunge
}

export interface PlayerSimState {
  side: TeamSide;
  nationCode: string;
  callsign: string;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  diveTimer: number; // > 0 while diving
  swingTimer: number; // > 0 arm swing animation
  hitCooldown: number;
  surge: number; // 0 to 100
  facingYaw: number;
}

export interface BallSimState {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  spinX: number;
  spinZ: number;
  isSurgeShot: boolean;
  lastTouchSide: TeamSide | null;
  landingX: number;
  landingZ: number;
}

export type SoundTrigger =
  | 'bump'
  | 'spike'
  | 'surge'
  | 'jump'
  | 'dive'
  | 'net'
  | 'point_left'
  | 'point_right'
  | 'match_win';

export interface SimMatchState {
  phase: 'serve_wait' | 'rally' | 'point_pause' | 'finished';
  phaseTimer: number;
  targetPoints: number;
  servingSide: TeamSide;
  leftScore: number;
  rightScore: number;
  leftTouches: number;
  rightTouches: number;
  rallyHits: number;
  longestRally: number;
  leftSpikesScored: number;
  rightSpikesScored: number;
  leftBlocksScored: number;
  rightBlocksScored: number;
  leftTotalBlocks: number;
  rightTotalBlocks: number;
  leftSurgeStrikes: number;
  rightSurgeStrikes: number;
  lastHitWasSpike: boolean;
  lastHitWasBlock: boolean;
  callout: string;
  winnerSide: TeamSide | null;
  leftPlayer: PlayerSimState;
  rightPlayer: PlayerSimState;
  ball: BallSimState;
}

export function computeBallLanding(ball: {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
}): { x: number; z: number } {
  const h = Math.max(0, ball.y - BALL_RADIUS);
  const disc = ball.vy * ball.vy + 2 * GRAVITY * h;
  if (disc < 0) return { x: ball.x, z: ball.z };
  const t = (ball.vy + Math.sqrt(disc)) / GRAVITY;
  const clampedT = Math.min(Math.max(t, 0), 3.5);
  return {
    x: ball.x + ball.vx * clampedT,
    z: ball.z + ball.vz * clampedT,
  };
}

export interface ScenarioStartOverrides {
  leftScore?: number;
  rightScore?: number;
  servingSide?: TeamSide;
  leftInitialSurge?: number;
  callout?: string;
}

export function createInitialSimState(
  leftNation: string,
  leftCallsign: string,
  rightNation: string,
  rightCallsign: string,
  targetPoints = 11,
  overrides?: ScenarioStartOverrides,
): SimMatchState {
  const startServer = overrides?.servingSide ?? 'left';
  const state: SimMatchState = {
    phase: 'serve_wait',
    phaseTimer: 0.6,
    targetPoints,
    servingSide: startServer,
    leftScore: overrides?.leftScore ?? 0,
    rightScore: overrides?.rightScore ?? 0,
    leftTouches: 0,
    rightTouches: 0,
    rallyHits: 0,
    longestRally: 0,
    leftSpikesScored: 0,
    rightSpikesScored: 0,
    leftBlocksScored: 0,
    rightBlocksScored: 0,
    leftTotalBlocks: 0,
    rightTotalBlocks: 0,
    leftSurgeStrikes: 0,
    rightSurgeStrikes: 0,
    lastHitWasSpike: false,
    lastHitWasBlock: false,
    callout: overrides?.callout ?? 'Serve Ready',
    winnerSide: null,
    leftPlayer: {
      side: 'left',
      nationCode: leftNation,
      callsign: leftCallsign,
      x: -5.8,
      y: 0,
      z: 0,
      vx: 0,
      vy: 0,
      vz: 0,
      diveTimer: 0,
      swingTimer: 0,
      hitCooldown: 0,
      surge: overrides?.leftInitialSurge ?? 25,
      facingYaw: Math.PI / 2,
    },
    rightPlayer: {
      side: 'right',
      nationCode: rightNation,
      callsign: rightCallsign,
      x: 5.2,
      y: 0,
      z: 0,
      vx: 0,
      vy: 0,
      vz: 0,
      diveTimer: 0,
      swingTimer: 0,
      hitCooldown: 0,
      surge: 25,
      facingYaw: -Math.PI / 2,
    },
    ball: {
      x: -5.1,
      y: 2.1,
      z: 0,
      vx: 0,
      vy: 0,
      vz: 0,
      spinX: 0,
      spinZ: 0,
      isSurgeShot: false,
      lastTouchSide: null,
      landingX: -5.1,
      landingZ: 0,
    },
  };
  resetPositionsForServe(state, startServer);
  if (overrides?.callout) {
    state.callout = overrides.callout;
  }
  return state;
}

export function resetPositionsForServe(state: SimMatchState, servingSide: TeamSide): void {
  state.phase = 'serve_wait';
  state.phaseTimer = 0.35;
  state.servingSide = servingSide;
  state.leftTouches = 0;
  state.rightTouches = 0;
  state.rallyHits = 0;
  state.lastHitWasSpike = false;
  state.lastHitWasBlock = false;

  state.leftPlayer.x = servingSide === 'left' ? -6.2 : -4.8;
  state.leftPlayer.y = 0;
  state.leftPlayer.z = 0;
  state.leftPlayer.vx = 0;
  state.leftPlayer.vy = 0;
  state.leftPlayer.vz = 0;
  state.leftPlayer.diveTimer = 0;
  state.leftPlayer.facingYaw = Math.PI / 2;

  state.rightPlayer.x = servingSide === 'right' ? 6.2 : 4.8;
  state.rightPlayer.y = 0;
  state.rightPlayer.z = 0;
  state.rightPlayer.vx = 0;
  state.rightPlayer.vy = 0;
  state.rightPlayer.vz = 0;
  state.rightPlayer.diveTimer = 0;
  state.rightPlayer.facingYaw = -Math.PI / 2;

  const server = servingSide === 'left' ? state.leftPlayer : state.rightPlayer;
  const offset = servingSide === 'left' ? 0.65 : -0.65;
  state.ball.x = server.x + offset;
  state.ball.y = 2.05;
  state.ball.z = server.z;
  state.ball.vx = 0;
  state.ball.vy = 0;
  state.ball.vz = 0;
  state.ball.isSurgeShot = false;
  state.ball.lastTouchSide = null;
  state.ball.landingX = state.ball.x;
  state.ball.landingZ = state.ball.z;
}

export function computeAiInput(
  state: SimMatchState,
  side: TeamSide,
  difficulty: PlayDifficulty,
  clockSec: number,
): PlayerInputState {
  const me = side === 'left' ? state.leftPlayer : state.rightPlayer;
  const ball = state.ball;
  const input: PlayerInputState = {
    moveX: 0,
    moveZ: 0,
    actionPressed: false,
    divePressed: false,
  };

  if (state.phase === 'finished' || state.phase === 'point_pause') {
    return input;
  }

  // Serving AI
  if (state.phase === 'serve_wait') {
    if (state.servingSide === side && state.phaseTimer <= 0) {
      const targetZ = Math.sin(clockSec * 1.9) * 2.2;
      if (Math.abs(me.z - targetZ) > 0.35) {
        input.moveZ = targetZ > me.z ? 1 : -1;
      } else {
        input.actionPressed = true;
      }
    }
    return input;
  }

  const speedScale = difficulty === 'rookie' ? 0.72 : difficulty === 'pro' ? 0.92 : 1.0;
  const ballOnMySide = side === 'left' ? ball.landingX < 0.2 : ball.landingX > -0.2;
  const homeX = side === 'left' ? -4.4 : 4.4;

  let desiredX = homeX;
  let desiredZ = 0;

  if (ballOnMySide) {
    // Position slightly behind ball landing X so forward momentum aims across net
    const standOffset = side === 'left' ? -0.32 : 0.32;
    desiredX =
      side === 'left'
        ? Math.max(-COURT_HALF_X - 0.8, Math.min(-0.75, ball.landingX + standOffset))
        : Math.min(COURT_HALF_X + 0.8, Math.max(0.75, ball.landingX + standOffset));
    desiredZ = Math.max(-COURT_HALF_Z - 0.5, Math.min(COURT_HALF_Z + 0.5, ball.landingZ));
  } else {
    // Watch opponent net threat for blocking
    const opp = side === 'left' ? state.rightPlayer : state.leftPlayer;
    if (Math.abs(opp.x) < 2.4 && opp.y > 0.4 && difficulty !== 'rookie') {
      desiredX = side === 'left' ? -1.05 : 1.05;
      desiredZ = opp.z * 0.85;
    } else {
      desiredX = homeX;
      desiredZ = ball.z * 0.35;
    }
  }

  const dx = desiredX - me.x;
  const dz = desiredZ - me.z;
  if (Math.abs(dx) > 0.18) input.moveX = Math.max(-1, Math.min(1, dx * 2.4)) * speedScale;
  if (Math.abs(dz) > 0.18) input.moveZ = Math.max(-1, Math.min(1, dz * 2.4)) * speedScale;

  const distXZ = Math.hypot(ball.x - me.x, ball.z - me.z);

  // Jump to spike or block
  if (me.y <= 0.02) {
    const nearNetBall =
      (side === 'left' ? ball.x > -3.4 && ball.x < -0.2 : ball.x < 3.4 && ball.x > 0.2) &&
      ball.y > 2.15 &&
      ball.y < 3.9 &&
      distXZ < 1.65;

    const blockJump =
      difficulty !== 'rookie' &&
      Math.abs(ball.x) < 1.5 &&
      ball.y > 2.3 &&
      Math.abs(me.x) < 1.5 &&
      Math.abs(ball.z - me.z) < 1.2;

    if (nearNetBall || blockJump) {
      input.actionPressed = true;
    } else if (
      ballOnMySide &&
      ball.y < 1.45 &&
      ball.vy < -1.5 &&
      distXZ > 1.55 &&
      distXZ < 3.6 &&
      (difficulty === 'champion' || (difficulty === 'pro' && Math.sin(clockSec * 7) > -0.4))
    ) {
      input.divePressed = true;
    }
  } else {
    // Mid-air spike trigger!
    if (distXZ < 1.85 && Math.abs(ball.y - (me.y + 1.45)) < 1.35) {
      input.actionPressed = true;
      // Aim toward open corner
      const opp = side === 'left' ? state.rightPlayer : state.leftPlayer;
      input.moveZ = opp.z > 0 ? -0.9 : 0.9;
      input.moveX = side === 'left' ? 0.8 : -0.8;
    }
  }

  return input;
}

function awardPoint(state: SimMatchState, winner: TeamSide, reason: string, sounds: SoundTrigger[]): void {
  if (state.phase === 'point_pause' || state.phase === 'finished') return;

  if (winner === 'left') {
    state.leftScore += 1;
    if (state.lastHitWasSpike && state.ball.lastTouchSide === 'left') state.leftSpikesScored += 1;
    if (state.lastHitWasBlock && state.ball.lastTouchSide === 'left') state.leftBlocksScored += 1;
    sounds.push('point_left');
  } else {
    state.rightScore += 1;
    if (state.lastHitWasSpike && state.ball.lastTouchSide === 'right') state.rightSpikesScored += 1;
    if (state.lastHitWasBlock && state.ball.lastTouchSide === 'right') state.rightBlocksScored += 1;
    sounds.push('point_right');
  }

  const maxScore = Math.max(state.leftScore, state.rightScore);
  const diff = Math.abs(state.leftScore - state.rightScore);

  if (maxScore >= state.targetPoints && diff >= 2) {
    state.phase = 'finished';
    state.winnerSide = winner;
    state.callout = `${winner === 'left' ? state.leftPlayer.nationCode : state.rightPlayer.nationCode} Wins Match!`;
    sounds.push('match_win');
    return;
  }

  state.phase = 'point_pause';
  state.phaseTimer = 1.35;
  state.servingSide = winner;

  const isMatchPt =
    maxScore >= state.targetPoints - 1 &&
    diff >= 1 &&
    (state.leftScore >= state.targetPoints - 1 || state.rightScore >= state.targetPoints - 1);
  const isDeuce = state.leftScore >= state.targetPoints - 1 && state.leftScore === state.rightScore;

  if (isDeuce) {
    state.callout = `${reason} · Deuce ${state.leftScore}-${state.rightScore}`;
  } else if (isMatchPt) {
    state.callout = `${reason} · Match Point`;
  } else {
    state.callout = reason;
  }
}

function stepSinglePlayer(
  p: PlayerSimState,
  input: PlayerInputState,
  dt: number,
  state: SimMatchState,
  sounds: SoundTrigger[],
): void {
  const nation = getNationByCode(p.nationCode);
  if (p.hitCooldown > 0) p.hitCooldown = Math.max(0, p.hitCooldown - dt);
  if (p.swingTimer > 0) p.swingTimer = Math.max(0, p.swingTimer - dt);

  if (p.diveTimer > 0) {
    p.diveTimer = Math.max(0, p.diveTimer - dt);
    p.vx *= Math.pow(0.18, dt);
    p.vz *= Math.pow(0.18, dt);
  } else {
    const len = Math.hypot(input.moveX, input.moveZ);
    const nx = len > 1 ? input.moveX / len : input.moveX;
    const nz = len > 1 ? input.moveZ / len : input.moveZ;

    p.vx = nx * nation.stats.moveSpeed;
    p.vz = nz * nation.stats.moveSpeed;

    if (len > 0.15) {
      p.facingYaw = Math.atan2(nx, nz);
    } else {
      p.facingYaw = p.side === 'left' ? Math.PI / 2 : -Math.PI / 2;
    }

    // Trigger sand dive
    if (input.divePressed && p.y <= 0.03 && state.phase === 'rally') {
      let dx = nx;
      let dz = nz;
      if (Math.hypot(dx, dz) < 0.2) {
        // Dive toward ball automatically!
        const toBallX = state.ball.x - p.x;
        const toBallZ = state.ball.z - p.z;
        const d = Math.hypot(toBallX, toBallZ) || 1;
        dx = toBallX / d;
        dz = toBallZ / d;
      }
      p.vx = dx * nation.stats.diveSpeed;
      p.vz = dz * nation.stats.diveSpeed;
      p.vy = 2.6;
      p.diveTimer = 0.36;
      p.facingYaw = Math.atan2(dx, dz);
      sounds.push('dive');
    }

    // Jump when actionPressed on ground during rally
    if (input.actionPressed && p.y <= 0.02 && state.phase === 'rally') {
      // Only jump if ball is high OR player wants to block/spike; if ball is low & right on us, bump grounded
      const distXZ = Math.hypot(state.ball.x - p.x, state.ball.z - p.z);
      const lowBallRightHere = distXZ < nation.stats.reachRadius && state.ball.y < 2.25;
      if (!lowBallRightHere) {
        p.vy = nation.stats.jumpSpeed;
        p.swingTimer = 0.28;
        sounds.push('jump');
      }
    }
  }

  // Integrate player position
  p.x += p.vx * dt;
  p.z += p.vz * dt;
  p.y += p.vy * dt;

  if (p.y > 0) {
    p.vy -= GRAVITY * dt;
    if (p.y <= 0) {
      p.y = 0;
      p.vy = 0;
    }
  }

  // Constrain player to their half of the beach arena (allowing out-of-bounds saves!)
  if (p.side === 'left') {
    p.x = Math.max(-COURT_HALF_X - 2.2, Math.min(-PLAYER_RADIUS - 0.15, p.x));
  } else {
    p.x = Math.min(COURT_HALF_X + 2.2, Math.max(PLAYER_RADIUS + 0.15, p.x));
  }
  p.z = Math.max(-COURT_HALF_Z - 2.0, Math.min(COURT_HALF_Z + 2.0, p.z));
}

function tryPlayerBallContact(
  p: PlayerSimState,
  input: PlayerInputState,
  state: SimMatchState,
  sounds: SoundTrigger[],
): void {
  if (p.hitCooldown > 0) return;

  const nation = getNationByCode(p.nationCode);
  const ball = state.ball;

  // Player hit center is chest/hands (~1.35m above feet, higher when jumping)
  const hitCenterY = p.diveTimer > 0 ? p.y + 0.75 : p.y + 1.42;
  const dx = ball.x - p.x;
  const dy = ball.y - hitCenterY;
  const dz = ball.z - p.z;
  const dist = Math.hypot(dx, dy * 0.82, dz);

  const effectiveRadius = nation.stats.reachRadius + (p.diveTimer > 0 ? 0.38 : 0);
  if (dist > effectiveRadius) return;

  // Don't hit ball that is clearly on the other side of the net unless blocking right at the tape
  if (p.side === 'left' && ball.x > 0.32) return;
  if (p.side === 'right' && ball.x < -0.32) return;

  p.hitCooldown = 0.24;
  p.swingTimer = 0.32;

  // Track touches per side (3 touches max rule!)
  if (p.side === 'left') {
    state.leftTouches += 1;
    state.rightTouches = 0;
    if (state.leftTouches > 3) {
      awardPoint(state, 'right', '4 Touches Fault · Point Right', sounds);
      return;
    }
  } else {
    state.rightTouches += 1;
    state.leftTouches = 0;
    if (state.rightTouches > 3) {
      awardPoint(state, 'left', '4 Touches Fault · Point Left', sounds);
      return;
    }
  }

  state.rallyHits += 1;
  if (state.rallyHits > state.longestRally) {
    state.longestRally = state.rallyHits;
  }

  const forwardSign = p.side === 'left' ? 1 : -1;
  const isAirborne = p.y > 0.38 && p.diveTimer <= 0;
  const nearNet = Math.abs(p.x) < 2.45;

  // Check if this is a Net Block (opponent attacked/served across net & player jumped at net)
  if (
    isAirborne &&
    nearNet &&
    ball.lastTouchSide !== null &&
    ball.lastTouchSide !== p.side &&
    Math.abs(ball.vx) > 4.6
  ) {
    // Crisp block deflection!
    ball.vx = forwardSign * (7.2 + Math.random() * 2.0);
    ball.vy = 5.4;
    ball.vz = input.moveZ * 3.8 + (Math.random() - 0.5) * 1.5;
    ball.isSurgeShot = false;
    ball.lastTouchSide = p.side;
    state.lastHitWasBlock = true;
    state.lastHitWasSpike = false;
    if (p.side === 'left') state.leftTotalBlocks += 1;
    else state.rightTotalBlocks += 1;
    p.surge = Math.min(100, p.surge + 24);
    state.callout = `${p.nationCode} Monster Block!`;
    const landing = computeBallLanding(ball);
    ball.landingX = landing.x;
    ball.landingZ = landing.z;
    sounds.push('spike');
    return;
  }

  // Airborne Power Spike!
  if (isAirborne && (input.actionPressed || ball.y > 2.15)) {
    const useSurge = p.surge >= 100;
    const targetDepthX = p.side === 'left' ? 5.6 + input.moveX * 2.2 : -5.6 + input.moveX * 2.2;
    const targetZ = Math.max(-COURT_HALF_Z + 0.65, Math.min(COURT_HALF_Z - 0.65, input.moveZ * 3.6 + p.z * 0.25));

    const speed = nation.stats.spikePower * (useSurge ? 1.26 : 1.0);
    const flightTime = Math.max(0.38, Math.abs(targetDepthX - ball.x) / (speed * 0.86));

    ball.vx = (targetDepthX - ball.x) / flightTime;
    ball.vz = (targetZ - ball.z) / flightTime;
    // Guarantee clearance over the net (X = 0)
    const timeToNet = Math.abs(ball.x) / Math.max(3, Math.abs(ball.vx));
    const minVyForNet = (NET_HEIGHT + 0.52 - ball.y + 0.5 * GRAVITY * timeToNet * timeToNet) / Math.max(0.08, timeToNet);
    const desiredVy = (0.35 - ball.y + 0.5 * GRAVITY * flightTime * flightTime) / flightTime;
    ball.vy = Math.max(minVyForNet, desiredVy);

    ball.spinZ = -forwardSign * (useSurge ? 22 : 14);
    ball.isSurgeShot = useSurge;
    ball.lastTouchSide = p.side;
    state.lastHitWasSpike = true;
    state.lastHitWasBlock = false;

    if (useSurge) {
      p.surge = 0;
      if (p.side === 'left') state.leftSurgeStrikes += 1;
      else state.rightSurgeStrikes += 1;
      state.callout = `${p.nationCode} Meteor Surge Strike!`;
      sounds.push('surge');
    } else {
      p.surge = Math.min(100, p.surge + 18);
      state.callout = `${p.nationCode} Power Spike`;
      sounds.push('spike');
    }
  } else {
    // Grounded Bump / Set / Diving Save!
    const touchesNow = p.side === 'left' ? state.leftTouches : state.rightTouches;
    // If 1st touch and player isn't pressing strongly forward, loft a playable high set near the net OR send over!
    const wantsSelfSet =
      touchesNow === 1 &&
      p.diveTimer <= 0 &&
      ((p.side === 'left' && input.moveX < -0.25) || (p.side === 'right' && input.moveX > 0.25));

    if (wantsSelfSet) {
      const setTargetX = p.side === 'left' ? -1.9 : 1.9;
      const setTargetZ = Math.max(-3.2, Math.min(3.2, p.z + input.moveZ * 1.5));
      const flightT = 0.95;
      ball.vx = (setTargetX - ball.x) / flightT;
      ball.vz = (setTargetZ - ball.z) / flightT;
      ball.vy = 10.6;
      state.callout = `${p.nationCode} High Set`;
    } else {
      // Clean high arc across the net into opponent court!
      const targetX =
        p.side === 'left'
          ? 4.8 + Math.max(-1.6, Math.min(2.6, input.moveX * 2.2))
          : -4.8 + Math.max(-2.6, Math.min(1.6, input.moveX * 2.2));
      const targetZ = Math.max(-COURT_HALF_Z + 0.7, Math.min(COURT_HALF_Z - 0.7, p.z * 0.35 + input.moveZ * 3.1));
      const flightT = p.diveTimer > 0 ? 1.18 : 1.05;
      ball.vx = (targetX - ball.x) / flightT;
      ball.vz = (targetZ - ball.z) / flightT;
      ball.vy = (BALL_RADIUS - ball.y + 0.5 * GRAVITY * flightT * flightT) / flightT;
      state.callout = p.diveTimer > 0 ? `${p.nationCode} Diving Save!` : `${p.nationCode} Clean Reception`;
    }

    ball.spinZ = -forwardSign * 5;
    ball.isSurgeShot = false;
    ball.lastTouchSide = p.side;
    state.lastHitWasSpike = false;
    state.lastHitWasBlock = false;
    p.surge = Math.min(100, p.surge + (p.diveTimer > 0 ? 22 : 12));
    sounds.push('bump');
  }

  const landing = computeBallLanding(ball);
  ball.landingX = landing.x;
  ball.landingZ = landing.z;
}

export function stepMatchPhysics(
  state: SimMatchState,
  leftInput: PlayerInputState,
  rightInput: PlayerInputState,
  dt: number,
): SoundTrigger[] {
  const sounds: SoundTrigger[] = [];
  const clampedDt = Math.min(dt, 0.05);

  if (state.phase === 'finished') {
    return sounds;
  }

  if (state.phase === 'point_pause') {
    state.phaseTimer -= clampedDt;
    if (state.phaseTimer <= 0) {
      resetPositionsForServe(state, state.servingSide);
    }
    return sounds;
  }

  // Serve wait phase
  if (state.phase === 'serve_wait') {
    if (state.phaseTimer > 0) state.phaseTimer = Math.max(0, state.phaseTimer - clampedDt);

    const server = state.servingSide === 'left' ? state.leftPlayer : state.rightPlayer;
    const receiver = state.servingSide === 'left' ? state.rightPlayer : state.leftPlayer;
    const serverInput = state.servingSide === 'left' ? leftInput : rightInput;
    const receiverInput = state.servingSide === 'left' ? rightInput : leftInput;

    // Allow players to move along Z before serve
    const sNation = getNationByCode(server.nationCode);
    const rNation = getNationByCode(receiver.nationCode);
    server.z = Math.max(-COURT_HALF_Z + 0.6, Math.min(COURT_HALF_Z - 0.6, server.z + serverInput.moveZ * sNation.stats.moveSpeed * clampedDt));
    receiver.z = Math.max(-COURT_HALF_Z + 0.6, Math.min(COURT_HALF_Z - 0.6, receiver.z + receiverInput.moveZ * rNation.stats.moveSpeed * clampedDt));
    receiver.x =
      receiver.side === 'left'
        ? Math.max(-COURT_HALF_X + 0.5, Math.min(-1.5, receiver.x + receiverInput.moveX * rNation.stats.moveSpeed * clampedDt))
        : Math.min(COURT_HALF_X - 0.5, Math.max(1.5, receiver.x + receiverInput.moveX * rNation.stats.moveSpeed * clampedDt));

    const offset = state.servingSide === 'left' ? 0.68 : -0.68;
    state.ball.x = server.x + offset;
    state.ball.y = 2.05 + Math.sin(Date.now() * 0.006) * 0.08;
    state.ball.z = server.z;
    state.ball.landingX = state.ball.x;
    state.ball.landingZ = state.ball.z;

    if (serverInput.actionPressed && state.phaseTimer <= 0) {
      state.phase = 'rally';
      const dir = state.servingSide === 'left' ? 1 : -1;
      const targetX = dir * (5.2 + serverInput.moveX * 1.6);
      const targetZ = Math.max(-COURT_HALF_Z + 0.7, Math.min(COURT_HALF_Z - 0.7, server.z * 0.4 + serverInput.moveZ * 3.0));
      const flightT = 1.06;
      state.ball.vx = (targetX - state.ball.x) / flightT;
      state.ball.vz = (targetZ - state.ball.z) / flightT;
      state.ball.vy = (BALL_RADIUS - state.ball.y + 0.5 * GRAVITY * flightT * flightT) / flightT;
      state.ball.spinZ = -dir * 8;
      state.ball.lastTouchSide = state.servingSide;
      state.rallyHits = 1;
      server.swingTimer = 0.3;
      server.hitCooldown = 0.25;
      server.surge = Math.min(100, server.surge + 10);
      const landing = computeBallLanding(state.ball);
      state.ball.landingX = landing.x;
      state.ball.landingZ = landing.z;
      state.callout = `${server.nationCode} Serve In Play`;
      sounds.push('spike');
    }

    return sounds;
  }

  // Active Rally Phase
  stepSinglePlayer(state.leftPlayer, leftInput, clampedDt, state, sounds);
  stepSinglePlayer(state.rightPlayer, rightInput, clampedDt, state, sounds);

  const prevX = state.ball.x;
  state.ball.x += state.ball.vx * clampedDt;
  state.ball.y += state.ball.vy * clampedDt;
  state.ball.z += state.ball.vz * clampedDt;
  state.ball.vy -= GRAVITY * clampedDt;

  // Net collision check (X = 0, Y <= NET_HEIGHT, Z within [-COURT_HALF_Z - 0.4, COURT_HALF_Z + 0.4])
  const crossedNetPlane = (prevX < -BALL_RADIUS && state.ball.x >= -BALL_RADIUS) || (prevX > BALL_RADIUS && state.ball.x <= BALL_RADIUS) || Math.abs(state.ball.x) < BALL_RADIUS;
  if (crossedNetPlane && Math.abs(state.ball.z) <= COURT_HALF_Z + 0.5 && state.ball.y < NET_HEIGHT + BALL_RADIUS) {
    if (state.ball.y >= NET_HEIGHT - 0.14) {
      // Top tape graze — pops up dramatically like real volleyball!
      state.ball.y = NET_HEIGHT + BALL_RADIUS;
      state.ball.vy = Math.max(3.6, Math.abs(state.ball.vy) * 0.45);
      state.ball.vx *= 0.52;
      state.ball.isSurgeShot = false;
      sounds.push('net');
    } else {
      // Rebound off net mesh
      state.ball.x = prevX < 0 ? -BALL_RADIUS - 0.02 : BALL_RADIUS + 0.02;
      state.ball.vx = -state.ball.vx * 0.42;
      state.ball.vy = Math.max(state.ball.vy, 1.8);
      state.ball.isSurgeShot = false;
      sounds.push('net');
    }
    const landing = computeBallLanding(state.ball);
    state.ball.landingX = landing.x;
    state.ball.landingZ = landing.z;
  }

  // Player contacts
  tryPlayerBallContact(state.leftPlayer, leftInput, state, sounds);
  if (state.phase === 'rally') {
    tryPlayerBallContact(state.rightPlayer, rightInput, state, sounds);
  }

  // Ground impact check (Sand floor at Y = BALL_RADIUS)
  if (state.phase === 'rally' && state.ball.y <= BALL_RADIUS) {
    state.ball.y = BALL_RADIUS;
    const inBounds =
      Math.abs(state.ball.x) <= COURT_HALF_X + 0.22 &&
      Math.abs(state.ball.z) <= COURT_HALF_Z + 0.22;

    if (inBounds) {
      // Landed inside court lines!
      if (state.ball.x < 0) {
        awardPoint(state, 'right', `In Bounds · Point ${state.rightPlayer.nationCode}`, sounds);
      } else {
        awardPoint(state, 'left', `In Bounds · Point ${state.leftPlayer.nationCode}`, sounds);
      }
    } else {
      // Landed out of bounds — whoever touched it last loses the point!
      if (state.ball.lastTouchSide === 'left') {
        awardPoint(state, 'right', `Out of Bounds · Point ${state.rightPlayer.nationCode}`, sounds);
      } else if (state.ball.lastTouchSide === 'right') {
        awardPoint(state, 'left', `Out of Bounds · Point ${state.leftPlayer.nationCode}`, sounds);
      } else {
        awardPoint(state, state.ball.x < 0 ? 'right' : 'left', 'Ball Down', sounds);
      }
    }
  } else if (state.phase === 'rally') {
    const landing = computeBallLanding(state.ball);
    state.ball.landingX = landing.x;
    state.ball.landingZ = landing.z;
  }

  return sounds;
}
