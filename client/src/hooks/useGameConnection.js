import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../api.js";
import { applyCanvasEvent, applyRoomUpdate } from "../canvasState.js";

const emptyState = { player: null, room: null, lobby: [], packs: [], modeDescriptions: [], revision: -1 };

export function useGameConnection(token, onExpired) {
  const [state, setState] = useState(emptyState);
  const [connection, setConnection] = useState("offline");
  const [error, setError] = useState("");
  const socketRef = useRef(null);
  const tokenRef = useRef(token);
  tokenRef.current = token;
  const expiredRef = useRef(onExpired);
  expiredRef.current = onExpired;

  const applyResponse = useCallback((payload, sourceToken) => {
    if (sourceToken && sourceToken !== tokenRef.current) return;
    if (!payload) return;
    setState((previous) => {
      if (payload.revision !== undefined && payload.revision < previous.revision) return previous;
      const next = { ...previous };
      if (payload.revision !== undefined) next.revision = payload.revision;
      if (payload.type === "canvas:stroke" || payload.type === "canvas:snapshot") {
        try { next.room = applyCanvasEvent(previous.room, payload); }
        catch { return { ...previous, desynced: true }; }
        return next;
      }
      for (const key of ["player", "packs", "modeDescriptions", "lobby"]) {
        if (payload[key] !== undefined) next[key] = payload[key];
      }
      if (Object.hasOwn(payload, "room") && (payload.revision ?? 0) >= previous.revision) {
        try { next.room = applyRoomUpdate(previous.room, payload.room); }
        catch { return { ...previous, desynced: true }; }
        next.desynced = false;
        next.revision = payload.revision ?? 0;
      }
      return next;
    });
  }, []);

  useEffect(() => {
    if (state.desynced) socketRef.current?.close();
  }, [state.desynced]);

  useEffect(() => {
    setState(emptyState);
    setError("");
    if (!token) { setConnection("offline"); return; }
    let stopped = false;
    let timer;
    let socket;
    let attempt = 0;
    const expire = () => {
      if (stopped) return;
      stopped = true;
      setConnection("offline");
      expiredRef.current();
    };
    const retry = () => {
      if (stopped) return;
      setConnection("reconnecting");
      clearTimeout(timer);
      timer = setTimeout(connect, Math.min(800 * 2 ** attempt++, 5000));
    };
    const connect = async () => {
      if (stopped) return;
      setConnection(attempt ? "reconnecting" : "connecting");
      try {
        const payload = await api.bootstrap(token);
        if (stopped) return;
        applyResponse(payload);
      } catch (issue) {
        if (stopped) return;
        if (issue.status === 401) expire();
        else retry();
        return;
      }
      const protocol = location.protocol === "https:" ? "wss" : "ws";
      socket = new WebSocket(`${protocol}://${location.host}/ws?token=${encodeURIComponent(token)}&compact=1`);
      socketRef.current = socket;
      socket.onopen = () => {
        if (stopped) return socket.close();
        attempt = 0;
        setConnection("online");
        setError("");
      };
      socket.onmessage = (event) => {
        if (stopped) return;
        try {
          const payload = JSON.parse(event.data);
          if (["connected", "room:update", "lobby:update", "canvas:stroke", "canvas:snapshot"].includes(payload.type)) applyResponse(payload);
          if (payload.type === "error") setError(payload.error);
        } catch { setError("实时消息无法读取，请重新进入房间。"); }
      };
      socket.onclose = (event) => event.code === 4001 ? expire() : retry();
      socket.onerror = () => { if (!stopped) setConnection("reconnecting"); };
    };
    connect();
    return () => {
      stopped = true;
      clearTimeout(timer);
      socket?.close();
      socketRef.current = null;
    };
  }, [token, applyResponse]);

  const send = useCallback((payload) => {
    if (socketRef.current?.readyState !== WebSocket.OPEN) {
      setError("连接正在恢复，请稍后继续作画。");
      return false;
    }
    socketRef.current.send(JSON.stringify(payload));
    return true;
  }, []);
  return { ...state, connection, connectionError: error, clearConnectionError: () => setError(""), send, applyResponse };
}
