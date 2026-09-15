import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "./createApp.js";
import { config } from "./config.js";

let app;

async function createSession(preferredId) {
  const response = await request(app).post("/api/session").send({ preferredId });
  return response.body.player;
}

beforeEach(() => {
  app = createApp();
});

afterEach(() => app.get("store").dispose());

describe("session and rooms", () => {
  it("uses an isolated database and requires explicit admin credentials", async () => {
    expect(config.databasePath).toBe(":memory:");
    const user = await createSession("AdminCheck");
    const denied = await request(app).get("/api/admin/packs").set("Authorization", `Bearer ${user.token}`).set("x-admin-key", "local-admin-key");
    expect(denied.status).toBe(403);
    const allowed = await request(app).get("/api/admin/packs").set("Authorization", `Bearer ${user.token}`).set("x-admin-key", "test-admin-key");
    expect(allowed.status).toBe(200);
  });

  it("keeps pending submissions private and reports duplicate pack names", async () => {
    const user = await createSession("Submitter");
    const payload = { name: `词包${Date.now()}`, description: "这个词包用于验证审核隔离", words: ["火箭", "鲸鱼", "钢琴", "灯塔"] };
    const created = await request(app).post("/api/packs").set("Authorization", `Bearer ${user.token}`).send(payload);
    expect(created.status).toBe(201);
    expect(created.body.submittedPack.status).toBe("pending");
    expect(created.body.packs.every((pack) => pack.status === "approved")).toBe(true);
    const duplicate = await request(app).post("/api/packs").set("Authorization", `Bearer ${user.token}`).send(payload);
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.error).toBe("PACK_NAME_TAKEN");
  });
  it("creates unique temporary ids", async () => {
    const first = await createSession("Painter");
    const second = await createSession("Painter");
    expect(first.id).toBe("Painter");
    expect(second.id).not.toBe("Painter");
  });

  it("supports room creation and join", async () => {
    const host = await createSession("Host");
    const guest = await createSession("Guest");

    const created = await request(app)
      .post("/api/rooms")
      .set("Authorization", `Bearer ${host.token}`)
      .send({ name: "Studio", mode: "library", packIds: ["pack-core"] });

    const code = created.body.room.code;
    const joined = await request(app)
      .post("/api/rooms/join")
      .set("Authorization", `Bearer ${guest.token}`)
      .send({ roomCode: code });

    expect(joined.body.room.players).toHaveLength(2);
  });

  it("finishes a library round on exact match", async () => {
    const host = await createSession("Host2");
    const guest = await createSession("Guest2");

    const created = await request(app)
      .post("/api/rooms")
      .set("Authorization", `Bearer ${host.token}`)
      .send({ name: "Arena", mode: "library", packIds: ["pack-core"] });

    const code = created.body.room.code;
    await request(app)
      .post("/api/rooms/join")
      .set("Authorization", `Bearer ${guest.token}`)
      .send({ roomCode: code });

    const started = await request(app)
      .post("/api/rounds/start")
      .set("Authorization", `Bearer ${host.token}`)
      .send({ roomCode: code, roundId: created.body.room.round.id });

    const store = app.get("store");
    const word = store.getRoom(code).round.word;
    const guesserToken = started.body.room.round.drawerId === host.id ? guest.token : host.token;
    const guessed = await request(app)
      .post("/api/rounds/guess")
      .set("Authorization", `Bearer ${guesserToken}`)
      .send({ roomCode: code, guess: word, roundId: started.body.room.round.id });

    expect(guessed.body.room.round.status).toBe("finished");
    expect(guessed.body.room.round.winnerIds).toHaveLength(1);
  });
});
