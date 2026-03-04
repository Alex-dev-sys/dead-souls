import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { spawn, ChildProcessWithoutNullStreams } from "node:child_process";
import { io, Socket } from "socket.io-client";

const BASE_URL = "http://localhost:3000";
const TEST_TIMEOUT = 60_000;

function onceEvent<T>(socket: Socket, event: string, timeoutMs = 12_000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(event, handler);
      reject(new Error(`Timeout waiting event '${event}'`));
    }, timeoutMs);

    const handler = (payload: T) => {
      clearTimeout(timer);
      socket.off(event, handler);
      resolve(payload);
    };
    socket.on(event, handler);
  });
}

function connectClient(): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const socket = io(BASE_URL, {
      transports: ["websocket"],
      forceNew: true,
      reconnection: false,
    });
    const timer = setTimeout(() => {
      socket.disconnect();
      reject(new Error("Socket connect timeout"));
    }, 10_000);

    socket.on("connect", () => {
      clearTimeout(timer);
      resolve(socket);
    });
    socket.on("connect_error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

function waitServerReady(process: ChildProcessWithoutNullStreams): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Server start timeout")), 25_000);

    process.stdout.on("data", (chunk) => {
      const line = chunk.toString();
      if (line.includes("Ready on http://localhost:3000")) {
        clearTimeout(timer);
        resolve();
      }
    });

    process.stderr.on("data", (chunk) => {
      const line = chunk.toString();
      if (line.toLowerCase().includes("eaddrinuse")) {
        clearTimeout(timer);
        reject(new Error(line));
      }
    });

    process.on("exit", (code) => {
      clearTimeout(timer);
      reject(new Error(`Server exited early with code ${code}`));
    });
  });
}

async function createJoinedHost() {
  const host = await connectClient();
  host.emit("create_room");
  const roomId = await onceEvent<string>(host, "room_created");
  host.emit("join_room", roomId);
  const joined = await onceEvent<{ roomId: string; playerId: string; nickname: string; reconnectToken: string }>(host, "joined_room");
  return { host, roomId, joined };
}

let devServer: ChildProcessWithoutNullStreams;
let spawnedByTests = false;

async function isServerReachable(): Promise<boolean> {
  try {
    const socket = await connectClient();
    socket.disconnect();
    return true;
  } catch {
    return false;
  }
}

describe("socket multiplayer integration", () => {
  beforeAll(async () => {
    if (await isServerReachable()) {
      return;
    }

    spawnedByTests = true;
    devServer = spawn("npm run dev", [], {
      cwd: process.cwd(),
      env: process.env,
      stdio: "pipe",
      shell: true,
    });
    await waitServerReady(devServer);
  }, TEST_TIMEOUT);

  afterAll(async () => {
    if (spawnedByTests && devServer && !devServer.killed) {
      devServer.kill("SIGTERM");
    }
  });

  it(
    "creates room and returns reconnect token on join",
    async () => {
      const { host, roomId, joined } = await createJoinedHost();
      try {
        expect(roomId).toHaveLength(4);
        expect(joined.roomId).toBe(roomId);
        expect(joined.reconnectToken).toMatch(/^[a-f0-9]{32}$/);

        const roomUpdate = await onceEvent<{ players: Array<{ nickname: string }> }>(host, "room_update");
        expect(roomUpdate.players.length).toBe(1);
      } finally {
        host.disconnect();
      }
    },
    TEST_TIMEOUT
  );

  it(
    "starts game with two players and assigns roles",
    async () => {
      const { host, roomId } = await createJoinedHost();
      const guest = await connectClient();
      try {
        guest.emit("join_room", roomId);
        await onceEvent(guest, "joined_room");
        host.emit("start_game", roomId);

        const playingRoom = await new Promise<{ status: string; players: Array<{ role: string | null }> }>((resolve, reject) => {
          const timer = setTimeout(() => reject(new Error("No playing room_update")), 12_000);
          const handler = (room: { status: string; players: Array<{ role: string | null }> }) => {
            if (room.status === "playing") {
              clearTimeout(timer);
              host.off("room_update", handler);
              resolve(room);
            }
          };
          host.on("room_update", handler);
        });

        expect(playingRoom.status).toBe("playing");
        expect(playingRoom.players.length).toBeGreaterThanOrEqual(2);
        expect(playingRoom.players.every((p) => p.role !== null)).toBe(true);
      } finally {
        guest.disconnect();
        host.disconnect();
      }
    },
    TEST_TIMEOUT
  );

  it(
    "rejects invalid rejoin token and allows valid rejoin",
    async () => {
      const { host, roomId, joined } = await createJoinedHost();
      const attacker = await connectClient();
      try {
        attacker.emit("rejoin_game", { roomId, reconnectToken: "bad-token" });
        const errorMsg = await onceEvent<string>(attacker, "error_msg");
        expect(errorMsg).toBe("Игрок не найден");

        host.disconnect();

        const restored = await connectClient();
        try {
          restored.emit("rejoin_game", { roomId, reconnectToken: joined.reconnectToken });
          const rejoined = await onceEvent<{ nickname: string; reconnectToken: string }>(restored, "joined_room");
          expect(rejoined.nickname).toBe(joined.nickname);
          expect(rejoined.reconnectToken).toBe(joined.reconnectToken);
        } finally {
          restored.disconnect();
        }
      } finally {
        attacker.disconnect();
      }
    },
    TEST_TIMEOUT
  );
});
