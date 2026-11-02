import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useGameConnection } from "./hooks/useGameConnection.js";
import { api } from "./api.js";
import { errorText } from "./errors.js";
import { Button } from "./components/ui/button.jsx";
import { ConfirmAction } from "./components/ui/overlay.jsx";
import { Input } from "./components/ui/field.jsx";
import { SketchIcon } from "./components/ui/sketch-icon.jsx";
import { InkWord } from "./components/ink/InkWord.jsx";
import { inkLabels } from "./components/ink/labels.js";
import { setSoundEnabled, unlockSound, useSoundEnabled } from "./sound.js";
import { Toaster, toast } from "sonner";
const Lobby = lazy(() =>
  import("./components/Lobby.jsx").then((module) => ({
    default: module.Lobby,
  })),
);
const GameRoom = lazy(() =>
  import("./components/GameRoom.jsx").then((module) => ({
    default: module.GameRoom,
  })),
);
const PackSubmission = lazy(() =>
  import("./components/PackDialogs.jsx").then((module) => ({
    default: module.PackSubmission,
  })),
);
const PackAdmin = lazy(() =>
  import("./components/PackDialogs.jsx").then((module) => ({
    default: module.PackAdmin,
  })),
);
const DemoSketch = lazy(() =>
  import("./components/DemoSketch.jsx").then((module) => ({
    default: module.DemoSketch,
  })),
);
const HowToPlay = lazy(() =>
  import("./components/HowToPlay.jsx").then((module) => ({
    default: module.HowToPlay,
  })),
);
const emptyDraft = { name: "", description: "", words: "" };

function savedSession() {
  try {
    const saved = JSON.parse(localStorage.getItem("draw-guess-session"));
    return typeof saved?.token === "string" ? saved : null;
  } catch {
    return null;
  }
}
const connectionLabels = {
  online: "已连接",
  connecting: "正在连接",
  reconnecting: "正在重连 · 房间保留 60 秒",
  offline: "未连接",
};

function Brand() {
  return (
    <a className="brand" href="/" aria-label="InkMuse 首页">
      <svg viewBox="0 0 36 40" aria-hidden="true">
        <path d="M6 31 22 4l8 4.5L14 36 6 31Z" fill="#bc9244" />
        <path d="M22 4l8 4.5-2.4 4-8-4.4Z" fill="#ad5541" />
        <path d="m6 31-2.4 7.4 8.6-2.6M22 4l8 4.5M9.6 32.6 25.4 6.3" stroke="#504936" fill="none" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M17 36.5q7-8.6 15.5-3.4" stroke="#ad5541" fill="none" strokeWidth="2" strokeLinecap="round" />
      </svg>
      <span>InkMuse</span>
      <i>你画我猜</i>
    </a>
  );
}

function SoundToggle() {
  const enabled = useSoundEnabled();
  return (
    <Button
      variant="ghost"
      size="icon"
      className="sound-toggle"
      aria-label="声音"
      aria-pressed={enabled}
      title={enabled ? "声音：开" : "声音：关"}
      onClick={() => {
        unlockSound();
        setSoundEnabled(!enabled);
      }}
    >
      <SketchIcon name={enabled ? "sound" : "mute"} size={22} />
    </Button>
  );
}

export default function App() {
  const [session, setSession] = useState(savedSession);
  const [preferredId, setPreferredId] = useState("");
  const [roomForm, setRoomForm] = useState({
    name: "午后速写室",
    mode: "library",
    packIds: [],
  });
  const [joinCode, setJoinCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [packDraft, setPackDraft] = useState(emptyDraft);
  const inFlight = useRef(false);
  const [dialog, setDialog] = useState(null);
  const [rulesOpen, setRulesOpen] = useState(false);
  const {
    player,
    room,
    lobby,
    packs,
    connection,
    connectionError,
    clearConnectionError,
    send,
    applyResponse,
  } = useGameConnection(session?.token, () => {
    setSession(null);
    setError("会话已过期或服务已重启，请重新进入大厅。");
  });
  useEffect(() => {
    if (session)
      localStorage.setItem("draw-guess-session", JSON.stringify(session));
    else {
      localStorage.removeItem("draw-guess-session");
      setDialog(null);
      setPackDraft(emptyDraft);
    }
  }, [session]);
  useEffect(() => {
    setError("");
  }, [room?.code]);
  useEffect(() => {
    // Browsers only allow audio after a gesture; the first press anywhere unlocks it.
    const unlock = () => {
      unlockSound();
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", unlock);
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);
  async function gameAction(task) {
    applyResponse(await task(), session?.token);
    return true;
  }
  const guess = useCallback(async (text, clientGuessId) => {
    applyResponse(await api.submitGuess(session.token, room.code, text, room.round.id, clientGuessId), session.token);
    return true;
  }, [session?.token, room?.code, room?.round.id, applyResponse]);
  const judge = useCallback(async (id, accepted) => {
    applyResponse(await api.judgeGuess(session.token, room.code, id, accepted, room.round.id), session.token);
    return true;
  }, [session?.token, room?.code, room?.round.id, applyResponse]);
  const draw = useCallback((type, stroke) => send({ type, ...(stroke ? { stroke } : {}), roundId: room.round.id, epoch: room.canvasEpoch }), [send, room?.round.id, room?.canvasEpoch]);
  async function mutate(task, action = "navigation") {
    if (inFlight.current) return false;
    inFlight.current = true;
    setBusy(action);
    setError("");
    try {
      applyResponse(await task(), session?.token);
      return true;
    } catch (issue) {
      setError(errorText(issue));
      return false;
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }
  const disabled = !!busy || connection !== "online";
  const feedback = error || errorText(connectionError);
  return (
    <div className={`app-shell ${room ? "in-room" : session ? "in-lobby" : "at-entry"}`}>
      <header className="site-header">
        <Brand />
        <div className="header-actions">
          {session && (
            <>
              <span
                className={`connection connection-${connection}`}
                role="status"
              >
                <i aria-hidden="true" />
                {connectionLabels[connection]}
              </span>
              <span className="identity" title="当前昵称">
                {player?.id || session.id}
              </span>
            </>
          )}
          <Button variant="ghost" className="header-rules" onClick={() => setRulesOpen(true)}>
            <SketchIcon name="help" />
            <span className="label-text">玩法</span>
          </Button>
          <SoundToggle />
          {session &&
            (room &&
            ["active", "collecting-word"].includes(room.round.status) ? (
              <ConfirmAction
                title="离开正在进行的对局？"
                description="如果你是画师或出题者，本轮会随之结束。"
                confirmText="离开房间"
                onConfirm={() => mutate(() => api.leaveRoom(session.token))}
              >
                <Button variant="outline" disabled={!!busy}>
                  <SketchIcon name="leave" />
                  返回大厅
                </Button>
              </ConfirmAction>
            ) : (
              <Button
                variant="outline"
                disabled={!!busy}
                onClick={() =>
                  room
                    ? mutate(() => api.leaveRoom(session.token))
                    : mutate(async () => {
                        await api.deleteSession(session.token);
                        setSession(null);
                      })
                }
              >
                <SketchIcon name="leave" />
                {room ? "返回大厅" : "退出"}
              </Button>
            ))}
        </div>
      </header>
      {feedback && (
        <div className="feedback feedback-error" role="alert">
          <span>{feedback}</span>
          <button
            type="button"
            onClick={() => {
              setError("");
              clearConnectionError();
            }}
          >
            知道了
          </button>
        </div>
      )}
      {!session ? (
        <main className="entry">
          <section className="entry-slip paper-sheet">
            <span className="paper-tape" aria-hidden="true" />
            <h1>
              <InkWord text={inkLabels.enter} />
            </h1>
            <form
              className="stack"
              onSubmit={async (event) => {
                event.preventDefault();
                await mutate(async () => {
                  const result = await api.createSession(
                    preferredId.trim() || undefined,
                  );
                  setSession(result.player);
                });
              }}
            >
              <label className="ui-field">
                <span>昵称</span>
                <Input
                  pattern="[\p{L}\p{N}\s_\-]+"
                  maxLength={18}
                  value={preferredId}
                  onChange={(event) => setPreferredId(event.target.value)}
                  placeholder="留空自动取名"
                  autoComplete="nickname"
                />
                <small className="field-hint">中英文、数字、空格、下划线或短横线</small>
              </label>
              <Button type="submit" size="lg" pending={!!busy}>
                {busy ? "正在连接…" : "进入"}
                {!busy && <SketchIcon name="arrow" />}
              </Button>
            </form>
            <p className="entry-meta">临时身份只保存在本浏览器 · 断线后保留 60 秒</p>
          </section>
          <Suspense fallback={<div className="demo" aria-hidden="true" />}>
            <DemoSketch onRules={() => setRulesOpen(true)} />
          </Suspense>
        </main>
      ) : room ? (
        <Suspense
          fallback={
            <main className="page-loading" role="status">
              正在进入房间…
            </main>
          }
        >
          <GameRoom
            room={room}
            connection={connection}
            busy={!!busy}
            onStart={() =>
              gameAction(() =>
                api.startRound(session.token, room.code, room.round.id),
              )
            }
            onSkip={() =>
              gameAction(() =>
                api.skipRound(session.token, room.code, room.round.id),
              )
            }
            onGuess={guess}
            onPrompt={(word) =>
              gameAction(() =>
                api.submitPrompt(session.token, room.code, word, room.round.id),
              )
            }
            onJudge={judge}
            onCanvas={draw}
          />
        </Suspense>
      ) : (
        <Suspense
          fallback={
            <main className="page-loading" role="status">
              正在打开大厅…
            </main>
          }
        >
          <Lobby
            roomForm={roomForm}
            setRoomForm={setRoomForm}
            joinCode={joinCode}
            setJoinCode={setJoinCode}
            packs={packs}
            lobby={lobby}
            disabled={disabled}
            busy={busy === "create"}
            pendingJoin={busy}
            onDialog={setDialog}
            onCreate={() =>
              mutate(() => api.createRoom(session.token, roomForm), "create")
            }
            onJoin={(code) =>
              mutate(() => api.joinRoom(session.token, code), `join:${code}`)
            }
          />
        </Suspense>
      )}
      {rulesOpen && (
        <Suspense fallback={null}>
          <HowToPlay open onOpenChange={setRulesOpen} />
        </Suspense>
      )}
      <Suspense
        fallback={
          <p className="feedback" role="status">
            正在打开…
          </p>
        }
      >
        {session && dialog === "submit" && (
          <PackSubmission
            draft={packDraft}
            onDraftChange={setPackDraft}
            onClose={() => setDialog(null)}
            onSubmit={async (payload) => {
              applyResponse(
                await api.createPack(session.token, payload),
                session.token,
              );
              setDialog(null);
              setPackDraft(emptyDraft);
              toast.success("已提交，审核通过后可在建房时选用。");
            }}
          />
        )}
        {session && dialog === "admin" && (
          <PackAdmin
            token={session.token}
            onClose={() => setDialog(null)}
            onChanged={() =>
              api
                .bootstrap(session.token)
                .then((payload) => applyResponse(payload, session.token))
                .catch(() => {})
            }
          />
        )}
      </Suspense>
      <Toaster
        position="top-center"
        closeButton
        containerAriaLabel="通知"
        toastOptions={{
          className: "ink-toast",
          closeButtonAriaLabel: "关闭通知",
        }}
      />
    </div>
  );
}
