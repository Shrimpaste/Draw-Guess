import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "./createApp.js";
import { resetPlayers } from "./db.js";

let app;

async function createSession(preferredId) {
  const response = await request(app).post("/api/session").send({ preferredId });
  return response.body.player;
}

beforeEach(() => {
  resetPlayers();
  app = createApp();
});

describe("session and rooms", () => {
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
      .send({ roomCode: code });

    const store = app.get("store");
    const word = store.getRoom(code).round.word;
    const guesserToken = started.body.room.round.drawerId === host.id ? guest.token : host.token;
    const guessed = await request(app)
      .post("/api/rounds/guess")
      .set("Authorization", `Bearer ${guesserToken}`)
      .send({ roomCode: code, guess: word });

    expect(guessed.body.room.round.status).toBe("finished");
    expect(guessed.body.room.round.winnerIds).toHaveLength(1);
  });
});
