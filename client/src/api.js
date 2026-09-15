async function request(path, { method = "GET", token, body } = {}) {
  const response = await fetch(path, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({ error: "Request failed" }));
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
  createSession: (preferredId) => request("/api/session", { method: "POST", body: { preferredId } }),
  deleteSession: (token) => request("/api/session", { method: "DELETE", token }),
  bootstrap: (token) => request("/api/bootstrap", { token }),
  createRoom: (token, payload) => request("/api/rooms", { method: "POST", token, body: payload }),
  joinRoom: (token, roomCode) => request("/api/rooms/join", { method: "POST", token, body: { roomCode } }),
  leaveRoom: (token) => request("/api/rooms/leave", { method: "POST", token }),
  startRound: (token, roomCode, roundId) => request("/api/rounds/start", { method: "POST", token, body: { roomCode, roundId } }),
  submitPrompt: (token, roomCode, word, roundId) =>
    request("/api/rounds/prompt", { method: "POST", token, body: { roomCode, word, roundId } }),
  submitGuess: (token, roomCode, guess, roundId) =>
    request("/api/rounds/guess", { method: "POST", token, body: { roomCode, guess, roundId } }),
  judgeGuess: (token, roomCode, guessId, accepted, roundId) =>
    request("/api/rounds/judge", { method: "POST", token, body: { roomCode, guessId, accepted, roundId } }),
  createPack: (token, payload) => request("/api/packs", { method: "POST", token, body: payload }),
};
