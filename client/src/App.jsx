import { useEffect, useState } from "react";
import { useGameConnection } from "./hooks/useGameConnection.js";
import { api } from "./api.js";
import { errorText } from "./errors.js";
import { Button } from "./components/ui/button.jsx";
import { ConfirmAction } from "./components/ui/overlay.jsx";
import { GameRoom, modes } from "./components/GameRoom.jsx";
import { PackAdmin, PackSubmission } from "./components/PackDialogs.jsx";

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
  const [notice, setNotice] = useState("");
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
    }
  }, [session]);
  useEffect(() => {
    setError("");
    setNotice("");
  }, [room?.code]);
  async function gameAction(task) {
    applyResponse(await task(), session?.token);
    return true;
  }
  async function mutate(task) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      applyResponse(await task(), session?.token);
      return true;
    } catch (issue) {
      setError(errorText(issue));
      return false;
    } finally {
      setBusy(false);
    }
  }
  const disabled = busy || connection !== "online";
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
      {notice && (
        <p className="feedback feedback-success" role="status">
          {notice}
        </p>
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
              <input
                maxLength={18}
                value={preferredId}
                onChange={(event) => setPreferredId(event.target.value)}
                placeholder="留空也可以，帮你取个名字"
                autoComplete="nickname"
              />
            </label>
            <small>支持中英文、数字、空格、下划线与短横线。</small>
            <button className="primary-button" disabled={busy}>
              {busy ? "正在连接…" : "开始玩 →"}
            </button>
            <p className="muted">
              临时身份保存在当前浏览器。离开后断线保留 60 秒。
            </p>
          </form>
        </main>
      ) : room ? (
        <GameRoom
          room={room}
          connection={connection}
          busy={busy}
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
      ) : (
        <main className="lobby">
          <div className="lobby-heading">
            <div>
              <span className="eyebrow">找个位置，落笔吧</span>
              <h1>今天，画点什么？</h1>
            </div>
            <button type="button" onClick={() => setDialog("submit")}>
              ＋ 投稿词包
            </button>
          </div>
          <div className="lobby-layout">
            <section className="compose-panel">
              <h2>开一间画室</h2>
              <form
                className="stack"
                onSubmit={(event) => {
                  event.preventDefault();
                  mutate(() => api.createRoom(session.token, roomForm));
                }}
              >
                <label>
                  房间名称
                  <input
                    required
                    maxLength={32}
                    value={roomForm.name}
                    onChange={(event) =>
                      setRoomForm({ ...roomForm, name: event.target.value })
                    }
                  />
                </label>
                <fieldset className="mode-picker">
                  <legend>玩法</legend>
                  {Object.entries(modes).map(([id, name]) => (
                    <label key={id}>
                      <input
                        type="radio"
                        name="mode"
                        checked={roomForm.mode === id}
                        onChange={() => setRoomForm({ ...roomForm, mode: id })}
                      />
                      {name}
                    </label>
                  ))}
                </fieldset>
                <p className="mode-description">
                  {roomForm.mode === "library"
                    ? "至少 2 人。随机抽词，一人画，其余人猜；第一个猜中即结算。"
                    : "至少 3 人。一人出题、一人画，其余人猜；由出题者逐条裁定。"}
                </p>
                {roomForm.mode === "library" && (
                  <details className="pack-picker">
                    <summary>
                      词包{" "}
                      <span>
                        {roomForm.packIds.length
                          ? `已选 ${roomForm.packIds.length} 个`
                          : "默认词包"}
                      </span>
                    </summary>
                    <div>
                      {packs.map((pack) => (
                        <label key={pack.id}>
                          <input
                            type="checkbox"
                            checked={roomForm.packIds.includes(pack.id)}
                            disabled={
                              roomForm.packIds.length >= 6 &&
                              !roomForm.packIds.includes(pack.id)
                            }
                            onChange={() =>
                              setRoomForm({
                                ...roomForm,
                                packIds: roomForm.packIds.includes(pack.id)
                                  ? roomForm.packIds.filter(
                                      (id) => id !== pack.id,
                                    )
                                  : [...roomForm.packIds, pack.id],
                              })
                            }
                          />
                          <span>
                            <strong>{pack.name}</strong>
                            <small>
                              {pack.description} · {pack.wordCount} 词
                            </small>
                          </span>
                        </label>
                      ))}
                    </div>
                  </details>
                )}
                <button className="primary-button" disabled={disabled}>
                  创建房间 →
                </button>
              </form>
            </section>
            <section className="room-wall" aria-label="大厅房间">
              <form
                className="join-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  mutate(() =>
                    api.joinRoom(session.token, joinCode.trim().toUpperCase()),
                  );
                }}
              >
                <label className="sr-only" htmlFor="room-code">
                  房间码
                </label>
                <input
                  id="room-code"
                  placeholder="输入 5 位房间码"
                  maxLength={5}
                  minLength={5}
                  required
                  value={joinCode}
                  onChange={(event) =>
                    setJoinCode(event.target.value.toUpperCase())
                  }
                />
                <button disabled={disabled || joinCode.trim().length !== 5}>
                  加入朋友
                </button>
              </form>
              <div className="section-heading">
                <h2>正在开放的画室</h2>
                <span>{lobby.length} 间</span>
              </div>
              {!lobby.length && (
                <div className="empty-lobby">
                  <span aria-hidden="true">✳</span>
                  <h3>第一笔，等你来画</h3>
                  <p>创建房间，把房间码分享给朋友。</p>
                </div>
              )}
              <div className="room-list">
                {lobby.map((item) => (
                  <article key={item.code} className="room-tile">
                    <div>
                      <span className="eyebrow">
                        {modes[item.mode]} · {item.playerCount}/10 人
                      </span>
                      <h3>{item.name}</h3>
                      <small>
                        {item.code} ·{" "}
                        {["active", "collecting-word"].includes(item.status)
                          ? "正在游戏"
                          : "等待新一轮"}
                      </small>
                    </div>
                    <button
                      disabled={disabled || item.playerCount >= 10}
                      onClick={() =>
                        mutate(() => api.joinRoom(session.token, item.code))
                      }
                    >
                      {item.playerCount >= 10 ? "已满" : "进入 →"}
                    </button>
                  </article>
                ))}
              </div>
            </section>
          </div>
          <footer className="lobby-footer">
            <p>
              每轮作画 100 秒 · 裁定局出题 30 秒 · 猜中 +2 分，画师和出题者各 +1
              分
            </p>
            <button onClick={() => setDialog("admin")}>词包审核</button>
          </footer>
        </main>
      )}
      {session && dialog === "submit" && (
        <PackSubmission
          onClose={() => setDialog(null)}
          onSubmit={async (payload) => {
            applyResponse(
              await api.createPack(session.token, payload),
              session.token,
            );
            setDialog(null);
            setNotice("投稿成功，审核通过后大家就可以选用这个词包了。");
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
    </div>
  );
}
