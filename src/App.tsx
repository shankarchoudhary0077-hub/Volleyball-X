import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Award,
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  Copy,
  Globe,
  Lock,
  Pause,
  Play,
  RotateCcw,
  Send,
  Share2,
  Trophy,
  Users,
  Volume2,
  VolumeX,
} from 'lucide-react';
import {
  ARCHETYPE_PORTRAITS,
  BALL_SKIN_CATALOG,
  DAILY_CHALLENGES,
  DIFFICULTY_OPTIONS,
  formatCountdownToMidnight,
  getFeaturedDailyChallengeIndex,
  getLocalTodayDateKey,
  HERO_COURT_IMAGE,
  TARGET_POINTS_LIST,
  WORLD_TOUR_STAGES,
} from './data/gameData';
import { VolleyballScene3D } from './scene/VolleyballScene3D';
import {
  CameraPreset,
  computeAiInput,
  createInitialSimState,
  getNationByCode,
  INTERNATIONAL_TEAMS,
  NationTeam,
  PlayDifficulty,
  PlayerInputState,
  SimMatchState,
  SoundTrigger,
  stepMatchPhysics,
  TeamSide,
} from './shared/volleyballRules';
import {
  BallSkinId,
  DailyChallengeId,
  DailyChallengeProgress,
  DailyChallengeScenario,
  GameState,
  IncomingInvite,
  LobbySnapshot,
  MatchMode,
  MatchSummaryRecord,
  TargetPointsOption,
} from './types/game';
import { soundEngine } from './utils/audio';

const STORAGE_CALLSIGN_KEY = 'bastion_vb_callsign_v1';
const STORAGE_NATION_KEY = 'bastion_vb_nation_v1';
const STORAGE_PCODE_KEY = 'bastion_vb_pcode_v1';
const STORAGE_HISTORY_KEY = 'bastion_vb_history_v1';
const STORAGE_DAILY_PROGRESS_KEY = 'bastion_vb_daily_progress_v1';

const DEFAULT_DAILY_PROGRESS: DailyChallengeProgress = {
  completedDatesById: {},
  unlockedSkins: ['classic'],
  unlockedTitles: [],
  equippedSkin: 'classic',
  equippedTitle: '',
  tourCoins: 0,
};

interface HudViewState {
  leftNation: string;
  leftCallsign: string;
  rightNation: string;
  rightCallsign: string;
  leftScore: number;
  rightScore: number;
  targetPoints: number;
  servingSide: TeamSide;
  leftTouches: number;
  rightTouches: number;
  leftSurge: number;
  rightSurge: number;
  leftTotalBlocks: number;
  leftSurgeStrikes: number;
  rallyHits: number;
  longestRally: number;
  callout: string;
  phase: SimMatchState['phase'];
  winnerSide: TeamSide | null;
}

interface ChallengeOutcomeSummary {
  challengeTitle: string;
  succeeded: boolean;
  newlyRewardedToday: boolean;
  detailText: string;
  rewardSkinName: string;
  rewardTitle: string;
  rewardCoins: number;
}

const ResilientImage: React.FC<{
  src: string;
  alt: string;
  fallbackLabel: string;
  accentHex?: string;
  className?: string;
}> = ({ src, alt, fallbackLabel, accentHex = '#F59E0B', className = '' }) => {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div
        className={`flex flex-col items-center justify-center bg-slate-900 text-slate-200 p-4 text-center ${className}`}
      >
        <Globe className="w-8 h-8 mb-2" style={{ color: accentHex }} />
        <span className="font-display font-bold text-sm tracking-tight">{fallbackLabel}</span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={className}
    />
  );
};

function triggerSoundEffects(sounds: SoundTrigger[], mySide: TeamSide): void {
  for (const s of sounds) {
    switch (s) {
      case 'bump':
        soundEngine.playBump();
        break;
      case 'spike':
        soundEngine.playSpike(false);
        break;
      case 'surge':
        soundEngine.playSpike(true);
        break;
      case 'jump':
        soundEngine.playJump();
        break;
      case 'dive':
        soundEngine.playDive();
        break;
      case 'net':
        soundEngine.playNetHit();
        break;
      case 'point_left':
        soundEngine.playWhistlePoint(mySide === 'left');
        break;
      case 'point_right':
        soundEngine.playWhistlePoint(mySide === 'right');
        break;
      case 'match_win':
        soundEngine.playMatchWin();
        break;
    }
  }
}

export default function App() {
  // Persistent Player Profile
  const [callsign, setCallsign] = useState<string>(() => {
    try {
      return localStorage.getItem(STORAGE_CALLSIGN_KEY) || 'Aarav';
    } catch {
      return 'Aarav';
    }
  });
  const [selectedNation, setSelectedNation] = useState<string>(() => {
    try {
      return localStorage.getItem(STORAGE_NATION_KEY) || 'IND';
    } catch {
      return 'IND';
    }
  });
  const [playerCode, setPlayerCode] = useState<string>(() => {
    try {
      return localStorage.getItem(STORAGE_PCODE_KEY) || '';
    } catch {
      return '';
    }
  });

  // Daily Challenge State & Persistent Rewards
  const featuredChallengeIdx = useMemo(() => getFeaturedDailyChallengeIndex(new Date()), []);
  const [selectedChallengeId, setSelectedChallengeId] = useState<DailyChallengeId>(
    () => DAILY_CHALLENGES[featuredChallengeIdx]?.id || 'comeback_win',
  );
  const [activeChallenge, setActiveChallenge] = useState<DailyChallengeScenario | null>(null);
  const [challengeOutcome, setChallengeOutcome] = useState<ChallengeOutcomeSummary | null>(null);
  const [countdownLabel, setCountdownLabel] = useState<string>(() =>
    formatCountdownToMidnight(new Date()),
  );
  const [todayKey, setTodayKey] = useState<string>(() => getLocalTodayDateKey(new Date()));

  const [dailyProgress, setDailyProgress] = useState<DailyChallengeProgress>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_DAILY_PROGRESS_KEY);
      if (!raw) return DEFAULT_DAILY_PROGRESS;
      const parsed = JSON.parse(raw) as Partial<DailyChallengeProgress>;
      return {
        completedDatesById: parsed.completedDatesById || {},
        unlockedSkins:
          Array.isArray(parsed.unlockedSkins) && parsed.unlockedSkins.length > 0
            ? (parsed.unlockedSkins as BallSkinId[])
            : ['classic'],
        unlockedTitles: Array.isArray(parsed.unlockedTitles) ? parsed.unlockedTitles : [],
        equippedSkin: (parsed.equippedSkin as BallSkinId) || 'classic',
        equippedTitle: parsed.equippedTitle || '',
        tourCoins: typeof parsed.tourCoins === 'number' ? parsed.tourCoins : 0,
      };
    } catch {
      return DEFAULT_DAILY_PROGRESS;
    }
  });

  // Match Configuration
  const [gameState, setGameState] = useState<GameState>(GameState.TITLE_MENU);
  const [matchMode, setMatchMode] = useState<MatchMode>('world_tour');
  const [opponentNation, setOpponentNation] = useState<string>('BRA');
  const [difficulty, setDifficulty] = useState<PlayDifficulty>('pro');
  const [targetPoints, setTargetPoints] = useState<TargetPointsOption>(11);
  const [tourStageIdx, setTourStageIdx] = useState<number>(0);

  // Camera, Dock & Mobile Controls
  const [cameraPreset, setCameraPreset] = useState<CameraPreset>('broadcast');
  const [dockCollapsed, setDockCollapsed] = useState<boolean>(false);
  const [muted, setMuted] = useState<boolean>(false);
  const [showTouchPad, setShowTouchPad] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(pointer: coarse)').matches || window.innerWidth < 900;
  });

  // Online WebSocket & Friend Request State
  const wsRef = useRef<WebSocket | null>(null);
  const [wsConnected, setWsConnected] = useState<boolean>(false);
  const [lobby, setLobby] = useState<LobbySnapshot>({
    onlineCount: 1,
    queueCount: 0,
    activeMatches: 0,
    openRooms: [],
    onlinePlayers: [],
  });
  const [isSearchingQueue, setIsSearchingQueue] = useState<boolean>(false);
  const [waitingRoomCode, setWaitingRoomCode] = useState<string | null>(null);
  const [activeOnlineRoom, setActiveOnlineRoom] = useState<string | null>(null);
  const [mySide, setMySide] = useState<TeamSide>('left');

  // Friend & Family Invite UI State
  const [friendCodeInput, setFriendCodeInput] = useState<string>('');
  const [joinRoomInput, setJoinRoomInput] = useState<string>('');
  const [incomingInvite, setIncomingInvite] = useState<IncomingInvite | null>(null);
  const [statusBanner, setStatusBanner] = useState<string | null>(null);
  const [copiedType, setCopiedType] = useState<'code' | 'link' | 'message' | null>(null);

  // Match History
  const [matchHistory, setMatchHistory] = useState<MatchSummaryRecord[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_HISTORY_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  // Authoritative / Local Simulation Ref for 60fps Three.js Scene
  const simStateRef = useRef<SimMatchState>(
    createInitialSimState('IND', 'Aarav', 'BRA', 'Lucas Silva', 11),
  );
  const recordedWinRef = useRef<boolean>(false);

  const [hud, setHud] = useState<HudViewState>(() => {
    const s = simStateRef.current;
    return {
      leftNation: s.leftPlayer.nationCode,
      leftCallsign: s.leftPlayer.callsign,
      rightNation: s.rightPlayer.nationCode,
      rightCallsign: s.rightPlayer.callsign,
      leftScore: s.leftScore,
      rightScore: s.rightScore,
      targetPoints: s.targetPoints,
      servingSide: s.servingSide,
      leftTouches: s.leftTouches,
      rightTouches: s.rightTouches,
      leftSurge: s.leftPlayer.surge,
      rightSurge: s.rightPlayer.surge,
      leftTotalBlocks: s.leftTotalBlocks,
      leftSurgeStrikes: s.leftSurgeStrikes,
      rallyHits: s.rallyHits,
      longestRally: s.longestRally,
      callout: s.callout,
      phase: s.phase,
      winnerSide: s.winnerSide,
    };
  });

  // Live Midnight Reset Countdown Tick
  useEffect(() => {
    const timer = window.setInterval(() => {
      const now = new Date();
      setCountdownLabel(formatCountdownToMidnight(now));
      setTodayKey(getLocalTodayDateKey(now));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Persist Daily Challenge Progress
  const updateDailyProgress = useCallback(
    (updater: (prev: DailyChallengeProgress) => DailyChallengeProgress) => {
      setDailyProgress((prev) => {
        const next = updater(prev);
        try {
          localStorage.setItem(STORAGE_DAILY_PROGRESS_KEY, JSON.stringify(next));
        } catch {
          // Ignore quota errors
        }
        return next;
      });
    },
    [],
  );

  // Keyboard & Touch Input Refs
  const keysPressedRef = useRef<Set<string>>(new Set());
  const touchInputRef = useRef<PlayerInputState>({
    moveX: 0,
    moveZ: 0,
    actionPressed: false,
    divePressed: false,
  });

  const syncHudFromSim = useCallback((s: SimMatchState) => {
    setHud({
      leftNation: s.leftPlayer.nationCode,
      leftCallsign: s.leftPlayer.callsign,
      rightNation: s.rightPlayer.nationCode,
      rightCallsign: s.rightPlayer.callsign,
      leftScore: s.leftScore,
      rightScore: s.rightScore,
      targetPoints: s.targetPoints,
      servingSide: s.servingSide,
      leftTouches: s.leftTouches,
      rightTouches: s.rightTouches,
      leftSurge: Math.round(s.leftPlayer.surge),
      rightSurge: Math.round(s.rightPlayer.surge),
      leftTotalBlocks: s.leftTotalBlocks,
      leftSurgeStrikes: s.leftSurgeStrikes,
      rallyHits: s.rallyHits,
      longestRally: s.longestRally,
      callout: s.callout,
      phase: s.phase,
      winnerSide: s.winnerSide,
    });
  }, []);

  const evaluateAndRecordCompletedMatch = useCallback(
    (
      s: SimMatchState,
      modeUsed: MatchMode,
      challengeRefScenario: DailyChallengeScenario | null,
    ) => {
      if (recordedWinRef.current || !s.winnerSide) return;
      recordedWinRef.current = true;

      const entry: MatchSummaryRecord = {
        id: `m_${Date.now()}`,
        mode: modeUsed,
        leftNation: s.leftPlayer.nationCode,
        leftCallsign: s.leftPlayer.callsign,
        rightNation: s.rightPlayer.nationCode,
        rightCallsign: s.rightPlayer.callsign,
        leftScore: s.leftScore,
        rightScore: s.rightScore,
        winnerSide: s.winnerSide,
        longestRally: s.longestRally,
        leftSpikes: s.leftSpikesScored,
        rightSpikes: s.rightSpikesScored,
        leftBlocks: s.leftTotalBlocks,
        rightBlocks: s.rightTotalBlocks,
        dateLabel: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMatchHistory((prev) => {
        const updated = [entry, ...prev].slice(0, 8);
        try {
          localStorage.setItem(STORAGE_HISTORY_KEY, JSON.stringify(updated));
        } catch {
          // Ignore storage errors
        }
        return updated;
      });

      if (modeUsed === 'daily_challenge' && challengeRefScenario) {
        const wonMatch = s.winnerSide === 'left';
        const metBlocks =
          !challengeRefScenario.requiredBlocks ||
          s.leftTotalBlocks >= challengeRefScenario.requiredBlocks;
        const metSurges =
          !challengeRefScenario.requiredSurgeStrikes ||
          s.leftSurgeStrikes >= challengeRefScenario.requiredSurgeStrikes;

        const succeeded = wonMatch && metBlocks && metSurges;
        const currentDay = getLocalTodayDateKey(new Date());

        if (succeeded) {
          let newlyClaimed = false;
          updateDailyProgress((prev) => {
            const alreadyDoneToday = prev.completedDatesById[challengeRefScenario.id] === currentDay;
            newlyClaimed = !alreadyDoneToday;
            const nextSkins = prev.unlockedSkins.includes(challengeRefScenario.rewardSkinId)
              ? prev.unlockedSkins
              : [...prev.unlockedSkins, challengeRefScenario.rewardSkinId];
            const nextTitles = prev.unlockedTitles.includes(challengeRefScenario.rewardTitle)
              ? prev.unlockedTitles
              : [...prev.unlockedTitles, challengeRefScenario.rewardTitle];

            return {
              completedDatesById: {
                ...prev.completedDatesById,
                [challengeRefScenario.id]: currentDay,
              },
              unlockedSkins: nextSkins,
              unlockedTitles: nextTitles,
              equippedSkin: challengeRefScenario.rewardSkinId,
              equippedTitle: challengeRefScenario.rewardTitle,
              tourCoins: alreadyDoneToday
                ? prev.tourCoins
                : prev.tourCoins + challengeRefScenario.rewardCoins,
            };
          });

          setChallengeOutcome({
            challengeTitle: challengeRefScenario.title,
            succeeded: true,
            newlyRewardedToday: newlyClaimed,
            detailText: `Scenario Completed · ${s.leftScore}–${s.rightScore}`,
            rewardSkinName: challengeRefScenario.rewardSkinName,
            rewardTitle: challengeRefScenario.rewardTitle,
            rewardCoins: challengeRefScenario.rewardCoins,
          });
        } else {
          let reason = 'Defeated before reaching the target victory.';
          if (wonMatch && !metBlocks) {
            reason = `Won match, but recorded ${s.leftTotalBlocks}/${challengeRefScenario.requiredBlocks} required Net Blocks.`;
          } else if (wonMatch && !metSurges) {
            reason = `Won match, but landed ${s.leftSurgeStrikes}/${challengeRefScenario.requiredSurgeStrikes} required Meteor Surge Strikes.`;
          }
          setChallengeOutcome({
            challengeTitle: challengeRefScenario.title,
            succeeded: false,
            newlyRewardedToday: false,
            detailText: reason,
            rewardSkinName: challengeRefScenario.rewardSkinName,
            rewardTitle: challengeRefScenario.rewardTitle,
            rewardCoins: challengeRefScenario.rewardCoins,
          });
        }
      } else {
        setChallengeOutcome(null);
      }
    },
    [updateDailyProgress],
  );

  // Save profile edits locally and push to WebSocket server
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_CALLSIGN_KEY, callsign);
      localStorage.setItem(STORAGE_NATION_KEY, selectedNation);
    } catch {
      // Ignore storage errors
    }
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'profile:set',
          callsign: callsign.trim() || 'Player',
          nationCode: selectedNation,
          targetPoints,
        }),
      );
    }
  }, [callsign, selectedNation, targetPoints]);

  // Establish Real-Time WebSocket Connection with Auto-Reconnect & URL Room Auto-Join
  useEffect(() => {
    let reconnectTimer = 0;
    let unmounted = false;

    const connectWs = () => {
      if (unmounted) return;
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        if (unmounted) return;
        setWsConnected(true);
        const savedCode = (() => {
          try {
            return localStorage.getItem(STORAGE_PCODE_KEY) || '';
          } catch {
            return '';
          }
        })();

        ws.send(
          JSON.stringify({
            type: 'profile:set',
            callsign: (localStorage.getItem(STORAGE_CALLSIGN_KEY) || 'Aarav').slice(0, 18),
            nationCode: localStorage.getItem(STORAGE_NATION_KEY) || 'IND',
            preferredCode: savedCode,
            targetPoints,
          }),
        );

        const params = new URLSearchParams(window.location.search);
        const invitedRoom = params.get('room');
        if (invitedRoom && invitedRoom.trim().length >= 4) {
          ws.send(
            JSON.stringify({
              type: 'room:join',
              roomCode: invitedRoom.trim().toUpperCase(),
              callsign: localStorage.getItem(STORAGE_CALLSIGN_KEY) || 'Guest',
              nationCode: localStorage.getItem(STORAGE_NATION_KEY) || 'IND',
            }),
          );
          window.history.replaceState({}, '', window.location.pathname);
        }
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          switch (msg.type) {
            case 'connected': {
              if (msg.playerCode) {
                setPlayerCode(msg.playerCode);
                try {
                  localStorage.setItem(STORAGE_PCODE_KEY, msg.playerCode);
                } catch {
                  // Ignore
                }
              }
              break;
            }
            case 'profile:code_confirmed': {
              if (msg.playerCode) {
                setPlayerCode(msg.playerCode);
                try {
                  localStorage.setItem(STORAGE_PCODE_KEY, msg.playerCode);
                } catch {
                  // Ignore
                }
              }
              break;
            }
            case 'lobby:update': {
              setLobby({
                onlineCount: msg.onlineCount ?? 1,
                queueCount: msg.queueCount ?? 0,
                activeMatches: msg.activeMatches ?? 0,
                openRooms: msg.openRooms ?? [],
                onlinePlayers: msg.onlinePlayers ?? [],
              });
              break;
            }
            case 'matchmaking:searching': {
              setIsSearchingQueue(true);
              setStatusBanner('Searching global matchmaking queue for an international opponent...');
              break;
            }
            case 'matchmaking:cancelled': {
              setIsSearchingQueue(false);
              setStatusBanner(null);
              break;
            }
            case 'room:waiting': {
              setIsSearchingQueue(false);
              setWaitingRoomCode(msg.roomCode);
              setMySide(msg.yourSide || 'left');
              const inviteLink = `${window.location.origin}${window.location.pathname}?room=${msg.roomCode}`;
              navigator.clipboard
                ?.writeText(inviteLink)
                .then(() => {
                  setCopiedType('link');
                  setTimeout(() => setCopiedType(null), 2400);
                })
                .catch(() => {});
              setStatusBanner(
                `Private Room ${msg.roomCode} ready & Invite Link copied! Send it to your friend or family member to start.`,
              );
              break;
            }
            case 'room:started': {
              setIsSearchingQueue(false);
              setWaitingRoomCode(null);
              setIncomingInvite(null);
              setStatusBanner(null);
              setActiveChallenge(null);
              setChallengeOutcome(null);
              setActiveOnlineRoom(msg.roomCode);
              setMatchMode('online');
              const assignedSide: TeamSide = msg.yourSide || 'left';
              setMySide(assignedSide);
              recordedWinRef.current = false;
              simStateRef.current = msg.state;
              syncHudFromSim(msg.state);
              setGameState(GameState.PLAYING);
              soundEngine.playInviteChime();
              break;
            }
            case 'match:state': {
              const incomingState: SimMatchState = msg.state;
              simStateRef.current = incomingState;
              syncHudFromSim(incomingState);
              if (Array.isArray(msg.sounds) && msg.sounds.length > 0) {
                triggerSoundEffects(msg.sounds, mySide);
              }
              if (incomingState.phase === 'finished') {
                evaluateAndRecordCompletedMatch(incomingState, 'online', null);
                setGameState(GameState.GAME_OVER);
              }
              break;
            }
            case 'room:opponent_left': {
              setActiveOnlineRoom(null);
              setWaitingRoomCode(null);
              setGameState(GameState.TITLE_MENU);
              setStatusBanner(msg.message || 'Opponent left the online match.');
              break;
            }
            case 'room:error':
            case 'invite:error': {
              setStatusBanner(msg.message || 'Unable to complete online request.');
              break;
            }
            case 'invite:sent': {
              setStatusBanner(
                `Match request sent to ${msg.toCallsign} (${msg.toNation} · #${msg.toCode}). Waiting for response...`,
              );
              break;
            }
            case 'invite:received': {
              setIncomingInvite({
                inviteId: msg.inviteId,
                fromCallsign: msg.fromCallsign,
                fromCode: msg.fromCode,
                fromNation: msg.fromNation,
                targetPoints: msg.targetPoints || 11,
              });
              soundEngine.playInviteChime();
              break;
            }
            case 'invite:declined': {
              setStatusBanner(`${msg.byCallsign} (#${msg.byCode}) declined the match request.`);
              break;
            }
          }
        } catch {
          // Ignore malformed packet
        }
      };

      ws.onclose = () => {
        setWsConnected(false);
        if (!unmounted) {
          reconnectTimer = window.setTimeout(connectWs, 2200);
        }
      };
    };

    connectWs();

    return () => {
      unmounted = true;
      clearTimeout(reconnectTimer);
      wsRef.current?.close();
    };
  }, [evaluateAndRecordCompletedMatch, mySide, syncHudFromSim, targetPoints]);

  // Keyboard Listeners (WASD / Arrows + Space + Shift + Pause + Hide Controls H)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      if (e.code === 'KeyH') {
        setDockCollapsed((prev) => !prev);
        return;
      }

      if (e.code === 'Escape' || e.code === 'KeyP') {
        if (matchMode !== 'online') {
          setGameState((prev) =>
            prev === GameState.PLAYING
              ? GameState.PAUSED
              : prev === GameState.PAUSED
                ? GameState.PLAYING
                : prev,
          );
        }
        return;
      }

      if (
        ['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code) &&
        gameState === GameState.PLAYING
      ) {
        e.preventDefault();
      }

      keysPressedRef.current.add(e.code);
    };

    const onKeyUp = (e: KeyboardEvent) => {
      keysPressedRef.current.delete(e.code);
    };

    const onBlur = () => {
      keysPressedRef.current.clear();
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
  }, [gameState, matchMode]);

  // Compute Camera-Oriented Input for Local / Online Player
  const buildLocalPlayerInput = useCallback(
    (forSide: TeamSide, allowArrows: boolean, useArrowsOnly: boolean): PlayerInputState => {
      const keys = keysPressedRef.current;

      let rawHoriz = 0;
      let rawVert = 0;

      if (!useArrowsOnly) {
        if (keys.has('KeyA')) rawHoriz -= 1;
        if (keys.has('KeyD')) rawHoriz += 1;
        if (keys.has('KeyW')) rawVert -= 1;
        if (keys.has('KeyS')) rawVert += 1;
      }

      if (allowArrows || useArrowsOnly) {
        if (keys.has('ArrowLeft')) rawHoriz -= 1;
        if (keys.has('ArrowRight')) rawHoriz += 1;
        if (keys.has('ArrowUp')) rawVert -= 1;
        if (keys.has('ArrowDown')) rawVert += 1;
      }

      if (!useArrowsOnly) {
        rawHoriz += touchInputRef.current.moveX;
        rawVert += touchInputRef.current.moveZ;
      }

      rawHoriz = Math.max(-1, Math.min(1, rawHoriz));
      rawVert = Math.max(-1, Math.min(1, rawVert));

      let moveX = rawHoriz;
      let moveZ = rawVert;

      if (cameraPreset === 'pro_behind' && matchMode !== 'local_2p') {
        if (forSide === 'left') {
          moveX = -rawVert;
          moveZ = rawHoriz;
        } else {
          moveX = rawVert;
          moveZ = -rawHoriz;
        }
      }

      const actionPressed = useArrowsOnly
        ? keys.has('Enter') || keys.has('NumpadEnter') || keys.has('Slash')
        : keys.has('Space') ||
          keys.has('KeyJ') ||
          (allowArrows && keys.has('Enter')) ||
          touchInputRef.current.actionPressed;

      const divePressed = useArrowsOnly
        ? keys.has('ShiftRight') || keys.has('Period')
        : keys.has('ShiftLeft') ||
          keys.has('KeyF') ||
          (allowArrows && keys.has('ShiftRight')) ||
          touchInputRef.current.divePressed;

      return { moveX, moveZ, actionPressed, divePressed };
    },
    [cameraPreset, matchMode],
  );

  // Per-Frame Simulation Callback Driven by Three.js Clock Loop
  const hudSyncThrottleRef = useRef<number>(0);
  const netInputThrottleRef = useRef<number>(0);

  const handleSceneTick = useCallback(
    (dt: number, elapsedSec: number) => {
      if (gameState === GameState.TITLE_MENU) {
        const st = simStateRef.current;
        if (st.phase === 'finished') {
          simStateRef.current = createInitialSimState(
            selectedNation,
            callsign,
            opponentNation,
            'CPU',
            11,
          );
          return;
        }
        const aiL = computeAiInput(st, 'left', 'pro', elapsedSec);
        const aiR = computeAiInput(st, 'right', 'pro', elapsedSec + 1.7);
        stepMatchPhysics(st, aiL, aiR, dt);
        return;
      }

      if (gameState !== GameState.PLAYING) {
        return;
      }

      if (matchMode === 'online') {
        netInputThrottleRef.current += dt;
        if (netInputThrottleRef.current >= 0.022) {
          netInputThrottleRef.current = 0;
          const myInput = buildLocalPlayerInput(mySide, true, false);
          if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(
              JSON.stringify({
                type: 'player:input',
                ...myInput,
              }),
            );
          }
        }
        return;
      }

      const st = simStateRef.current;
      let leftInput: PlayerInputState;
      let rightInput: PlayerInputState;

      if (matchMode === 'local_2p') {
        leftInput = buildLocalPlayerInput('left', false, false);
        rightInput = buildLocalPlayerInput('right', false, true);
      } else {
        const activeDiff =
          matchMode === 'daily_challenge' && activeChallenge
            ? activeChallenge.difficulty
            : difficulty;
        leftInput = buildLocalPlayerInput('left', true, false);
        rightInput = computeAiInput(st, 'right', activeDiff, elapsedSec);
      }

      const sounds = stepMatchPhysics(st, leftInput, rightInput, dt);
      if (sounds.length > 0) {
        triggerSoundEffects(sounds, 'left');
      }

      hudSyncThrottleRef.current += dt;
      if (hudSyncThrottleRef.current >= 0.05 || st.phase === 'finished' || sounds.length > 0) {
        hudSyncThrottleRef.current = 0;
        syncHudFromSim(st);
      }

      if (st.phase === 'finished') {
        evaluateAndRecordCompletedMatch(st, matchMode, activeChallenge);
        if (
          matchMode === 'world_tour' &&
          st.winnerSide === 'left' &&
          tourStageIdx < WORLD_TOUR_STAGES.length - 1
        ) {
          setGameState(GameState.ROUND_SUMMARY);
        } else {
          setGameState(GameState.GAME_OVER);
        }
      }
    },
    [
      activeChallenge,
      buildLocalPlayerInput,
      callsign,
      difficulty,
      evaluateAndRecordCompletedMatch,
      gameState,
      matchMode,
      mySide,
      opponentNation,
      selectedNation,
      syncHudFromSim,
      tourStageIdx,
    ],
  );

  // Start Solo / World Tour / Local 2P Match
  const startOfflineMatch = useCallback(
    (mode: 'world_tour' | 'local_2p', oppCode?: string, diffOverride?: PlayDifficulty) => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'room:leave' }));
      }
      setIsSearchingQueue(false);
      setWaitingRoomCode(null);
      setActiveOnlineRoom(null);
      setActiveChallenge(null);
      setChallengeOutcome(null);

      const finalOppCode = oppCode || opponentNation;
      const finalDiff = diffOverride || difficulty;
      if (oppCode) setOpponentNation(oppCode);
      if (diffOverride) setDifficulty(diffOverride);

      const oppTeam = getNationByCode(finalOppCode);
      const rightLabel = mode === 'local_2p' ? 'Player 2' : oppTeam.playerName;

      setMatchMode(mode);
      setMySide('left');
      recordedWinRef.current = false;

      const fresh = createInitialSimState(
        selectedNation,
        callsign.trim() || 'Player 1',
        finalOppCode,
        rightLabel,
        targetPoints,
      );
      simStateRef.current = fresh;
      syncHudFromSim(fresh);
      setGameState(GameState.PLAYING);
    },
    [callsign, difficulty, opponentNation, selectedNation, syncHudFromSim, targetPoints],
  );

  // Start a Specific Daily Challenge Scenario
  const startDailyChallenge = useCallback(
    (scenario: DailyChallengeScenario) => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'room:leave' }));
      }
      setIsSearchingQueue(false);
      setWaitingRoomCode(null);
      setActiveOnlineRoom(null);
      setActiveChallenge(scenario);
      setChallengeOutcome(null);
      setOpponentNation(scenario.opponentNation);
      setDifficulty(scenario.difficulty);

      const oppTeam = getNationByCode(scenario.opponentNation);
      setMatchMode('daily_challenge');
      setMySide('left');
      recordedWinRef.current = false;

      const fresh = createInitialSimState(
        selectedNation,
        callsign.trim() || 'Player 1',
        scenario.opponentNation,
        oppTeam.playerName,
        scenario.targetPoints,
        {
          leftScore: scenario.initialLeftScore,
          rightScore: scenario.initialRightScore,
          servingSide: scenario.servingSide,
          leftInitialSurge: scenario.initialSurge,
          callout: `${scenario.title} · ${scenario.initialLeftScore}-${scenario.initialRightScore}`,
        },
      );
      simStateRef.current = fresh;
      syncHudFromSim(fresh);
      setGameState(GameState.PLAYING);
    },
    [callsign, selectedNation, syncHudFromSim],
  );

  const startNextWorldTourStage = useCallback(() => {
    const nextIdx = Math.min(WORLD_TOUR_STAGES.length - 1, tourStageIdx + 1);
    setTourStageIdx(nextIdx);
    const stage = WORLD_TOUR_STAGES[nextIdx];
    startOfflineMatch('world_tour', stage.opponentNation, stage.difficulty);
  }, [startOfflineMatch, tourStageIdx]);

  // Friend & Family Invite Handlers
  const handleSendFriendRequest = (codeToInvite?: string) => {
    const clean = (codeToInvite ?? friendCodeInput).replace(/^#/, '').trim().toUpperCase();
    if (!clean) {
      setStatusBanner('Enter your friend or family Player Code first.');
      return;
    }
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      setStatusBanner('Connecting to online lobby. Try again in a moment.');
      return;
    }
    wsRef.current.send(
      JSON.stringify({
        type: 'invite:send',
        targetCode: clean,
        targetPoints,
      }),
    );
    if (!codeToInvite) setFriendCodeInput('');
  };

  const handleRespondInvite = (accept: boolean) => {
    if (!incomingInvite) return;
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'invite:respond',
          inviteId: incomingInvite.inviteId,
          accept,
        }),
      );
    }
    setIncomingInvite(null);
  };

  const handleCreateFamilyRoomAndCopy = () => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      setStatusBanner('Connecting to online server...');
      return;
    }
    wsRef.current.send(
      JSON.stringify({
        type: 'room:create',
        isPublic: false,
        callsign: callsign.trim() || 'Player',
        nationCode: selectedNation,
        targetPoints,
      }),
    );
  };

  const copyInviteUrlOrShare = async (roomCodeVal: string, asFullMessage: boolean) => {
    const inviteUrl = `${window.location.origin}${window.location.pathname}?room=${roomCodeVal}`;
    const shareText = `Join my 3D International Volleyball match on Bastion Strike! Room Code: ${roomCodeVal} — Tap to play: ${inviteUrl}`;

    if (asFullMessage && typeof navigator.share === 'function') {
      try {
        await navigator.share({
          title: 'Bastion Strike 3D Volleyball Invite',
          text: `Play 3D Volleyball with ${callsign} (${selectedNation})! Room Code: ${roomCodeVal}`,
          url: inviteUrl,
        });
        setCopiedType('message');
        setTimeout(() => setCopiedType(null), 2200);
        return;
      } catch {
        // Fallback to clipboard copy
      }
    }

    try {
      await navigator.clipboard.writeText(asFullMessage ? shareText : inviteUrl);
      setCopiedType(asFullMessage ? 'message' : 'link');
      setTimeout(() => setCopiedType(null), 2400);
    } catch {
      setStatusBanner(`Share Room Code ${roomCodeVal} or URL: ${inviteUrl}`);
    }
  };

  const handleCopyMyPlayerCode = async () => {
    if (!playerCode) return;
    try {
      await navigator.clipboard.writeText(playerCode);
      setCopiedType('code');
      setTimeout(() => setCopiedType(null), 2000);
    } catch {
      // Ignore
    }
  };

  const handleJoinRoomByCode = () => {
    const clean = joinRoomInput.trim().toUpperCase();
    if (!clean) return;
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'room:join',
          roomCode: clean,
          callsign: callsign.trim() || 'Player',
          nationCode: selectedNation,
        }),
      );
      setJoinRoomInput('');
    }
  };

  const handleToggleQueue = () => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    if (isSearchingQueue) {
      wsRef.current.send(JSON.stringify({ type: 'matchmaking:cancel' }));
    } else {
      wsRef.current.send(
        JSON.stringify({
          type: 'matchmaking:join',
          callsign: callsign.trim() || 'Player',
          nationCode: selectedNation,
          targetPoints,
        }),
      );
    }
  };

  const handleLeaveToMenu = () => {
    if (matchMode === 'online' && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'room:leave' }));
    }
    setActiveOnlineRoom(null);
    setGameState(GameState.TITLE_MENU);
  };

  const handlePlayAgain = () => {
    if (matchMode === 'online') {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && activeOnlineRoom) {
        recordedWinRef.current = false;
        wsRef.current.send(JSON.stringify({ type: 'room:rematch' }));
        setStatusBanner('Rematch requested...');
      } else {
        setGameState(GameState.TITLE_MENU);
      }
      return;
    }
    if (matchMode === 'daily_challenge' && activeChallenge) {
      startDailyChallenge(activeChallenge);
      return;
    }
    startOfflineMatch(matchMode === 'local_2p' ? 'local_2p' : 'world_tour');
  };

  const handleToggleMute = () => {
    const nowMuted = soundEngine.toggleMute();
    setMuted(nowMuted);
  };

  const handleEquipSkin = (skinId: BallSkinId) => {
    if (!dailyProgress.unlockedSkins.includes(skinId)) return;
    updateDailyProgress((prev) => ({
      ...prev,
      equippedSkin: skinId,
    }));
  };

  const selectedTeamObj: NationTeam = useMemo(
    () => getNationByCode(selectedNation),
    [selectedNation],
  );

  const inspectedChallenge: DailyChallengeScenario = useMemo(
    () => DAILY_CHALLENGES.find((c) => c.id === selectedChallengeId) || DAILY_CHALLENGES[0],
    [selectedChallengeId],
  );

  const featuredChallengeId = DAILY_CHALLENGES[featuredChallengeIdx]?.id || 'comeback_win';
  const isInspectedCompletedToday =
    dailyProgress.completedDatesById[inspectedChallenge.id] === todayKey;

  const otherOnlinePlayers = useMemo(
    () => lobby.onlinePlayers.filter((p) => p.playerCode && p.playerCode !== playerCode),
    [lobby.onlinePlayers, playerCode],
  );

  // Live objective string for active Daily Challenge HUD
  const liveChallengeObjectiveText = useMemo(() => {
    if (matchMode !== 'daily_challenge' || !activeChallenge) return null;
    if (activeChallenge.requiredBlocks) {
      return `Daily Challenge · Net Blocks ${hud.leftTotalBlocks}/${activeChallenge.requiredBlocks} & Win`;
    }
    if (activeChallenge.requiredSurgeStrikes) {
      return `Daily Challenge · Surge Strikes ${hud.leftSurgeStrikes}/${activeChallenge.requiredSurgeStrikes} & Win`;
    }
    return `Daily Challenge · Comeback Win (Lead by 2 at ${activeChallenge.targetPoints} Pts)`;
  }, [activeChallenge, hud.leftSurgeStrikes, hud.leftTotalBlocks, matchMode]);

  // Primary CTA action in strict 3-zone header
  const handlePrimaryHeaderAction = () => {
    if (gameState === GameState.TITLE_MENU) {
      const stage = WORLD_TOUR_STAGES[tourStageIdx];
      startOfflineMatch('world_tour', stage.opponentNation, stage.difficulty);
    } else if (gameState === GameState.PLAYING) {
      if (matchMode === 'online') {
        handleLeaveToMenu();
      } else {
        setGameState(GameState.PAUSED);
      }
    } else if (gameState === GameState.PAUSED) {
      setGameState(GameState.PLAYING);
    } else {
      handlePlayAgain();
    }
  };

  const primaryHeaderLabel =
    gameState === GameState.TITLE_MENU
      ? 'Start Match'
      : gameState === GameState.PLAYING
        ? matchMode === 'online'
          ? 'Leave Match'
          : 'Pause Match'
        : gameState === GameState.PAUSED
          ? 'Resume Match'
          : matchMode === 'daily_challenge' && challengeOutcome && !challengeOutcome.succeeded
            ? 'Retry Challenge'
            : 'Play Again';

  const navigateSectionFromHeader = (sectionId: string) => {
    if (gameState !== GameState.TITLE_MENU) {
      handleLeaveToMenu();
      setTimeout(() => {
        document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth' });
      }, 60);
    } else {
      document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div id="top" className="min-h-screen flex flex-col bg-slate-950 text-slate-100">
      {/* Strict 3-Zone Top Bar Contract */}
      <header className="sticky top-0 z-40 flex items-center justify-between gap-8 px-6 py-3.5 bg-slate-950 border-b border-slate-800/90">
        <a
          href="#top"
          onClick={(e) => {
            if (gameState !== GameState.TITLE_MENU) {
              e.preventDefault();
              handleLeaveToMenu();
            }
          }}
          className="font-display text-lg font-bold tracking-tight text-slate-50 whitespace-nowrap shrink-0"
        >
          Bastion Strike
        </a>

        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-300">
          <button
            type="button"
            onClick={() => navigateSectionFromHeader('daily-challenge')}
            className="hover:text-amber-400 transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            Daily Challenge
          </button>
          <button
            type="button"
            onClick={() => navigateSectionFromHeader('friends-online')}
            className="hover:text-amber-400 transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            Friends
          </button>
          <button
            type="button"
            onClick={() => navigateSectionFromHeader('nations')}
            className="hover:text-amber-400 transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            Nations
          </button>
          <button
            type="button"
            onClick={() => navigateSectionFromHeader('world-tour')}
            className="hover:text-amber-400 transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            World Tour
          </button>
          <button
            type="button"
            onClick={() => navigateSectionFromHeader('controls-guide')}
            className="hover:text-amber-400 transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            Controls
          </button>
        </nav>

        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={handlePrimaryHeaderAction}
            className="px-4 py-2 text-xs font-semibold text-slate-950 bg-amber-500 rounded-lg hover:bg-amber-400 transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            {primaryHeaderLabel}
          </button>
        </div>
      </header>

      {/* Real-Time Incoming Friend / Family Match Request Notification */}
      {incomingInvite && (
        <div className="z-50 bg-slate-900 border-b border-amber-500/50 px-6 py-3">
          <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-4">
            <div className="text-sm text-slate-100">
              <span className="font-semibold text-amber-400">{incomingInvite.fromCallsign}</span>
              <span className="mx-2 text-slate-500">·</span>
              <span className="font-mono text-xs text-slate-300">
                {incomingInvite.fromNation} #{incomingInvite.fromCode}
              </span>
              <span className="mx-2 text-slate-500">·</span>
              <span>Invited you to a {incomingInvite.targetPoints}-Point 3D Volleyball Match</span>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => handleRespondInvite(true)}
                className="px-4 py-2 text-xs font-semibold bg-emerald-500 text-slate-950 rounded-lg hover:bg-emerald-400 transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                Accept & Play
              </button>
              <button
                type="button"
                onClick={() => handleRespondInvite(false)}
                className="px-4 py-2 text-xs font-medium bg-slate-800 text-slate-200 rounded-lg hover:bg-slate-700 transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                Decline
              </button>
            </div>
          </div>
        </div>
      )}

      {/*=====================================================================
        TITLE MENU & LOBBY VIEW
      ======================================================================*/}
      {gameState === GameState.TITLE_MENU && (
        <main className="flex-1">
          {/* Hero Split Section */}
          <section className="max-w-7xl mx-auto px-6 pt-8 pb-10">
            {statusBanner && (
              <div className="mb-6 flex items-center justify-between gap-4 px-4 py-3 rounded-lg bg-slate-900 border border-slate-700 text-sm text-slate-200">
                <span>{statusBanner}</span>
                <button
                  type="button"
                  onClick={() => setStatusBanner(null)}
                  className="text-xs font-medium text-slate-400 hover:text-slate-100 cursor-pointer whitespace-nowrap shrink-0"
                >
                  Dismiss
                </button>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
              {/* Left Column: Editorial Headline + Match Quick Setup */}
              <div className="lg:col-span-6 flex flex-col justify-between space-y-6">
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-slate-400">
                    <span>3D Championship Volleyball</span>
                    <span aria-hidden="true">·</span>
                    <span>8 International Nations</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono tabular-nums">
                      {wsConnected ? `${lobby.onlineCount} Online` : 'Connecting'}
                    </span>
                    {dailyProgress.tourCoins > 0 && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono tabular-nums text-amber-400">
                          {dailyProgress.tourCoins} Tour Coins
                        </span>
                      </>
                    )}
                  </div>

                  <h1 className="font-display text-4xl sm:text-5xl font-bold tracking-tight text-slate-50 leading-[1.1]">
                    Compete on the 3D World Court with Friends & Family
                  </h1>

                  <p className="text-base text-slate-300 leading-relaxed max-w-xl">
                    Represent international volleyball powerhouses in a full 3D coastal stadium.
                    Conquer limited-time Daily Challenges for exclusive 3D ball skins, or send
                    match requests to friends and family.
                  </p>
                </div>

                {/* Quick Profile & Target Points Bar */}
                <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <div className="flex items-center justify-between text-xs font-medium text-slate-400 mb-1.5">
                        <label htmlFor="player-callsign">Your Player Name</label>
                        {dailyProgress.equippedTitle && (
                          <span className="text-amber-400">{dailyProgress.equippedTitle}</span>
                        )}
                      </div>
                      <input
                        id="player-callsign"
                        type="text"
                        maxLength={18}
                        value={callsign}
                        onChange={(e) => setCallsign(e.target.value)}
                        placeholder="Enter your name"
                        className="w-full px-3.5 py-2 text-sm bg-slate-950 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-amber-500"
                      />
                    </div>

                    <div>
                      <span className="block text-xs font-medium text-slate-400 mb-1.5">
                        Match Length (Win by 2)
                      </span>
                      <div className="grid grid-cols-3 gap-1 p-1 bg-slate-950 rounded-lg border border-slate-800">
                        {TARGET_POINTS_LIST.map((opt) => (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => setTargetPoints(opt.value)}
                            className={`px-2.5 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap shrink-0 font-mono tabular-nums ${
                              targetPoints === opt.value
                                ? 'bg-amber-500 text-slate-950'
                                : 'text-slate-300 hover:text-slate-100'
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        const stage = WORLD_TOUR_STAGES[tourStageIdx];
                        startOfflineMatch('world_tour', stage.opponentNation, stage.difficulty);
                      }}
                      className="px-5 py-2.5 text-sm font-semibold bg-amber-500 text-slate-950 rounded-lg hover:bg-amber-400 transition-colors cursor-pointer inline-flex items-center gap-2 whitespace-nowrap shrink-0"
                    >
                      <Play className="w-4 h-4 fill-current" />
                      <span>Play 3D World Tour ({selectedNation})</span>
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        document
                          .getElementById('friends-online')
                          ?.scrollIntoView({ behavior: 'smooth' })
                      }
                      className="px-4 py-2.5 text-sm font-semibold bg-slate-800 text-slate-100 rounded-lg hover:bg-slate-700 transition-colors cursor-pointer inline-flex items-center gap-2 whitespace-nowrap shrink-0"
                    >
                      <Users className="w-4 h-4" />
                      <span>Invite Friend / Family</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => startOfflineMatch('local_2p', opponentNation)}
                      className="px-4 py-2.5 text-sm font-medium text-slate-300 hover:text-slate-100 border border-slate-700 rounded-lg hover:border-slate-600 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                    >
                      2P Same Keyboard
                    </button>
                  </div>
                </div>
              </div>

              {/* Right Column: Live 3D Stadium Viewport Preview */}
              <div className="lg:col-span-6 relative rounded-xl overflow-hidden border border-slate-800 min-h-[340px] lg:min-h-[420px] bg-slate-900">
                <VolleyballScene3D
                  simStateRef={simStateRef}
                  cameraPreset="broadcast"
                  perspectiveSide="left"
                  ballSkin={dailyProgress.equippedSkin}
                  onTickFrame={handleSceneTick}
                />
                <div className="absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-slate-950/90 via-slate-950/45 to-transparent flex items-end justify-between gap-4 pointer-events-none">
                  <div>
                    <div className="text-xs text-slate-300 font-medium">
                      Live 3D Arena Preview · {selectedTeamObj.country} ({selectedTeamObj.code})
                    </div>
                    <div className="text-sm font-semibold text-slate-50">
                      {selectedTeamObj.playerName} · #{selectedTeamObj.jerseyNumber}{' '}
                      {selectedTeamObj.styleTag}
                    </div>
                  </div>
                  <span className="text-xs font-mono tabular-nums text-amber-400">
                    {BALL_SKIN_CATALOG[dailyProgress.equippedSkin].name}
                  </span>
                </div>
              </div>
            </div>
          </section>

          {/*=================================================================
            SECTION 1: DAILY CHALLENGE (LIMITED-TIME SCENARIO & UNIQUE REWARDS)
          ==================================================================*/}
          <section
            id="daily-challenge"
            className="border-t border-slate-800/80 bg-slate-900/35 py-12"
          >
            <div className="max-w-7xl mx-auto px-6 space-y-6">
              {/* Header + Countdown + Scenario Segmented Tabs */}
              <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-5">
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                    <span className="inline-flex items-center gap-1.5 text-amber-400 font-medium">
                      <Clock className="w-3.5 h-3.5" />
                      <span className="font-mono tabular-nums">Resets in {countdownLabel}</span>
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>Limited-Time Scenarios</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono tabular-nums">
                      Tour Coins: {dailyProgress.tourCoins}
                    </span>
                  </div>
                  <h2 className="font-display text-2xl sm:text-3xl font-bold text-slate-50">
                    01. Daily Challenge
                  </h2>
                </div>

                {/* Interactive Scenario Selector */}
                <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-900 border border-slate-800 rounded-lg self-start">
                  {DAILY_CHALLENGES.map((ch) => {
                    const isActive = ch.id === inspectedChallenge.id;
                    const isFeatured = ch.id === featuredChallengeId;
                    const doneToday = dailyProgress.completedDatesById[ch.id] === todayKey;
                    return (
                      <button
                        key={ch.id}
                        type="button"
                        onClick={() => setSelectedChallengeId(ch.id)}
                        className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                          isActive
                            ? 'bg-amber-500 text-slate-950'
                            : 'text-slate-300 hover:text-slate-100'
                        }`}
                      >
                        {doneToday && <Check className="w-3.5 h-3.5 shrink-0" />}
                        <span>{isFeatured ? `Today: ${ch.title}` : ch.title}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Single-Elevation Split Panel Separated by Hairline Divider */}
              <div className="rounded-xl bg-slate-900 border border-slate-800 grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-slate-800">
                {/* Left 7 Columns: Active Scenario Briefing & Launch CTA */}
                <div className="lg:col-span-7 p-6 sm:p-7 flex flex-col justify-between space-y-6">
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                      <span className="text-slate-200 font-medium">
                        {inspectedChallenge.id === featuredChallengeId
                          ? 'Featured Daily Scenario'
                          : 'Bonus Daily Scenario'}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>{inspectedChallenge.scenarioKicker}</span>
                      {isInspectedCompletedToday && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="inline-flex items-center gap-1 text-emerald-400 font-semibold">
                            <Check className="w-3.5 h-3.5" />
                            <span>Completed Today</span>
                          </span>
                        </>
                      )}
                    </div>

                    <h3 className="font-display text-2xl sm:text-3xl font-bold text-slate-50">
                      {inspectedChallenge.title}
                    </h3>

                    <p className="text-sm sm:text-base text-slate-300 leading-relaxed max-w-2xl">
                      {inspectedChallenge.description}
                    </p>

                    <div className="pt-2 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-slate-300 border-t border-slate-800/80">
                      <div>
                        <span className="text-slate-500">Objective: </span>
                        <span className="font-semibold text-slate-100">
                          {inspectedChallenge.objectiveSummary}
                        </span>
                      </div>
                      <div className="font-mono tabular-nums">
                        <span className="text-slate-500">Opponent: </span>
                        <span className="text-slate-100">
                          {getNationByCode(inspectedChallenge.opponentNation).country} (
                          {inspectedChallenge.opponentNation})
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-4 pt-1">
                    <button
                      type="button"
                      onClick={() => startDailyChallenge(inspectedChallenge)}
                      className="px-5 py-2.5 text-sm font-semibold bg-amber-500 text-slate-950 rounded-lg hover:bg-amber-400 transition-colors cursor-pointer inline-flex items-center gap-2 whitespace-nowrap shrink-0"
                    >
                      <Play className="w-4 h-4 fill-current" />
                      <span>
                        {isInspectedCompletedToday
                          ? `Replay ${inspectedChallenge.title}`
                          : `Play ${inspectedChallenge.title}`}
                      </span>
                    </button>

                    <div className="text-xs text-slate-400">
                      Your Nation:{' '}
                      <span className="text-slate-200 font-semibold">
                        {selectedTeamObj.country} ({selectedTeamObj.code})
                      </span>
                    </div>
                  </div>
                </div>

                {/* Right 5 Columns: Unique Challenge Rewards & 3D Ball Equipment */}
                <div className="lg:col-span-5 p-6 sm:p-7 flex flex-col justify-between space-y-6">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="font-display text-base font-semibold text-slate-100 inline-flex items-center gap-2">
                        <Award className="w-4 h-4 text-amber-400" />
                        <span>Unique Scenario Rewards</span>
                      </h4>
                      <span className="text-xs font-mono tabular-nums text-amber-400 font-semibold">
                        +{inspectedChallenge.rewardCoins} Tour Coins
                      </span>
                    </div>

                    <div className="space-y-2.5 text-sm border-b border-slate-800 pb-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span
                            className="w-3.5 h-3.5 rounded-sm shrink-0"
                            style={{ backgroundColor: inspectedChallenge.rewardSwatchHex }}
                          />
                          <span className="text-slate-200 font-medium truncate">
                            {inspectedChallenge.rewardSkinName}
                          </span>
                        </div>
                        <span className="text-xs text-slate-400 whitespace-nowrap shrink-0">
                          {dailyProgress.unlockedSkins.includes(inspectedChallenge.rewardSkinId)
                            ? 'Unlocked'
                            : '3D Ball Skin'}
                        </span>
                      </div>

                      <div className="flex items-center justify-between gap-3">
                        <span className="text-slate-300">
                          Honor Title:{' '}
                          <span className="text-slate-100 font-semibold">
                            {inspectedChallenge.rewardTitle}
                          </span>
                        </span>
                        <span className="text-xs text-slate-400 whitespace-nowrap shrink-0">
                          {dailyProgress.unlockedTitles.includes(inspectedChallenge.rewardTitle)
                            ? 'Earned'
                            : 'Profile Title'}
                        </span>
                      </div>
                    </div>

                    {/* Equippable 3D Volleyball Locker */}
                    <div className="space-y-2">
                      <div className="text-xs font-medium text-slate-400">
                        Equip 3D Volleyball Skin (Live on Court)
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {(
                          Object.keys(BALL_SKIN_CATALOG) as BallSkinId[]
                        ).map((skinKey) => {
                          const skin = BALL_SKIN_CATALOG[skinKey];
                          const unlocked = dailyProgress.unlockedSkins.includes(skinKey);
                          const equipped = dailyProgress.equippedSkin === skinKey;
                          return (
                            <button
                              key={skinKey}
                              type="button"
                              disabled={!unlocked}
                              onClick={() => handleEquipSkin(skinKey)}
                              className={`px-3 py-2 rounded-lg border text-left text-xs transition-colors flex items-center justify-between gap-2 whitespace-nowrap ${
                                equipped
                                  ? 'border-amber-500 bg-slate-950 text-amber-400 font-semibold cursor-pointer'
                                  : unlocked
                                    ? 'border-slate-800 bg-slate-950 text-slate-200 hover:border-slate-700 cursor-pointer'
                                    : 'border-slate-800/60 bg-slate-950/50 text-slate-500 cursor-not-allowed'
                              }`}
                            >
                              <span className="inline-flex items-center gap-2 min-w-0 truncate">
                                <span
                                  className="w-2.5 h-2.5 rounded-sm shrink-0"
                                  style={{ backgroundColor: skin.bandPrimaryHex }}
                                />
                                <span className="truncate">{skin.name}</span>
                              </span>
                              {!unlocked ? (
                                <Lock className="w-3 h-3 shrink-0 text-slate-600" />
                              ) : equipped ? (
                                <Check className="w-3.5 h-3.5 shrink-0 text-amber-400" />
                              ) : null}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/*=================================================================
            SECTION 2: FRIENDS, FAMILY & ONLINE MULTIPLAYER REQUEST CENTER
          ==================================================================*/}
          <section id="friends-online" className="border-t border-slate-800/80 py-12">
            <div className="max-w-7xl mx-auto px-6 space-y-8">
              <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                <div className="space-y-1">
                  <h2 className="font-display text-2xl sm:text-3xl font-bold text-slate-50">
                    02. Play with Friends, Family & Online Players
                  </h2>
                  <p className="text-sm text-slate-400">
                    Send a direct match request using a Player Code, share a one-tap Invite Link on
                    WhatsApp or SMS, or enter global matchmaking.
                  </p>
                </div>

                <div className="flex items-center gap-3 text-xs text-slate-300 font-mono tabular-nums">
                  <span>Online Players: {lobby.onlineCount}</span>
                  <span aria-hidden="true">·</span>
                  <span>Active Rooms: {lobby.activeMatches}</span>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Card A: Share Invite Link with Family / Friends */}
                <div className="p-6 rounded-xl bg-slate-900 border border-slate-800 flex flex-col justify-between space-y-5">
                  <div className="space-y-3">
                    <h3 className="font-display text-lg font-semibold text-slate-100">
                      Invite Family & Friends via Link
                    </h3>
                    <p className="text-sm text-slate-400 leading-relaxed">
                      Create a private 3D court room and send the invite link to family or friends.
                      As soon as they tap your link, the match begins automatically.
                    </p>

                    {waitingRoomCode ? (
                      <div className="pt-2 border-t border-slate-800 space-y-1">
                        <div className="flex items-center justify-between text-xs text-slate-400">
                          <span>Active Waiting Room Code</span>
                          <span className="text-amber-400 font-semibold">Waiting for Join</span>
                        </div>
                        <div className="font-mono text-2xl font-bold tracking-wider text-slate-50 tabular-nums">
                          {waitingRoomCode}
                        </div>
                      </div>
                    ) : (
                      <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
                        <div>
                          <div className="text-xs text-slate-400">Your Personal Player Code</div>
                          <div className="font-mono text-lg font-bold text-amber-400 tabular-nums">
                            #{playerCode || '----'}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={handleCopyMyPlayerCode}
                          className="px-3 py-1.5 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-md inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
                        >
                          {copiedType === 'code' ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                              <span>Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              <span>Copy Code</span>
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="space-y-2.5">
                    {!waitingRoomCode ? (
                      <button
                        type="button"
                        onClick={handleCreateFamilyRoomAndCopy}
                        className="w-full py-2.5 px-4 text-xs font-semibold bg-amber-500 text-slate-950 rounded-lg hover:bg-amber-400 transition-colors cursor-pointer inline-flex items-center justify-center gap-2 whitespace-nowrap shrink-0"
                      >
                        <Share2 className="w-4 h-4" />
                        <span>Create Private Family Room</span>
                      </button>
                    ) : (
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => copyInviteUrlOrShare(waitingRoomCode, false)}
                          className="py-2.5 px-3 text-xs font-semibold bg-amber-500 text-slate-950 rounded-lg hover:bg-amber-400 transition-colors cursor-pointer inline-flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0"
                        >
                          {copiedType === 'link' ? (
                            <>
                              <Check className="w-3.5 h-3.5" />
                              <span>Link Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              <span>Copy Link</span>
                            </>
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => copyInviteUrlOrShare(waitingRoomCode, true)}
                          className="py-2.5 px-3 text-xs font-semibold bg-slate-800 text-slate-100 rounded-lg hover:bg-slate-700 transition-colors cursor-pointer inline-flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0"
                        >
                          <Share2 className="w-3.5 h-3.5" />
                          <span>{copiedType === 'message' ? 'Invite Copied' : 'Share Invite'}</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Card B: Send Direct Request by Friend Code or Online Directory */}
                <div className="p-6 rounded-xl bg-slate-900 border border-slate-800 flex flex-col justify-between space-y-5">
                  <div className="space-y-3">
                    <h3 className="font-display text-lg font-semibold text-slate-100">
                      Send Match Request to Friend
                    </h3>
                    <p className="text-sm text-slate-400 leading-relaxed">
                      Enter your friend&apos;s Player Code or pick someone online below to send an
                      instant match popup to their screen.
                    </p>

                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        maxLength={8}
                        value={friendCodeInput}
                        onChange={(e) => setFriendCodeInput(e.target.value.toUpperCase())}
                        placeholder="Friend Code (e.g. 4821)"
                        className="flex-1 min-w-0 px-3 py-2 text-sm font-mono bg-slate-950 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-amber-500"
                      />
                      <button
                        type="button"
                        onClick={() => handleSendFriendRequest()}
                        className="px-4 py-2 text-xs font-semibold bg-emerald-500 text-slate-950 rounded-lg hover:bg-emerald-400 transition-colors cursor-pointer inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>Send Request</span>
                      </button>
                    </div>

                    <div className="pt-2 border-t border-slate-800 space-y-2">
                      <div className="text-xs font-medium text-slate-400">
                        Players Online Now ({otherOnlinePlayers.length})
                      </div>
                      {otherOnlinePlayers.length === 0 ? (
                        <p className="text-xs text-slate-400 leading-relaxed">
                          No other players in lobby yet. Open this app on a friend or family
                          member&apos;s phone/laptop to see them appear live here.
                        </p>
                      ) : (
                        <div className="max-h-36 overflow-y-auto divide-y divide-slate-800 pr-1">
                          {otherOnlinePlayers.map((plr) => (
                            <div
                              key={plr.playerCode}
                              className="flex items-center justify-between gap-2 py-2"
                            >
                              <div className="min-w-0 text-xs">
                                <span className="font-semibold text-slate-100 truncate">
                                  {plr.callsign}
                                </span>
                                <span className="mx-1.5 text-slate-500">·</span>
                                <span className="font-mono text-slate-300">
                                  {plr.nationCode} #{plr.playerCode}
                                </span>
                              </div>
                              {plr.status === 'in_match' ? (
                                <span className="text-xs text-slate-500 whitespace-nowrap shrink-0">
                                  In Match
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleSendFriendRequest(plr.playerCode)}
                                  className="px-2.5 py-1 text-xs font-semibold bg-slate-800 hover:bg-amber-500 hover:text-slate-950 text-amber-400 rounded transition-colors cursor-pointer whitespace-nowrap shrink-0"
                                >
                                  Request
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Card C: Global International Matchmaking & Join Room by Code */}
                <div className="p-6 rounded-xl bg-slate-900 border border-slate-800 flex flex-col justify-between space-y-5">
                  <div className="space-y-3">
                    <h3 className="font-display text-lg font-semibold text-slate-100">
                      International Matchmaking & Rooms
                    </h3>
                    <p className="text-sm text-slate-400 leading-relaxed">
                      Queue for an automatic international head-to-head match or enter a 5-letter
                      Room Code shared by a friend.
                    </p>

                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        maxLength={6}
                        value={joinRoomInput}
                        onChange={(e) => setJoinRoomInput(e.target.value.toUpperCase())}
                        placeholder="Room Code (e.g. VB74K)"
                        className="flex-1 min-w-0 px-3 py-2 text-sm font-mono bg-slate-950 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-amber-500"
                      />
                      <button
                        type="button"
                        onClick={handleJoinRoomByCode}
                        className="px-4 py-2 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-100 rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
                      >
                        Join Room
                      </button>
                    </div>

                    {lobby.openRooms.length > 0 && (
                      <div className="space-y-1.5 pt-2 border-t border-slate-800">
                        <div className="text-xs font-medium text-slate-400">Open Public Rooms</div>
                        {lobby.openRooms.slice(0, 3).map((rm) => (
                          <div
                            key={rm.code}
                            className="flex items-center justify-between py-1.5 text-xs"
                          >
                            <span>
                              {rm.hostCallsign} · {rm.hostNation} · {rm.targetPoints} Pts
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                wsRef.current?.send(
                                  JSON.stringify({
                                    type: 'room:join',
                                    roomCode: rm.code,
                                    callsign,
                                    nationCode: selectedNation,
                                  }),
                                );
                              }}
                              className="px-2.5 py-1 font-semibold bg-amber-500 text-slate-950 rounded cursor-pointer whitespace-nowrap shrink-0"
                            >
                              Join {rm.code}
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={handleToggleQueue}
                    className={`w-full py-2.5 px-4 text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                      isSearchingQueue
                        ? 'bg-red-500/20 text-red-300 border border-red-500/50 hover:bg-red-500/30'
                        : 'bg-slate-100 text-slate-950 hover:bg-white'
                    }`}
                  >
                    {isSearchingQueue
                      ? 'Cancel Online Search'
                      : `Find International Match (${lobby.queueCount} Searching)`}
                  </button>
                </div>
              </div>
            </div>
          </section>

          {/*=================================================================
            SECTION 3: SELECT INTERNATIONAL NATIONAL TEAM (8 NATIONS)
          ==================================================================*/}
          <section
            id="nations"
            className="border-t border-slate-800/80 bg-slate-900/35 py-12"
          >
            <div className="max-w-7xl mx-auto px-6 space-y-8">
              <div className="space-y-1">
                <h2 className="font-display text-2xl sm:text-3xl font-bold text-slate-50">
                  03. International National Roster
                </h2>
                <p className="text-sm text-slate-400">
                  Choose the nation and star athlete you represent in Daily Challenges, Online
                  Matches, and World Tour play.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                {INTERNATIONAL_TEAMS.map((team) => {
                  const isSelected = selectedNation === team.code;
                  const portrait = ARCHETYPE_PORTRAITS[team.code] || HERO_COURT_IMAGE;
                  return (
                    <button
                      key={team.code}
                      type="button"
                      onClick={() => setSelectedNation(team.code)}
                      className={`text-left rounded-xl overflow-hidden border transition-transform duration-150 cursor-pointer flex flex-col justify-between bg-slate-900 ${
                        isSelected
                          ? 'border-amber-500 ring-1 ring-amber-500 -translate-y-0.5'
                          : 'border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div>
                        <div className="relative h-40 w-full bg-slate-950 overflow-hidden">
                          <ResilientImage
                            src={portrait}
                            alt={`${team.country} volleyball athlete ${team.playerName}`}
                            fallbackLabel={`${team.country} (${team.code})`}
                            accentHex={team.accentColor}
                            className="w-full h-full object-cover object-top"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/25 to-transparent" />
                          <div className="absolute bottom-3 left-4 right-4 flex items-baseline justify-between">
                            <span className="font-display text-lg font-bold text-slate-50">
                              {team.country}
                            </span>
                            <span className="font-mono text-xs font-bold text-amber-400">
                              {team.code} #{team.jerseyNumber}
                            </span>
                          </div>
                        </div>

                        <div className="p-4 space-y-3">
                          <div>
                            <div className="text-sm font-semibold text-slate-100">
                              {team.playerName}
                            </div>
                            <div className="text-xs text-slate-400 mt-0.5">
                              {team.styleTag} · {team.specialty.split(' · ')[0]}
                            </div>
                          </div>

                          <div className="space-y-1.5 pt-1 text-xs font-mono tabular-nums">
                            <div className="flex items-center justify-between text-slate-300">
                              <span>Speed</span>
                              <span>{team.stats.speedRating}</span>
                            </div>
                            <div className="h-1.5 bg-slate-950 rounded overflow-hidden">
                              <div
                                className="h-full bg-slate-300"
                                style={{ width: `${team.stats.speedRating}%` }}
                              />
                            </div>

                            <div className="flex items-center justify-between text-slate-300">
                              <span>Jump Reach</span>
                              <span>{team.stats.jumpRating}</span>
                            </div>
                            <div className="h-1.5 bg-slate-950 rounded overflow-hidden">
                              <div
                                className="h-full bg-emerald-400"
                                style={{ width: `${team.stats.jumpRating}%` }}
                              />
                            </div>

                            <div className="flex items-center justify-between text-slate-300">
                              <span>Spike Power</span>
                              <span>{team.stats.powerRating}</span>
                            </div>
                            <div className="h-1.5 bg-slate-950 rounded overflow-hidden">
                              <div
                                className="h-full bg-amber-400"
                                style={{ width: `${team.stats.powerRating}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="px-4 py-2.5 border-t border-slate-800/80 text-xs font-semibold flex items-center justify-between">
                        <span className={isSelected ? 'text-amber-400' : 'text-slate-400'}>
                          {isSelected ? 'Selected Nation' : 'Select Nation'}
                        </span>
                        <span
                          className="w-3 h-3 rounded-sm"
                          style={{ backgroundColor: team.primaryColor }}
                        />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </section>

          {/*=================================================================
            SECTION 4: WORLD TOUR BRACKET & EXHIBITION SETUP
          ==================================================================*/}
          <section id="world-tour" className="border-t border-slate-800/80 py-12">
            <div className="max-w-7xl mx-auto px-6 space-y-8">
              <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                <div className="space-y-1">
                  <h2 className="font-display text-2xl sm:text-3xl font-bold text-slate-50">
                    04. International World Tour Championship
                  </h2>
                  <p className="text-sm text-slate-400">
                    Challenge international national teams across four championship stages or set up
                    a custom exhibition.
                  </p>
                </div>

                {/* Segmented AI Difficulty Control */}
                <div className="flex items-center gap-1 p-1 bg-slate-900 border border-slate-800 rounded-lg self-start">
                  {DIFFICULTY_OPTIONS.map((d) => (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => setDifficulty(d.id)}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                        difficulty === d.id
                          ? 'bg-amber-500 text-slate-950'
                          : 'text-slate-300 hover:text-slate-100'
                      }`}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {WORLD_TOUR_STAGES.map((st, idx) => {
                  const opp = getNationByCode(st.opponentNation);
                  const activeStage = tourStageIdx === idx;
                  return (
                    <div
                      key={st.stage}
                      className={`p-5 rounded-xl bg-slate-900 border flex flex-col justify-between space-y-4 ${
                        activeStage ? 'border-amber-500/80' : 'border-slate-800'
                      }`}
                    >
                      <div className="space-y-2">
                        <div className="text-xs text-slate-400 font-mono">
                          Stage 0{st.stage} · {st.venueLabel}
                        </div>
                        <h3 className="font-display text-lg font-bold text-slate-100">
                          {st.title}
                        </h3>
                        <div className="text-sm text-slate-300">
                          vs <span className="font-semibold text-slate-100">{opp.country}</span> (
                          {opp.code}) · {opp.playerName}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setTourStageIdx(idx);
                          startOfflineMatch('world_tour', st.opponentNation, st.difficulty);
                        }}
                        className="w-full py-2 px-3 text-xs font-semibold bg-slate-800 hover:bg-amber-500 hover:text-slate-950 text-slate-100 rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
                      >
                        Play Stage 0{st.stage}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>

          {/*=================================================================
            SECTION 5: CONTROLS & RECENT INTERNATIONAL RESULTS
          ==================================================================*/}
          <section
            id="controls-guide"
            className="border-t border-slate-800/80 bg-slate-900/35 py-12"
          >
            <div className="max-w-7xl mx-auto px-6">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                <div className="lg:col-span-7 space-y-4">
                  <h2 className="font-display text-2xl font-bold text-slate-50">
                    05. 3D Court Controls & Rules
                  </h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
                      <h3 className="font-semibold text-sm text-slate-100">
                        Solo & Online Controls
                      </h3>
                      <ul className="space-y-1.5 text-xs text-slate-300 leading-relaxed">
                        <li>
                          <span className="font-mono text-amber-400">W A S D</span> or{' '}
                          <span className="font-mono text-amber-400">Arrow Keys</span>: Move across
                          3D sand court
                        </li>
                        <li>
                          <span className="font-mono text-amber-400">Space</span>: Serve, Jump
                          Block at Net, & Directional Spike
                        </li>
                        <li>
                          <span className="font-mono text-amber-400">Shift</span> or{' '}
                          <span className="font-mono text-amber-400">F</span>: Diving Sand Save
                          toward far shots
                        </li>
                        <li>
                          <span className="font-mono text-amber-400">Mobile Touch</span>: On-screen
                          D-Pad, Spike & Dive buttons
                        </li>
                      </ul>
                    </div>

                    <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
                      <h3 className="font-semibold text-sm text-slate-100">
                        Championship Rules & Surge
                      </h3>
                      <ul className="space-y-1.5 text-xs text-slate-300 leading-relaxed">
                        <li>Maximum 3 touches per side before sending the ball over the net.</li>
                        <li>
                          Follow the glowing sand Target Ring to read 3D ball landing positions.
                        </li>
                        <li>
                          Fill your Surge Meter to 100% and jump-spike to unleash a Meteor Surge
                          Strike.
                        </li>
                        <li>
                          2P Same Keyboard: P1 uses <span className="font-mono">WASD + Space</span>,
                          P2 uses <span className="font-mono">Arrows + Enter</span>.
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>

                <div className="lg:col-span-5 space-y-4">
                  <h2 className="font-display text-2xl font-bold text-slate-50">
                    Recent Match Scoreboard
                  </h2>
                  <div className="p-5 rounded-xl bg-slate-900 border border-slate-800">
                    {matchHistory.length === 0 ? (
                      <p className="text-sm text-slate-400">
                        Completed Daily Challenges, World Tour stages, and Online Friend matches
                        will be recorded here.
                      </p>
                    ) : (
                      <div className="space-y-2.5">
                        {matchHistory.slice(0, 4).map((m) => (
                          <div
                            key={m.id}
                            className="flex items-center justify-between text-xs py-2 border-b border-slate-800 last:border-0 font-mono tabular-nums"
                          >
                            <span className="text-slate-200">
                              {m.leftNation} {m.leftScore} - {m.rightScore} {m.rightNation}
                            </span>
                            <span className="text-slate-400">
                              Rally {m.longestRally} · {m.dateLabel}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </section>

          <footer className="border-t border-slate-900 py-6 px-6 text-center text-xs text-slate-500">
            Bastion Strike · 3D International Championship Volleyball · Daily Challenges & Friend
            Rooms
          </footer>
        </main>
      )}

      {/*=====================================================================
        ACTIVE 3D STADIUM VIEWPORT (PLAYING / PAUSED / ROUND_SUMMARY / GAME_OVER)
      ======================================================================*/}
      {gameState !== GameState.TITLE_MENU && (
        <div className="relative flex-1 min-h-[calc(100vh-57px)] w-full overflow-hidden bg-slate-950">
          {/* Isolated Full-Viewport 3D WebGL Canvas */}
          <div className="absolute inset-0">
            <VolleyballScene3D
              simStateRef={simStateRef}
              cameraPreset={cameraPreset}
              perspectiveSide={mySide}
              ballSkin={dailyProgress.equippedSkin}
              onTickFrame={handleSceneTick}
            />
          </div>

          {/* Unobtrusive Top-Center Broadcast Scoreboard (Zero backdrop-filter over WebGL) */}
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 w-[min(700px,94vw)] pointer-events-none">
            <div className="bg-slate-950/92 border border-slate-800 rounded-xl px-4 py-2.5 shadow-lg space-y-1.5">
              <div className="flex items-center justify-between gap-3">
                {/* Left Team */}
                <div className="flex items-center gap-3 min-w-0">
                  <div className="text-left min-w-0">
                    <div className="text-xs font-semibold text-slate-100 truncate">
                      {hud.leftNation} · {hud.leftCallsign}
                    </div>
                    <div className="text-[11px] font-mono tabular-nums text-slate-400">
                      Touches: {hud.leftTouches}/3 · Surge: {hud.leftSurge}%
                    </div>
                  </div>
                </div>

                {/* Score Center */}
                <div className="flex flex-col items-center shrink-0 px-3">
                  <div className="font-mono text-2xl sm:text-3xl font-bold tracking-tight text-slate-50 tabular-nums">
                    <span className={hud.servingSide === 'left' ? 'text-amber-400' : ''}>
                      {String(hud.leftScore).padStart(2, '0')}
                    </span>
                    <span className="mx-2 text-slate-600">:</span>
                    <span className={hud.servingSide === 'right' ? 'text-amber-400' : ''}>
                      {String(hud.rightScore).padStart(2, '0')}
                    </span>
                  </div>
                  <div className="text-[11px] text-amber-400 font-medium truncate max-w-[230px]">
                    {hud.callout}
                  </div>
                </div>

                {/* Right Team */}
                <div className="flex items-center gap-3 min-w-0 text-right">
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-slate-100 truncate">
                      {hud.rightCallsign} · {hud.rightNation}
                    </div>
                    <div className="text-[11px] font-mono tabular-nums text-slate-400">
                      Touches: {hud.rightTouches}/3 · Surge: {hud.rightSurge}%
                    </div>
                  </div>
                </div>
              </div>

              {liveChallengeObjectiveText && (
                <div className="pt-1.5 border-t border-slate-800/90 text-center text-[11px] font-mono tabular-nums text-emerald-400">
                  {liveChallengeObjectiveText}
                </div>
              )}
            </div>
          </div>

          {/* Mobile / Family On-Screen Touch Gamepad (when enabled) */}
          {showTouchPad && gameState === GameState.PLAYING && (
            <div className="absolute inset-x-4 bottom-20 z-20 flex items-end justify-between pointer-events-none">
              <div className="grid grid-cols-3 gap-1.5 pointer-events-auto bg-slate-950/85 p-2 rounded-xl border border-slate-800">
                <div />
                <button
                  type="button"
                  onPointerDown={() => {
                    touchInputRef.current.moveZ = -1;
                  }}
                  onPointerUp={() => {
                    touchInputRef.current.moveZ = 0;
                  }}
                  onPointerLeave={() => {
                    touchInputRef.current.moveZ = 0;
                  }}
                  className="w-12 h-12 rounded-lg bg-slate-800 active:bg-amber-500 active:text-slate-950 text-xs font-bold text-slate-100 flex items-center justify-center select-none"
                >
                  Up
                </button>
                <div />
                <button
                  type="button"
                  onPointerDown={() => {
                    touchInputRef.current.moveX = -1;
                  }}
                  onPointerUp={() => {
                    touchInputRef.current.moveX = 0;
                  }}
                  onPointerLeave={() => {
                    touchInputRef.current.moveX = 0;
                  }}
                  className="w-12 h-12 rounded-lg bg-slate-800 active:bg-amber-500 active:text-slate-950 text-xs font-bold text-slate-100 flex items-center justify-center select-none"
                >
                  Left
                </button>
                <button
                  type="button"
                  onPointerDown={() => {
                    touchInputRef.current.moveZ = 1;
                  }}
                  onPointerUp={() => {
                    touchInputRef.current.moveZ = 0;
                  }}
                  onPointerLeave={() => {
                    touchInputRef.current.moveZ = 0;
                  }}
                  className="w-12 h-12 rounded-lg bg-slate-800 active:bg-amber-500 active:text-slate-950 text-xs font-bold text-slate-100 flex items-center justify-center select-none"
                >
                  Down
                </button>
                <button
                  type="button"
                  onPointerDown={() => {
                    touchInputRef.current.moveX = 1;
                  }}
                  onPointerUp={() => {
                    touchInputRef.current.moveX = 0;
                  }}
                  onPointerLeave={() => {
                    touchInputRef.current.moveX = 0;
                  }}
                  className="w-12 h-12 rounded-lg bg-slate-800 active:bg-amber-500 active:text-slate-950 text-xs font-bold text-slate-100 flex items-center justify-center select-none"
                >
                  Right
                </button>
              </div>

              <div className="flex items-center gap-2.5 pointer-events-auto">
                <button
                  type="button"
                  onPointerDown={() => {
                    touchInputRef.current.divePressed = true;
                  }}
                  onPointerUp={() => {
                    touchInputRef.current.divePressed = false;
                  }}
                  onPointerLeave={() => {
                    touchInputRef.current.divePressed = false;
                  }}
                  className="w-16 h-16 rounded-xl bg-slate-900/95 border border-slate-700 active:bg-emerald-500 active:text-slate-950 text-xs font-bold text-slate-100 select-none"
                >
                  Dive
                </button>
                <button
                  type="button"
                  onPointerDown={() => {
                    touchInputRef.current.actionPressed = true;
                  }}
                  onPointerUp={() => {
                    touchInputRef.current.actionPressed = false;
                  }}
                  onPointerLeave={() => {
                    touchInputRef.current.actionPressed = false;
                  }}
                  className="w-20 h-20 rounded-xl bg-amber-500 active:bg-amber-400 text-xs font-bold text-slate-950 shadow-md select-none"
                >
                  Jump / Spike
                </button>
              </div>
            </div>
          )}

          {/* Unified Collapsible Bottom Control Dock (Zero Side-Panel Clutter) */}
          <div
            className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 w-[min(860px,95vw)] transition-transform duration-200"
            style={{
              transform: dockCollapsed
                ? 'translate(-50%, calc(100% - 28px))'
                : 'translate(-50%, 0)',
            }}
          >
            <div className="flex justify-center mb-1">
              <button
                type="button"
                onClick={() => setDockCollapsed((prev) => !prev)}
                className="px-3 py-1 text-[11px] font-medium bg-slate-950/92 border border-slate-800 rounded-t-lg text-slate-300 hover:text-slate-100 inline-flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0"
              >
                {dockCollapsed ? (
                  <>
                    <ChevronUp className="w-3.5 h-3.5" />
                    <span>Show Controls (H)</span>
                  </>
                ) : (
                  <>
                    <ChevronDown className="w-3.5 h-3.5" />
                    <span>Hide Controls (H)</span>
                  </>
                )}
              </button>
            </div>

            <div className="bg-slate-950/94 border border-slate-800 rounded-xl px-4 py-2.5 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-lg border border-slate-800">
                {(
                  [
                    { id: 'broadcast', label: 'Broadcast Cam' },
                    { id: 'pro_behind', label: 'Pro 3D Cam' },
                    { id: 'sky', label: 'Sky Cam' },
                  ] as { id: CameraPreset; label: string }[]
                ).map((cam) => (
                  <button
                    key={cam.id}
                    type="button"
                    onClick={() => setCameraPreset(cam.id)}
                    className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                      cameraPreset === cam.id
                        ? 'bg-amber-500 text-slate-950 font-semibold'
                        : 'text-slate-300 hover:text-slate-100'
                    }`}
                  >
                    {cam.label}
                  </button>
                ))}
              </div>

              <div className="hidden lg:flex items-center gap-2 text-xs text-slate-400 font-mono">
                <span>Move: WASD / Arrows</span>
                <span>·</span>
                <span>Spike / Block: Space</span>
                <span>·</span>
                <span>Dive: Shift</span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowTouchPad((prev) => !prev)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg border cursor-pointer whitespace-nowrap shrink-0 ${
                    showTouchPad
                      ? 'bg-slate-800 text-amber-400 border-amber-500/40'
                      : 'bg-slate-900 text-slate-300 border-slate-800 hover:text-slate-100'
                  }`}
                >
                  Touch Pad
                </button>

                <button
                  type="button"
                  onClick={handleToggleMute}
                  aria-label={muted ? 'Unmute audio' : 'Mute audio'}
                  className="px-3 py-1.5 text-xs font-medium bg-slate-900 border border-slate-800 rounded-lg text-slate-200 hover:bg-slate-800 inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
                >
                  {muted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                  <span>{muted ? 'Muted' : 'Sound On'}</span>
                </button>

                {matchMode !== 'online' && gameState === GameState.PLAYING && (
                  <button
                    type="button"
                    onClick={() => setGameState(GameState.PAUSED)}
                    className="px-3 py-1.5 text-xs font-medium bg-slate-900 border border-slate-800 rounded-lg text-slate-200 hover:bg-slate-800 inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
                  >
                    <Pause className="w-3.5 h-3.5" />
                    <span>Pause</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/*=================================================================
            PAUSED MODAL OVERLAY
          ==================================================================*/}
          {gameState === GameState.PAUSED && (
            <div className="absolute inset-0 z-30 flex items-center justify-center bg-slate-950/85 p-6">
              <div className="w-full max-w-md rounded-xl bg-slate-900 border border-slate-800 p-6 space-y-5 text-center">
                <div className="space-y-1">
                  <h2 className="font-display text-2xl font-bold text-slate-50">Match Paused</h2>
                  <p className="text-sm text-slate-400 font-mono tabular-nums">
                    {hud.leftNation} {hud.leftScore} — {hud.rightScore} {hud.rightNation}
                  </p>
                </div>

                <div className="flex flex-col gap-2.5">
                  <button
                    type="button"
                    onClick={() => setGameState(GameState.PLAYING)}
                    className="w-full py-2.5 px-4 text-sm font-semibold bg-amber-500 text-slate-950 rounded-lg hover:bg-amber-400 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                  >
                    Resume Match
                  </button>
                  <button
                    type="button"
                    onClick={handlePlayAgain}
                    className="w-full py-2.5 px-4 text-sm font-medium bg-slate-800 text-slate-100 rounded-lg hover:bg-slate-700 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                  >
                    Restart Match
                  </button>
                  <button
                    type="button"
                    onClick={handleLeaveToMenu}
                    className="w-full py-2.5 px-4 text-sm font-medium text-slate-400 hover:text-slate-100 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                  >
                    Return to Main Menu
                  </button>
                </div>
              </div>
            </div>
          )}

          {/*=================================================================
            WORLD TOUR STAGE VICTORY (ROUND_SUMMARY) MODAL
          ==================================================================*/}
          {gameState === GameState.ROUND_SUMMARY && (
            <div className="absolute inset-0 z-30 flex items-center justify-center bg-slate-950/88 p-6">
              <div className="w-full max-w-lg rounded-xl bg-slate-900 border border-slate-800 p-6 space-y-6">
                <div className="space-y-1 text-center">
                  <div className="text-xs text-emerald-400 font-semibold">
                    World Tour Stage 0{tourStageIdx + 1} Cleared
                  </div>
                  <h2 className="font-display text-3xl font-bold text-slate-50">
                    {hud.leftNation} Advances!
                  </h2>
                  <p className="text-sm text-slate-400">
                    Next Opponent:{' '}
                    {getNationByCode(WORLD_TOUR_STAGES[tourStageIdx + 1]?.opponentNation || 'BRA')
                      .country}{' '}
                    ({WORLD_TOUR_STAGES[tourStageIdx + 1]?.title})
                  </p>
                </div>

                <div className="grid grid-cols-3 gap-4 pt-2 border-t border-slate-800 text-center font-mono tabular-nums">
                  <div>
                    <div className="text-xs text-slate-400">Final Score</div>
                    <div className="text-lg font-bold text-slate-50 mt-0.5">
                      {hud.leftScore} - {hud.rightScore}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-400">Longest Rally</div>
                    <div className="text-lg font-bold text-amber-400 mt-0.5">
                      {hud.longestRally} Hits
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-400">Spike Winners</div>
                    <div className="text-lg font-bold text-emerald-400 mt-0.5">
                      {simStateRef.current.leftSpikesScored}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={startNextWorldTourStage}
                    className="flex-1 py-2.5 px-4 text-sm font-semibold bg-amber-500 text-slate-950 rounded-lg hover:bg-amber-400 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                  >
                    Play Next Round
                  </button>
                  <button
                    type="button"
                    onClick={handleLeaveToMenu}
                    className="py-2.5 px-4 text-sm font-medium bg-slate-800 text-slate-200 rounded-lg hover:bg-slate-700 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                  >
                    Main Menu
                  </button>
                </div>
              </div>
            </div>
          )}

          {/*=================================================================
            MATCH COMPLETE / GAME OVER MODAL (INCLUDING DAILY CHALLENGE REWARD)
          ==================================================================*/}
          {gameState === GameState.GAME_OVER && (
            <div className="absolute inset-0 z-30 flex items-center justify-center bg-slate-950/88 p-6">
              <div className="w-full max-w-lg rounded-xl bg-slate-900 border border-slate-800 p-6 space-y-6">
                <div className="text-center space-y-2">
                  <Trophy
                    className={`w-9 h-9 mx-auto ${
                      challengeOutcome
                        ? challengeOutcome.succeeded
                          ? 'text-emerald-400'
                          : 'text-slate-400'
                        : 'text-amber-400'
                    }`}
                  />
                  <h2 className="font-display text-3xl font-bold text-slate-50">
                    {challengeOutcome
                      ? challengeOutcome.succeeded
                        ? `${challengeOutcome.challengeTitle} Cleared!`
                        : `${challengeOutcome.challengeTitle} Incomplete`
                      : hud.winnerSide === mySide
                        ? 'Victory on the World Court!'
                        : 'Match Complete'}
                  </h2>
                  <p className="text-sm text-slate-300 font-mono tabular-nums">
                    {hud.leftNation} ({hud.leftCallsign}) {hud.leftScore} — {hud.rightScore}{' '}
                    {hud.rightNation} ({hud.rightCallsign})
                  </p>
                </div>

                {challengeOutcome && (
                  <div className="py-3.5 border-y border-slate-800 space-y-2 text-center">
                    <div className="text-xs font-medium text-slate-300">
                      {challengeOutcome.detailText}
                    </div>
                    {challengeOutcome.succeeded && (
                      <div className="text-xs text-emerald-400 font-semibold">
                        Unlocked & Equipped: {challengeOutcome.rewardSkinName} · Title:{' '}
                        {challengeOutcome.rewardTitle}
                        {challengeOutcome.newlyRewardedToday
                          ? ` · +${challengeOutcome.rewardCoins} Tour Coins`
                          : ''}
                      </div>
                    )}
                  </div>
                )}

                <div className="grid grid-cols-3 gap-4 text-center font-mono tabular-nums">
                  <div>
                    <div className="text-xs text-slate-400">Longest Rally</div>
                    <div className="text-lg font-bold text-amber-400 mt-0.5">
                      {hud.longestRally}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-400">Spikes Scored</div>
                    <div className="text-lg font-bold text-slate-100 mt-0.5">
                      {simStateRef.current.leftSpikesScored} -{' '}
                      {simStateRef.current.rightSpikesScored}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-400">Net Blocks</div>
                    <div className="text-lg font-bold text-emerald-400 mt-0.5">
                      {simStateRef.current.leftTotalBlocks} -{' '}
                      {simStateRef.current.rightTotalBlocks}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={handlePlayAgain}
                    className="flex-1 py-2.5 px-4 text-sm font-semibold bg-amber-500 text-slate-950 rounded-lg hover:bg-amber-400 transition-colors cursor-pointer inline-flex items-center justify-center gap-2 whitespace-nowrap shrink-0"
                  >
                    <RotateCcw className="w-4 h-4" />
                    <span>
                      {matchMode === 'daily_challenge' &&
                      challengeOutcome &&
                      !challengeOutcome.succeeded
                        ? 'Retry Challenge'
                        : 'Play Again'}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={handleLeaveToMenu}
                    className="py-2.5 px-4 text-sm font-medium bg-slate-800 text-slate-200 rounded-lg hover:bg-slate-700 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                  >
                    Main Menu
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
