import express from 'express';
import { createServer } from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocket, WebSocketServer } from 'ws';
import {
  createInitialSimState,
  stepMatchPhysics,
} from './src/shared/volleyballRules.ts';
import type {
  PlayerInputState,
  SimMatchState,
  SoundTrigger,
  TeamSide,
} from './src/shared/volleyballRules.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface ClientConn {
  id: string;
  playerCode: string;
  ws: WebSocket;
  callsign: string;
  nationCode: string;
  roomCode: string | null;
  side: TeamSide | null;
  inQueue: boolean;
  targetPoints: number;
  input: PlayerInputState;
}

interface OnlineRoom {
  code: string;
  isPublic: boolean;
  targetPoints: number;
  leftClient: ClientConn | null;
  rightClient: ClientConn | null;
  state: SimMatchState;
  createdAt: number;
}

interface PendingInvite {
  id: string;
  fromClientId: string;
  toClientId: string;
  targetPoints: number;
  createdAt: number;
}

const clients = new Map<string, ClientConn>();
const rooms = new Map<string, OnlineRoom>();
const invites = new Map<string, PendingInvite>();

function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 5; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return rooms.has(code) ? generateRoomCode() : code;
}

function generateUniquePlayerCode(preferred?: string): string {
  const cleaned = (preferred || '').replace(/[^A-Z0-9]/gi, '').toUpperCase().slice(0, 6);
  const takenCodes = new Set(Array.from(clients.values()).map((c) => c.playerCode));
  if (cleaned.length >= 4 && !takenCodes.has(cleaned)) {
    return cleaned;
  }
  const digits = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += digits[Math.floor(Math.random() * digits.length)];
  }
  return takenCodes.has(code) ? generateUniquePlayerCode() : code;
}

function sendJson(ws: WebSocket, payload: unknown): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(payload));
  }
}

function buildLobbySnapshot() {
  const openRooms = Array.from(rooms.values())
    .filter((r) => r.isPublic && ((r.leftClient && !r.rightClient) || (!r.leftClient && r.rightClient)))
    .map((r) => {
      const host = r.leftClient || r.rightClient!;
      return {
        code: r.code,
        hostCallsign: host.callsign,
        hostNation: host.nationCode,
        targetPoints: r.targetPoints,
        isPublic: r.isPublic,
      };
    });

  const onlinePlayers = Array.from(clients.values()).map((c) => ({
    playerCode: c.playerCode,
    callsign: c.callsign,
    nationCode: c.nationCode,
    status: c.roomCode && rooms.get(c.roomCode)?.leftClient && rooms.get(c.roomCode)?.rightClient
      ? 'in_match'
      : c.inQueue
        ? 'searching'
        : 'available',
  }));

  return {
    type: 'lobby:update',
    onlineCount: clients.size,
    queueCount: Array.from(clients.values()).filter((c) => c.inQueue).length,
    activeMatches: Array.from(rooms.values()).filter((r) => r.leftClient && r.rightClient).length,
    openRooms,
    onlinePlayers,
  };
}

function broadcastLobby(): void {
  const snap = buildLobbySnapshot();
  for (const client of clients.values()) {
    sendJson(client.ws, snap);
  }
}

function removeClientFromCurrentRoom(client: ClientConn): void {
  if (!client.roomCode) return;
  const room = rooms.get(client.roomCode);
  client.roomCode = null;
  client.side = null;
  if (!room) return;

  if (room.leftClient?.id === client.id) room.leftClient = null;
  if (room.rightClient?.id === client.id) room.rightClient = null;

  const remaining = room.leftClient || room.rightClient;
  if (!remaining) {
    rooms.delete(room.code);
  } else {
    sendJson(remaining.ws, {
      type: 'room:opponent_left',
      roomCode: room.code,
      message: `${client.callsign} (${client.nationCode}) disconnected from the match.`,
    });
    rooms.delete(room.code);
    remaining.roomCode = null;
    remaining.side = null;
  }
  broadcastLobby();
}

function startOrSyncRoom(room: OnlineRoom): void {
  if (room.leftClient && room.rightClient) {
    room.state = createInitialSimState(
      room.leftClient.nationCode,
      room.leftClient.callsign,
      room.rightClient.nationCode,
      room.rightClient.callsign,
      room.targetPoints,
    );
    const basePayload = {
      type: 'room:started',
      roomCode: room.code,
      targetPoints: room.targetPoints,
      state: room.state,
    };
    sendJson(room.leftClient.ws, { ...basePayload, yourSide: 'left' });
    sendJson(room.rightClient.ws, { ...basePayload, yourSide: 'right' });
  } else {
    const waiting = room.leftClient || room.rightClient;
    if (waiting) {
      sendJson(waiting.ws, {
        type: 'room:waiting',
        roomCode: room.code,
        yourSide: waiting === room.leftClient ? 'left' : 'right',
        targetPoints: room.targetPoints,
      });
    }
  }
  broadcastLobby();
}

function tryMatchmakeQueue(): void {
  const queued = Array.from(clients.values()).filter((c) => c.inQueue && !c.roomCode);
  while (queued.length >= 2) {
    const p1 = queued.shift()!;
    const p2 = queued.shift()!;
    p1.inQueue = false;
    p2.inQueue = false;

    const code = generateRoomCode();
    const targetPoints = p1.targetPoints || 11;
    p1.roomCode = code;
    p1.side = 'left';
    p2.roomCode = code;
    p2.side = 'right';

    const room: OnlineRoom = {
      code,
      isPublic: true,
      targetPoints,
      leftClient: p1,
      rightClient: p2,
      state: createInitialSimState(p1.nationCode, p1.callsign, p2.nationCode, p2.callsign, targetPoints),
      createdAt: Date.now(),
    };
    rooms.set(code, room);
    startOrSyncRoom(room);
  }
}

async function startServer() {
  const app = express();
  app.use(express.json());

  app.get('/api/lobby', (_req, res) => {
    res.json(buildLobbySnapshot());
  });

  const httpServer = createServer(app);
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  wss.on('connection', (ws) => {
    const clientId = `plr_${Math.random().toString(36).slice(2, 10)}`;
    const playerCode = generateUniquePlayerCode();
    const client: ClientConn = {
      id: clientId,
      playerCode,
      ws,
      callsign: 'Player',
      nationCode: 'IND',
      roomCode: null,
      side: null,
      inQueue: false,
      targetPoints: 11,
      input: { moveX: 0, moveZ: 0, actionPressed: false, divePressed: false },
    };
    clients.set(clientId, client);

    sendJson(ws, { type: 'connected', clientId, playerCode });
    broadcastLobby();

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(String(raw));
        if (!msg || typeof msg.type !== 'string') return;

        switch (msg.type) {
          case 'profile:set': {
            if (typeof msg.callsign === 'string' && msg.callsign.trim()) {
              client.callsign = msg.callsign.trim().slice(0, 18);
            }
            if (typeof msg.nationCode === 'string') {
              client.nationCode = msg.nationCode.slice(0, 3).toUpperCase();
            }
            if (typeof msg.targetPoints === 'number' && [7, 11, 15].includes(msg.targetPoints)) {
              client.targetPoints = msg.targetPoints;
            }
            if (typeof msg.preferredCode === 'string' && msg.preferredCode.trim()) {
              const desired = msg.preferredCode.trim().toUpperCase();
              if (desired !== client.playerCode) {
                const conflict = Array.from(clients.values()).some(
                  (c) => c.id !== client.id && c.playerCode === desired,
                );
                if (!conflict && desired.length >= 4 && desired.length <= 6) {
                  client.playerCode = desired;
                  sendJson(ws, { type: 'profile:code_confirmed', playerCode: client.playerCode });
                }
              }
            }
            broadcastLobby();
            break;
          }

          case 'invite:send': {
            const targetCode = String(msg.targetCode || '')
              .replace(/^#/, '')
              .trim()
              .toUpperCase();
            if (!targetCode || targetCode === client.playerCode) {
              sendJson(ws, {
                type: 'invite:error',
                message: 'Enter a valid friend or family Player Code to send a request.',
              });
              return;
            }

            const targetClient = Array.from(clients.values()).find(
              (c) => c.playerCode === targetCode,
            );
            if (!targetClient) {
              sendJson(ws, {
                type: 'invite:error',
                message: `Player #${targetCode} is not online right now. Share an Invite Link so they can join directly.`,
              });
              return;
            }

            const targetRoom = targetClient.roomCode ? rooms.get(targetClient.roomCode) : null;
            if (targetRoom && targetRoom.leftClient && targetRoom.rightClient) {
              sendJson(ws, {
                type: 'invite:error',
                message: `${targetClient.callsign} (#${targetCode}) is currently in an active match.`,
              });
              return;
            }

            const pts =
              typeof msg.targetPoints === 'number' && [7, 11, 15].includes(msg.targetPoints)
                ? msg.targetPoints
                : client.targetPoints;

            // Avoid duplicate identical pending invites between same pair
            for (const [existingId, inv] of invites.entries()) {
              if (inv.fromClientId === client.id && inv.toClientId === targetClient.id) {
                invites.delete(existingId);
              }
            }

            const inviteId = `inv_${Math.random().toString(36).slice(2, 10)}`;
            invites.set(inviteId, {
              id: inviteId,
              fromClientId: client.id,
              toClientId: targetClient.id,
              targetPoints: pts,
              createdAt: Date.now(),
            });

            sendJson(ws, {
              type: 'invite:sent',
              inviteId,
              toCallsign: targetClient.callsign,
              toCode: targetClient.playerCode,
              toNation: targetClient.nationCode,
            });

            sendJson(targetClient.ws, {
              type: 'invite:received',
              inviteId,
              fromCallsign: client.callsign,
              fromCode: client.playerCode,
              fromNation: client.nationCode,
              targetPoints: pts,
            });
            break;
          }

          case 'invite:respond': {
            const inviteId = String(msg.inviteId || '');
            const invite = invites.get(inviteId);
            if (!invite || invite.toClientId !== client.id) {
              sendJson(ws, { type: 'invite:error', message: 'This match request has expired.' });
              return;
            }
            invites.delete(inviteId);

            const sender = clients.get(invite.fromClientId);
            if (!sender) {
              sendJson(ws, { type: 'invite:error', message: 'The player who invited you went offline.' });
              return;
            }

            if (!msg.accept) {
              sendJson(sender.ws, {
                type: 'invite:declined',
                byCallsign: client.callsign,
                byCode: client.playerCode,
              });
              return;
            }

            // Pair sender & recipient immediately into a private live 3D room!
            sender.inQueue = false;
            client.inQueue = false;
            removeClientFromCurrentRoom(sender);
            removeClientFromCurrentRoom(client);

            const code = generateRoomCode();
            sender.roomCode = code;
            sender.side = 'left';
            client.roomCode = code;
            client.side = 'right';

            const room: OnlineRoom = {
              code,
              isPublic: false,
              targetPoints: invite.targetPoints,
              leftClient: sender,
              rightClient: client,
              state: createInitialSimState(
                sender.nationCode,
                sender.callsign,
                client.nationCode,
                client.callsign,
                invite.targetPoints,
              ),
              createdAt: Date.now(),
            };
            rooms.set(code, room);
            startOrSyncRoom(room);
            break;
          }

          case 'matchmaking:join': {
            removeClientFromCurrentRoom(client);
            if (typeof msg.callsign === 'string' && msg.callsign.trim()) {
              client.callsign = msg.callsign.trim().slice(0, 18);
            }
            if (typeof msg.nationCode === 'string') {
              client.nationCode = msg.nationCode.slice(0, 3).toUpperCase();
            }
            if (typeof msg.targetPoints === 'number' && [7, 11, 15].includes(msg.targetPoints)) {
              client.targetPoints = msg.targetPoints;
            }
            client.inQueue = true;
            sendJson(ws, { type: 'matchmaking:searching' });
            tryMatchmakeQueue();
            broadcastLobby();
            break;
          }

          case 'matchmaking:cancel': {
            client.inQueue = false;
            sendJson(ws, { type: 'matchmaking:cancelled' });
            broadcastLobby();
            break;
          }

          case 'room:create': {
            client.inQueue = false;
            removeClientFromCurrentRoom(client);
            if (typeof msg.callsign === 'string' && msg.callsign.trim()) {
              client.callsign = msg.callsign.trim().slice(0, 18);
            }
            if (typeof msg.nationCode === 'string') {
              client.nationCode = msg.nationCode.slice(0, 3).toUpperCase();
            }
            const pts =
              typeof msg.targetPoints === 'number' && [7, 11, 15].includes(msg.targetPoints)
                ? msg.targetPoints
                : 11;
            const code = generateRoomCode();
            client.roomCode = code;
            client.side = 'left';

            const room: OnlineRoom = {
              code,
              isPublic: Boolean(msg.isPublic ?? true),
              targetPoints: pts,
              leftClient: client,
              rightClient: null,
              state: createInitialSimState(client.nationCode, client.callsign, 'BRA', 'Opponent', pts),
              createdAt: Date.now(),
            };
            rooms.set(code, room);
            startOrSyncRoom(room);
            break;
          }

          case 'room:join': {
            const code = String(msg.roomCode || '').trim().toUpperCase();
            const room = rooms.get(code);
            if (!room) {
              sendJson(ws, { type: 'room:error', message: `Room ${code} was not found or has closed.` });
              return;
            }
            if (room.leftClient && room.rightClient) {
              sendJson(ws, { type: 'room:error', message: `Room ${code} already has two players.` });
              return;
            }
            client.inQueue = false;
            removeClientFromCurrentRoom(client);
            if (typeof msg.callsign === 'string' && msg.callsign.trim()) {
              client.callsign = msg.callsign.trim().slice(0, 18);
            }
            if (typeof msg.nationCode === 'string') {
              client.nationCode = msg.nationCode.slice(0, 3).toUpperCase();
            }

            if (!room.leftClient) {
              room.leftClient = client;
              client.side = 'left';
            } else {
              room.rightClient = client;
              client.side = 'right';
            }
            client.roomCode = room.code;
            startOrSyncRoom(room);
            break;
          }

          case 'room:rematch': {
            if (!client.roomCode) return;
            const room = rooms.get(client.roomCode);
            if (room && room.leftClient && room.rightClient && room.state.phase === 'finished') {
              startOrSyncRoom(room);
            }
            break;
          }

          case 'room:leave': {
            client.inQueue = false;
            removeClientFromCurrentRoom(client);
            break;
          }

          case 'player:input': {
            client.input = {
              moveX: Math.max(-1, Math.min(1, Number(msg.moveX) || 0)),
              moveZ: Math.max(-1, Math.min(1, Number(msg.moveZ) || 0)),
              actionPressed: Boolean(msg.actionPressed),
              divePressed: Boolean(msg.divePressed),
            };
            break;
          }
        }
      } catch {
        // Ignore malformed JSON frames
      }
    });

    ws.on('close', () => {
      for (const [invId, inv] of invites.entries()) {
        if (inv.fromClientId === clientId || inv.toClientId === clientId) {
          invites.delete(invId);
        }
      }
      clients.delete(clientId);
      removeClientFromCurrentRoom(client);
      broadcastLobby();
    });
  });

  // Authoritative 60Hz Server Simulation Loop, broadcasting snapshots at 30Hz
  let tickCount = 0;
  const dt = 1 / 60;
  const pendingSoundsByRoom = new Map<string, SoundTrigger[]>();

  setInterval(() => {
    tickCount += 1;
    for (const room of rooms.values()) {
      if (!room.leftClient || !room.rightClient) continue;

      const sounds = stepMatchPhysics(
        room.state,
        room.leftClient.input,
        room.rightClient.input,
        dt,
      );

      if (sounds.length > 0) {
        const list = pendingSoundsByRoom.get(room.code) || [];
        list.push(...sounds);
        pendingSoundsByRoom.set(room.code, list);
      }

      if (tickCount % 2 === 0) {
        const roomSounds = pendingSoundsByRoom.get(room.code) || [];
        pendingSoundsByRoom.set(room.code, []);
        const packet = {
          type: 'match:state',
          state: room.state,
          sounds: roomSounds,
        };
        sendJson(room.leftClient.ws, packet);
        sendJson(room.rightClient.ws, packet);
      }
    }
  }, 1000 / 60);

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const PORT = 3000;
  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Bastion Strike 3D Volleyball Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
