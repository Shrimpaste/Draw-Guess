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
    throw new Error(payload.error || "Request failed");
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
  startRound: (token, roomCode) => request("/api/rounds/start", { method: "POST", token, body: { roomCode } }),
  submitPrompt: (token, roomCode, word) =>
    request("/api/rounds/prompt", { method: "POST", token, body: { roomCode, word } }),
  submitGuess: (token, roomCode, guess) =>
    request("/api/rounds/guess", { method: "POST", token, body: { roomCode, guess } }),
  judgeGuess: (token, roomCode, guesserId, accepted) =>
    request("/api/rounds/judge", { method: "POST", token, body: { roomCode, guesserId, accepted } }),
  createPack: (token, payload) => request("/api/packs", { method: "POST", token, body: payload }),
};
