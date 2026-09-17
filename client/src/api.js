async function request(path, { method = "GET", token, body, adminKey } = {}) {
  const response = await fetch(path, {
    method,
    signal: AbortSignal.timeout(15000),
    headers: {
      "Content-Type": "application/json",
      ...(adminKey ? { "x-admin-key": adminKey } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const payload = await response
      .json()
      .catch(() => ({ error: "Request failed" }));
    const error = new Error(payload.error || "Request failed");
    error.status = response.status;
    throw error;
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

export const api = {
  adminPacks: (token, adminKey) =>
    request("/api/admin/packs", { token, adminKey }),
  approvePack: (token, adminKey, id) =>
    request(`/api/admin/packs/${encodeURIComponent(id)}/approve`, {
      method: "POST",
      token,
      adminKey,
    }),
  deletePack: (token, adminKey, id) =>
    request(`/api/admin/packs/${encodeURIComponent(id)}`, {
      method: "DELETE",
      token,
      adminKey,
    }),
  createSession: (preferredId) =>
    request("/api/session", { method: "POST", body: { preferredId } }),
  deleteSession: (token) =>
    request("/api/session", { method: "DELETE", token }),
  bootstrap: (token) => request("/api/bootstrap", { token }),
  createRoom: (token, payload) =>
    request("/api/rooms", { method: "POST", token, body: payload }),
  joinRoom: (token, roomCode) =>
    request("/api/rooms/join", { method: "POST", token, body: { roomCode } }),
  leaveRoom: (token) => request("/api/rooms/leave", { method: "POST", token }),
  startRound: (token, roomCode, roundId) =>
    request("/api/rounds/start?compact=1", {
      method: "POST",
      token,
      body: { roomCode, roundId },
    }),
  skipRound: (token, roomCode, roundId) =>
    request("/api/rounds/skip?compact=1", {
      method: "POST",
      token,
      body: { roomCode, roundId },
    }),
  submitPrompt: (token, roomCode, word, roundId) =>
    request("/api/rounds/prompt?compact=1", {
      method: "POST",
      token,
      body: { roomCode, word, roundId },
    }),
  submitGuess: (token, roomCode, guess, roundId, clientGuessId) =>
    request("/api/rounds/guess?compact=1", {
      method: "POST",
      token,
      body: { roomCode, guess, roundId, clientGuessId },
    }),
  judgeGuess: (token, roomCode, guessId, accepted, roundId) =>
    request("/api/rounds/judge?compact=1", {
      method: "POST",
      token,
      body: { roomCode, guessId, accepted, roundId },
    }),
  createPack: (token, payload) =>
    request("/api/packs", { method: "POST", token, body: payload }),
};
