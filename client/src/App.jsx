import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { useGameConnection } from "./hooks/useGameConnection.js";
import { api } from "./api.js";
import { errorText } from "./errors.js";
import { Button } from "./components/ui/button.jsx";
import { ConfirmAction } from "./components/ui/overlay.jsx";
import { Input } from "./components/ui/field.jsx";
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
  async function gameAction(task) {
    applyResponse(await task(), session?.token);
    return true;
  }
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
    <div className={`app-shell ${room ? "in-room" : ""}`}>
      <header className="site-header">
        <a className="brand" href="/" aria-label="InkMuse 首页">
          ink<span>muse</span>
          <i>你画我猜</i>
        </a>
        {session && (
          <div className="header-actions">
            <span
              className={`connection connection-${connection}`}
              role="status"
            >
              {connectionLabels[connection]}
            </span>
            <span className="identity">{player?.id || session.id}</span>
            {room &&
            ["active", "collecting-word"].includes(room.round.status) ? (
              <ConfirmAction
                title="离开正在进行的对局？"
                description="如果你是画师或出题者，本轮会随之结束。"
                confirmText="离开房间"
                onConfirm={() => mutate(() => api.leaveRoom(session.token))}
              >
                <Button variant="outline" disabled={busy}>
                  返回大厅
                </Button>
              </ConfirmAction>
            ) : (
              <Button
                variant="outline"
                disabled={busy}
                onClick={() =>
                  room
                    ? mutate(() => api.leaveRoom(session.token))
                    : mutate(async () => {
                        await api.deleteSession(session.token);
                        setSession(null);
                      })
                }
              >
                {room ? "返回大厅" : "退出"}
              </Button>
            )}
          </div>
        )}
      </header>
      {feedback && (
        <div className="feedback feedback-error" role="alert">
          {feedback}
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
        <main className="login-layout">
          <section className="login-intro">
            <span className="eyebrow">一支画笔，一群朋友</span>
            <h1>
              画得随意，
              <br />
              猜得尽兴<span>。</span>
            </h1>
            <p>
              让灵感落在纸上，
              <br />
              让朋友接住你的奇思妙想。
            </p>
            <div className="ink-sketch" aria-hidden="true">
              <svg viewBox="0 0 380 170" fill="none">
                <path
                  d="M24 120Q56 70 106 105T199 90T310 94M244 39l48-19-9 46-39-27ZM55 37q-6-17 10-21t15 16l-8 21-17-16Z"
                  stroke="currentColor"
                  strokeWidth="4"
                  strokeLinecap="round"
                />
                <circle
                  cx="330"
                  cy="133"
                  r="19"
                  stroke="#ff5b36"
                  strokeWidth="5"
                />
                <path
                  d="m157 28 7 19 20 1-16 13 4 20-17-12-17 11 6-20-15-14 20 1Z"
                  stroke="#ff5b36"
                  strokeWidth="3"
                />
              </svg>
            </div>
            <small>2–10 人 · 无需注册 · 一起玩一会儿</small>
          </section>
          <form
            className="login-form stack"
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
            <span className="eyebrow">很高兴见到你</span>
            <h2>进入大厅</h2>
            <label>
              怎么称呼你？
              <Input
                pattern="[\p{L}\p{N}\s_\-]+"
                maxLength={18}
                value={preferredId}
                onChange={(event) => setPreferredId(event.target.value)}
                placeholder="留空也可以，帮你取个名字"
                autoComplete="nickname"
              />
            </label>
            <small>支持中英文、数字、空格、下划线与短横线。</small>
            <Button type="submit" pending={!!busy}>
              {busy ? "正在连接…" : "开始玩 →"}
            </Button>
            <p className="muted">
              临时身份保存在当前浏览器。离开后断线保留 60 秒。
            </p>
          </form>
        </main>
      ) : room ? (
        <Suspense
          fallback={
            <main className="page-loading" role="status">
              画室正在准备中…
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
            onGuess={(guess) =>
              gameAction(() =>
                api.submitGuess(session.token, room.code, guess, room.round.id),
              )
            }
            onPrompt={(word) =>
              gameAction(() =>
                api.submitPrompt(session.token, room.code, word, room.round.id),
              )
            }
            onJudge={(id, accepted) =>
              gameAction(() =>
                api.judgeGuess(
                  session.token,
                  room.code,
                  id,
                  accepted,
                  room.round.id,
                ),
              )
            }
            onCanvas={(type, stroke) =>
              send({
                type,
                ...(stroke ? { stroke } : {}),
                roundId: room.round.id,
                epoch: room.canvasEpoch,
              })
            }
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
              toast.success("投稿成功，审核通过后大家就可以选用这个词包了。");
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
