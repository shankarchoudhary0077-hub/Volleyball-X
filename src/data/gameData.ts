import heroCourtImg from '../assets/images/volleyball_hero_court_1792807627284.jpg';
import blazeSpikerImg from '../assets/images/athlete_blaze_spiker_1792807628525.jpg';
import wallBlockerImg from '../assets/images/athlete_wall_blocker_1792807629410.jpg';
import swiftSetterImg from '../assets/images/athlete_swift_setter_1792807628775.jpg';
import type { PlayDifficulty } from '../shared/volleyballRules';
import type {
  BallSkinId,
  DailyChallengeScenario,
  TargetPointsOption,
} from '../types/game';

export const HERO_COURT_IMAGE = heroCourtImg;

export const ARCHETYPE_PORTRAITS: Record<string, string> = {
  IND: blazeSpikerImg,
  BRA: blazeSpikerImg,
  JPN: swiftSetterImg,
  FRA: swiftSetterImg,
  ITA: blazeSpikerImg,
  USA: wallBlockerImg,
  POL: wallBlockerImg,
  AUS: wallBlockerImg,
};

export const BALL_SKIN_CATALOG: Record<
  BallSkinId,
  {
    id: BallSkinId;
    name: string;
    baseHex: string;
    bandPrimaryHex: string;
    bandSecondaryHex: string;
    trailHex: string;
  }
> = {
  classic: {
    id: 'classic',
    name: 'Championship Tri-Color',
    baseHex: '#F8FAFC',
    bandPrimaryHex: '#F59E0B',
    bandSecondaryHex: '#1D4ED8',
    trailHex: '#F59E0B',
  },
  solar_flare: {
    id: 'solar_flare',
    name: 'Solar Flare Gold',
    baseHex: '#FEF3C7',
    bandPrimaryHex: '#EA580C',
    bandSecondaryHex: '#B91C1C',
    trailHex: '#FB923C',
  },
  emerald_aegis: {
    id: 'emerald_aegis',
    name: 'Emerald Aegis',
    baseHex: '#ECFDF5',
    bandPrimaryHex: '#10B981',
    bandSecondaryHex: '#0F766E',
    trailHex: '#34D399',
  },
  midnight_cobalt: {
    id: 'midnight_cobalt',
    name: 'Midnight Cobalt',
    baseHex: '#E0F2FE',
    bandPrimaryHex: '#0284C7',
    bandSecondaryHex: '#1E1B4B',
    trailHex: '#38BDF8',
  },
};

export const DAILY_CHALLENGES: DailyChallengeScenario[] = [
  {
    id: 'comeback_win',
    title: 'Comeback Win',
    scenarioKicker: 'Trailing 6–9 vs Brazil · Opponent Serve',
    description:
      'Enter the championship sand court down 6–9 against Brazil power spiker Lucas Silva on match-pressure serve. Defend the match points and rally back to win by 2.',
    objectiveSummary: 'Rally from 6–9 deficit to win the 11-point match',
    opponentNation: 'BRA',
    difficulty: 'pro',
    targetPoints: 11,
    initialLeftScore: 6,
    initialRightScore: 9,
    servingSide: 'right',
    initialSurge: 65,
    rewardCoins: 300,
    rewardTitle: 'Clutch Finisher',
    rewardSkinId: 'solar_flare',
    rewardSkinName: 'Solar Flare 3D Ball & Trail',
    rewardSwatchHex: '#EA580C',
  },
  {
    id: 'perfect_block',
    title: 'Perfect Block Challenge',
    scenarioKicker: '3+ Net Blocks & Win vs United States · 7-Point Sprint',
    description:
      'Shut down towering USA middle blocker Marcus Cole at the tape. Time your vertical leaps near the net to deflect at least 3 attacks and secure match victory.',
    objectiveSummary: 'Record 3+ Net Blocks and win the 7-point match',
    opponentNation: 'USA',
    difficulty: 'pro',
    targetPoints: 7,
    initialLeftScore: 0,
    initialRightScore: 0,
    servingSide: 'right',
    initialSurge: 35,
    requiredBlocks: 3,
    rewardCoins: 350,
    rewardTitle: 'Iron Wall',
    rewardSkinId: 'emerald_aegis',
    rewardSkinName: 'Emerald Aegis 3D Ball & Trail',
    rewardSwatchHex: '#10B981',
  },
  {
    id: 'surge_blitz',
    title: 'Surge Striker Blitz',
    scenarioKicker: '2+ Meteor Surge Strikes & Win vs Japan · 7-Point Sprint',
    description:
      'Outmaneuver lightning-fast Japan specialist Ren Takahashi. Build your Surge meter through clean receptions and unleash at least 2 Meteor Surge Strikes to win.',
    objectiveSummary: 'Unleash 2+ Meteor Surge Strikes and win the 7-point match',
    opponentNation: 'JPN',
    difficulty: 'pro',
    targetPoints: 7,
    initialLeftScore: 0,
    initialRightScore: 0,
    servingSide: 'left',
    initialSurge: 75,
    requiredSurgeStrikes: 2,
    rewardCoins: 350,
    rewardTitle: 'Sky Striker',
    rewardSkinId: 'midnight_cobalt',
    rewardSkinName: 'Midnight Cobalt 3D Ball & Trail',
    rewardSwatchHex: '#0284C7',
  },
];

export function getLocalTodayDateKey(now = new Date()): string {
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function getFeaturedDailyChallengeIndex(now = new Date()): number {
  const daysSinceEpoch = Math.floor(now.getTime() / 86_400_000);
  return Math.abs(daysSinceEpoch) % DAILY_CHALLENGES.length;
}

export function formatCountdownToMidnight(now = new Date()): string {
  const nextMidnight = new Date(now);
  nextMidnight.setHours(24, 0, 0, 0);
  const diffSec = Math.max(0, Math.floor((nextMidnight.getTime() - now.getTime()) / 1000));
  const hrs = String(Math.floor(diffSec / 3600)).padStart(2, '0');
  const mins = String(Math.floor((diffSec % 3600) / 60)).padStart(2, '0');
  const secs = String(diffSec % 60).padStart(2, '0');
  return `${hrs}:${mins}:${secs}`;
}

export const WORLD_TOUR_STAGES: {
  stage: number;
  title: string;
  opponentNation: string;
  difficulty: PlayDifficulty;
  venueLabel: string;
}[] = [
  {
    stage: 1,
    title: 'Qualifier Match',
    opponentNation: 'AUS',
    difficulty: 'rookie',
    venueLabel: 'Gold Coast Sunset Court',
  },
  {
    stage: 2,
    title: 'Quarterfinal',
    opponentNation: 'FRA',
    difficulty: 'pro',
    venueLabel: 'Riviera Coastal Stadium',
  },
  {
    stage: 3,
    title: 'Semifinal',
    opponentNation: 'JPN',
    difficulty: 'pro',
    venueLabel: 'Odaiba Bay Arena',
  },
  {
    stage: 4,
    title: 'World Championship Final',
    opponentNation: 'BRA',
    difficulty: 'champion',
    venueLabel: 'Copacabana Grand Center',
  },
];

export const DIFFICULTY_OPTIONS: {
  id: PlayDifficulty;
  label: string;
  summary: string;
}[] = [
  { id: 'rookie', label: 'Rookie', summary: 'Forgiving AI pace · Great for warm-ups' },
  { id: 'pro', label: 'Pro', summary: 'Balanced blocks, dives & directional spikes' },
  { id: 'champion', label: 'Champion', summary: 'International finals intensity' },
];

export const TARGET_POINTS_LIST: { value: TargetPointsOption; label: string }[] = [
  { value: 7, label: '7 Pts' },
  { value: 11, label: '11 Pts' },
  { value: 15, label: '15 Pts' },
];
