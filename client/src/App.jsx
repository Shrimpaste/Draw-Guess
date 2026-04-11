import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "./api.js";
import { CanvasBoard } from "./components/CanvasBoard.jsx";

const defaultRoomForm = {
  name: "月光画室",
  mode: "library",
  packIds: [],
};

const defaultPackForm = {
  name: "",
  description: "",
  words: "",
};

const statusTextMap = {
  waiting: "等待开局",
  "collecting-word": "等待出题",
  active: "正在作画",
  finished: "本轮结束",
};

const modeTextMap = {
  library: "公共词库局",
  "host-judged": "灵感裁判局",
};

function getMemberTags(member, room, me) {
  const tags = [];
  if (member.id === me?.id) tags.push("我");
  if (member.id === room?.round?.drawerId) tags.push("画师");
  if (member.id === room?.round?.prompterId) tags.push("出题");
  if (room?.round?.viewerIsGuesser && member.id === me?.id) tags.push("猜词");
  return tags;
}

function Feedback({ error, loading, room }) {
  if (error) {
    return <div className="feedback-banner feedback-error">{error}</div>;
  }
  if (loading) {
    return <div className="feedback-banner feedback-info">正在同步房间状态…</div>;
  }
  if (room?.round?.status === "finished") {
    return <div className="feedback-banner feedback-success">本轮已结算，房主可以随时开启下一回合。</div>;
  }
  return null;
}

function ModeSummary({ mode }) {
  if (mode === "host-judged") {
    return (
      <>
        <h4>灵感裁判局</h4>
        <p>一人给词，一人作画，其余玩家猜测，由给词者决定答案是否命中。</p>
      </>
    );
  }

  return (
    <>
      <h4>公共词库局</h4>
      <p>从已审核词库中随机抽题，系统自动判断标准答案，节奏更快更清晰。</p>
    </>
  );
}

function LoginHero() {
  return (
    <section className="login-intro panel page-enter">
      <div className="intro-mark">InkMuse</div>
      <h1>把你画我猜做成真正有氛围的实时房间。</h1>
      <p className="intro-text">创建临时身份，进入大厅，快速切换到作画、猜词与裁定的完整现场。</p>

      <div className="feature-columns">
        <article className="feature-block">
          <span className="feature-kicker">房间流程</span>
          <h3>从创建到开局都保持清晰</h3>
          <p>大厅、房间、作画阶段和裁定状态都能持续可见，不会被琐碎操作打断。</p>
        </article>
        <article className="feature-block">
          <span className="feature-kicker">实时对局</span>
          <h3>画布永远是主角</h3>
          <p>作画板保持中心位置，猜词、分数、提示词和玩家状态围绕它自然展开。</p>
        </article>
      </div>

      <div className="intro-ribbon">
        <div className="ribbon-stat">
          <span>玩法模式</span>
          <strong>词库局 / 裁判局</strong>
        </div>
        <div className="ribbon-stat">
          <span>实时同步</span>
          <strong>画布与房间状态</strong>
        </div>
        <div className="ribbon-stat">
          <span>词包投稿</span>
          <strong>支持审核后发布</strong>
        </div>
      </div>
    </section>
  );
}

function RoomTile({ item, onJoin }) {
  return (
    <article className="room-tile room-tile-animated" key={item.code}>
      <div className={`room-accent room-accent-${item.status}`} />
      <div className="room-tile-head">
        <div>
          <span className="room-code">{item.code}</span>
          <h3>{item.name}</h3>
        </div>
        <span className="room-state">{statusTextMap[item.status] || item.status}</span>
      </div>
      <div className="room-tile-body">
        <p>{modeTextMap[item.mode] || item.mode}</p>
      </div>
      <div className="room-tile-meta">
        <span>{item.playerCount} 人在线</span>
        <button className="primary-button enter-button" onClick={onJoin}>
          进入房间
          <span className="enter-arrow">→</span>
        </button>
      </div>
    </article>
  );
}

function StatusPanel({ room, roleLabel, isHost, loading, onStartRound }) {
  return (
    <section className="panel section-card room-side-panel">
      <div className="round-banner">
        <div>
          <p className="eyebrow">回合桌面</p>
          <h2>{roleLabel}</h2>
        </div>
        {isHost ? (
          <button className="primary-button primary-button-glow" onClick={onStartRound} disabled={loading}>
            开始回合
          </button>
        ) : null}
      </div>

      <div className="round-summary">
        <div className="summary-item">
          <span>状态</span>
          <strong>{statusTextMap[room.round.status] || room.round.status}</strong>
        </div>
        <div className="summary-item">
          <span>画师</span>
          <strong>{room.round.drawerId || "待定"}</strong>
        </div>
        <div className="summary-item">
          <span>给词者</span>
          <strong>{room.round.prompterId || "系统词库"}</strong>
        </div>
        <div className="summary-item">
          <span>提示</span>
          <strong>{room.round.maskedWord || "隐藏中"}</strong>
        </div>
      </div>
    </section>
  );
}

function RoundWrapup({ room }) {
  const winnerIds = room?.round?.winnerIds || [];
  const winners = room.players.filter((member) => winnerIds.includes(member.id));
  const answerText = room?.round?.word || room?.round?.maskedWord || "本轮答案已揭晓";

  return (
    <section className="round-wrapup panel page-enter">
      <div className="round-wrapup-copy">
        <p className="eyebrow">本轮结算</p>
        <h2>这一轮已经收尾</h2>
        <p className="helper-text">正确答案：{answerText}</p>
      </div>

      <div className="wrapup-strip">
        <article className="wrapup-card">
          <span>本轮状态</span>
          <strong>结算完成</strong>
        </article>
        <article className="wrapup-card">
          <span>命中玩家</span>
          <strong>{winners.length ? winners.map((member) => member.id).join("、") : "本轮无人猜中"}</strong>
        </article>
        <article className="wrapup-card">
          <span>下一步</span>
          <strong>房主可直接开启下一回合</strong>
        </article>
      </div>
    </section>
  );
}

export default function App() {
  const [session, setSession] = useState(null);
  const [player, setPlayer] = useState(null);
  const [lobby, setLobby] = useState([]);
  const [packs, setPacks] = useState([]);
  const [room, setRoom] = useState(null);
  const [modeDescriptions, setModeDescriptions] = useState([]);
  const [roomForm, setRoomForm] = useState(defaultRoomForm);
  const [packForm, setPackForm] = useState(defaultPackForm);
  const [joinCode, setJoinCode] = useState("");
  const [preferredId, setPreferredId] = useState("");
  const [guess, setGuess] = useState("");
  const [promptWord, setPromptWord] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [packPickerOpen, setPackPickerOpen] = useState(false);
  const [packModalOpen, setPackModalOpen] = useState(false);
  const socketRef = useRef(null);
  const reconnectRef = useRef(null);

  const me = room?.me || player;
  const isDrawer = room?.round?.drawerId === me?.id;
  const isPrompter = room?.round?.prompterId === me?.id;
  const isHost = room?.hostId === me?.id;
  const selectedPacks = packs.filter((pack) => roomForm.packIds.includes(pack.id));

  useEffect(() => {
    const saved = localStorage.getItem("draw-guess-session");
    if (!saved) return;
    setSession(JSON.parse(saved));
  }, []);

  async function bootstrap(token) {
    const payload = await api.bootstrap(token);
    setPlayer(payload.player);
    setLobby(payload.lobby);
    setPacks(payload.packs);
    setRoom(payload.room);
    setModeDescriptions(payload.modeDescriptions);
    setRoomForm((prev) => ({
      ...prev,
      packIds: prev.packIds.length ? prev.packIds : payload.packs.slice(0, 1).map((pack) => pack.id),
    }));
  }

  useEffect(() => {
    if (!session?.token) return;

    localStorage.setItem("draw-guess-session", JSON.stringify(session));
    let closedByCleanup = false;

    const connect = async () => {
      try {
        setLoading(true);
        await bootstrap(session.token);
        setError("");
      } catch (issue) {
        setError(issue.message);
        localStorage.removeItem("draw-guess-session");
        setSession(null);
        setLoading(false);
        return;
      }

      const protocol = window.location.protocol === "https:" ? "wss" : "ws";
      const socket = new WebSocket(`${protocol}://${window.location.host}/ws?token=${session.token}`);
      socketRef.current = socket;

      socket.onopen = () => {
        setLoading(false);
      };

      socket.onmessage = (event) => {
        const payload = JSON.parse(event.data);
        if (payload.type === "room:update") {
          setRoom(payload.room);
          setLobby(payload.lobby || []);
        }
        if (payload.type === "connected") {
          setLobby(payload.lobby || []);
        }
        if (payload.type === "error") {
          setError(payload.error || "实时连接异常");
        }
      };

      socket.onclose = () => {
        if (closedByCleanup) return;
        reconnectRef.current = setTimeout(() => {
          connect().catch(() => {});
        }, 1200);
      };
    };

    connect().catch(() => {});

    return () => {
      closedByCleanup = true;
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
      socketRef.current?.close();
    };
  }, [session?.token]);

  async function handleLogin(event) {
    event.preventDefault();
    try {
      setLoading(true);
      const payload = await api.createSession(preferredId);
      setSession(payload.player);
      setError("");
    } catch (issue) {
      setError(issue.message);
      setLoading(false);
    }
  }

  async function handleLogout() {
    if (session?.token) {
      await api.deleteSession(session.token).catch(() => {});
    }
    if (reconnectRef.current) clearTimeout(reconnectRef.current);
    socketRef.current?.close();
    localStorage.removeItem("draw-guess-session");
    setSession(null);
    setPlayer(null);
    setLobby([]);
    setPacks([]);
    setRoom(null);
    setError("");
    setLoading(false);
  }

  async function mutate(task, options = {}) {
    try {
      setLoading(true);
      setError("");
      const payload = await task();
      if (Object.prototype.hasOwnProperty.call(payload || {}, "room")) {
        setRoom(payload.room || null);
      }
      if (payload?.lobby) setLobby(payload.lobby);
      if (payload?.packs) {
        setPacks(payload.packs.filter((pack) => pack.status === "approved" || pack.status === undefined));
      }
      if (options.resetPrompt) setPromptWord("");
      if (options.resetGuess) setGuess("");
      if (options.closePackModal) {
        setPackModalOpen(false);
        setPackForm(defaultPackForm);
      }
    } catch (issue) {
      setError(issue.message);
    } finally {
      setLoading(false);
    }
  }

  function togglePackSelection(packId) {
    setRoomForm((prev) => ({
      ...prev,
      packIds: prev.packIds.includes(packId)
        ? prev.packIds.filter((id) => id !== packId)
        : [...prev.packIds, packId],
    }));
  }

  const roleLabel = useMemo(() => {
    if (!room?.round) return "当前在大厅等待";
    if (isDrawer) return "这一轮由你作画";
    if (isPrompter) return "这一轮由你裁定";
    if (room.round.viewerIsGuesser) return "这一轮由你猜词";
    return "当前正在观战";
  }, [room, isDrawer, isPrompter]);

  function sendStroke(stroke) {
    socketRef.current?.send(JSON.stringify({ type: "canvas:stroke", stroke }));
  }

  function clearCanvas() {
    socketRef.current?.send(JSON.stringify({ type: "canvas:clear" }));
  }

  if (!session) {
    return (
      <div className="app-shell">
        <section className="login-layout">
          <LoginHero />

          <form className="login-panel panel page-enter delay-1" onSubmit={handleLogin}>
            <div className="section-head">
              <div>
                <p className="eyebrow">临时身份</p>
                <h2>进入大厅</h2>
              </div>
            </div>
            <label>
              玩家 ID
              <input value={preferredId} onChange={(event) => setPreferredId(event.target.value)} placeholder="例如 AuroraFox" />
            </label>
            <button className="primary-button primary-button-glow" type="submit" disabled={loading}>
              {loading ? "正在连接…" : "创建临时身份"}
            </button>
            <Feedback error={error} loading={loading} room={null} />
          </form>
        </section>
      </div>
    );
  }

  return (
    <div className="app-shell">
      {!room && (
        <main className="app-layout">
          <header className="topbar panel page-enter">
            <div className="topbar-brand">
              <p className="eyebrow">InkMuse 大厅</p>
              <h1>今夜开局</h1>
            </div>
            <div className="topbar-actions">
              <div className="identity-badge">当前身份 {player?.id}</div>
              <button className="ghost-button" onClick={handleLogout}>
                退出登录
              </button>
            </div>
          </header>

          <Feedback error={error} loading={loading} room={room} />

          <section className="workspace-grid page-enter">
            <aside className="left-column">
              <section className="panel section-card section-card-animated">
                <div className="section-head">
                  <div>
                    <p className="eyebrow">创建房间</p>
                    <h2>开一局新的房间</h2>
                  </div>
                  <button className="ghost-button" onClick={() => setPackModalOpen(true)}>
                    投稿词包
                  </button>
                </div>

                <div className="stack">
                  <label>
                    房间名称
                    <input value={roomForm.name} onChange={(event) => setRoomForm((prev) => ({ ...prev, name: event.target.value }))} />
                  </label>
                  <div className="mode-switch">
                    <button
                      type="button"
                      className={`mode-switch-button ${roomForm.mode === "host-judged" ? "active" : ""}`}
                      onClick={() => setRoomForm((prev) => ({ ...prev, mode: "host-judged", packIds: [] }))}
                    >
                      灵感裁判局
                    </button>
                    <button
                      type="button"
                      className={`mode-switch-button ${roomForm.mode === "library" ? "active" : ""}`}
                      onClick={() => setRoomForm((prev) => ({ ...prev, mode: "library" }))}
                    >
                      公共词库局
                    </button>
                  </div>
                  <div className="info-block mode-summary-block">
                    <ModeSummary mode={roomForm.mode} />
                  </div>
                  {roomForm.mode === "library" && (
                    <div className="selector-card selector-card-animated">
                      <div>
                        <p className="selector-title">已选词包</p>
                        <p className="selector-value">
                          {selectedPacks.length ? selectedPacks.map((pack) => pack.name).join(", ") : "暂未选择词包"}
                        </p>
                      </div>
                      <button className="ghost-button" type="button" onClick={() => setPackPickerOpen(true)}>
                        选择词包
                      </button>
                    </div>
                  )}
                  <button className="primary-button primary-button-glow" onClick={() => mutate(() => api.createRoom(session.token, roomForm))} disabled={loading}>
                    创建并进入
                  </button>
                </div>
              </section>

              <section className="panel section-card section-card-animated delay-1">
                <div className="section-head">
                  <div>
                    <p className="eyebrow">模式说明</p>
                    <h2>选择合适节奏</h2>
                  </div>
                </div>
                <div className="guide-list">
                  {modeDescriptions.map((mode) => (
                    <article className="guide-item guide-item-hover" key={mode.id}>
                      <h3>{mode.title}</h3>
                      <p>{mode.description}</p>
                    </article>
                  ))}
                </div>
              </section>
            </aside>

            <section className="main-column">
              <section className="panel lobby-hero-card section-card section-card-animated">
                <div className="lobby-hero-copy">
                  <p className="eyebrow">实时房间区</p>
                  <h2>加入正在进行的房间，或亲自开启一局。</h2>
                </div>
                <div className="lobby-overview">
                  <article className="overview-card float-card">
                    <span>活跃房间</span>
                    <strong>{lobby.length}</strong>
                  </article>
                  <article className="overview-card float-card">
                    <span>公开词包</span>
                    <strong>{packs.length}</strong>
                  </article>
                  <article className="overview-card float-card">
                    <span>当前身份</span>
                    <strong>{player?.id}</strong>
                  </article>
                </div>
              </section>

              <section className="panel section-card section-card-animated delay-2">
                <div className="section-head lobby-head">
                  <div>
                    <p className="eyebrow">房间列表</p>
                    <h2>大厅中的开放房间</h2>
                  </div>
                  <div className="join-inline">
                    <input value={joinCode} onChange={(event) => setJoinCode(event.target.value.toUpperCase())} placeholder="输入房间码" />
                    <button className="ghost-button" onClick={() => mutate(() => api.joinRoom(session.token, joinCode))}>
                      加入
                    </button>
                  </div>
                </div>

                <div className="room-list">
                  {lobby.map((item) => (
                    <RoomTile key={item.code} item={item} onJoin={() => mutate(() => api.joinRoom(session.token, item.code))} />
                  ))}
                  {!lobby.length && <p className="helper-text">大厅还没有活跃房间。现在就开一局，画下今晚的第一笔。</p>}
                </div>
              </section>
            </section>
          </section>
        </main>
      )}

      {room && (
        <main className="room-page-shell">
          <section className="room-focus page-enter">
            <header className="room-focus-topbar panel room-stage-header">
              <div>
                <p className="eyebrow">房间舞台</p>
                <h1>{room.name}</h1>
                <p className="helper-text">
                  {modeTextMap[room.mode]} · {roleLabel}
                </p>
              </div>
              <div className="room-header-actions">
                <div className="stat-chip">房间码 {room.code}</div>
                <div className="stat-chip">在线 {room.players.length} 人</div>
                <div className="stat-chip">{statusTextMap[room.round.status] || room.round.status}</div>
                <button
                  className="ghost-button"
                  onClick={() =>
                    mutate(() => api.leaveRoom(session.token), {
                      resetPrompt: true,
                      resetGuess: true,
                    })
                  }
                >
                  返回大厅
                </button>
              </div>
            </header>

            <div className="room-entrance-banner page-enter">
              <span className="entrance-dot" />
              房间已连接，实时同步开启
            </div>

            <Feedback error={error} loading={loading} room={room} />

            <div className="room-focus-grid">
              <div className="room-main-stage">
                {room.round?.status === "finished" ? <RoundWrapup room={room} /> : null}
                <StatusPanel room={room} roleLabel={roleLabel} isHost={isHost} loading={loading} onStartRound={() => mutate(() => api.startRound(session.token, room.code))} />
                <CanvasBoard room={room} isDrawer={isDrawer} onStroke={sendStroke} onClear={clearCanvas} />
              </div>

              <section className="panel section-card room-side-panel">
                {room.round.word && (
                  <div className="info-block info-spotlight">
                    <h4>你可见的词</h4>
                    <p>{room.round.word}</p>
                  </div>
                )}

                {isPrompter && room.round.status === "collecting-word" && (
                  <form
                    className="stack form-block"
                    onSubmit={(event) => {
                      event.preventDefault();
                      mutate(() => api.submitPrompt(session.token, room.code, promptWord), { resetPrompt: true });
                    }}
                  >
                    <label>
                      输入给词
                      <input value={promptWord} onChange={(event) => setPromptWord(event.target.value)} />
                    </label>
                    <button className="primary-button primary-button-glow" type="submit">
                      发送给画师
                    </button>
                  </form>
                )}

                {room.round.viewerIsGuesser && (
                  <form
                    className="stack form-block"
                    onSubmit={(event) => {
                      event.preventDefault();
                      mutate(() => api.submitGuess(session.token, room.code, guess), { resetGuess: true });
                    }}
                  >
                    <label>
                      输入你的猜测
                      <input value={guess} onChange={(event) => setGuess(event.target.value)} />
                    </label>
                    <button className="primary-button primary-button-glow" type="submit">
                      提交答案
                    </button>
                  </form>
                )}

                {isPrompter && room.round.pendingGuess && (
                  <div className="info-block judge-card judge-card-live">
                    <h4>待裁定答案</h4>
                    <p>
                      {room.round.pendingGuess.guesserId}: {room.round.pendingGuess.text}
                    </p>
                    <div className="inline-actions">
                      <button
                        className="primary-button primary-button-glow"
                        onClick={() => mutate(() => api.judgeGuess(session.token, room.code, room.round.pendingGuess.guesserId, true))}
                      >
                        判定正确
                      </button>
                      <button
                        className="ghost-button"
                        onClick={() => mutate(() => api.judgeGuess(session.token, room.code, room.round.pendingGuess.guesserId, false))}
                      >
                        继续游戏
                      </button>
                    </div>
                  </div>
                )}

                <div className="subsection">
                  <div className="subsection-head">
                    <h3>房间玩家</h3>
                    <span>{room.players.length} 在线</span>
                  </div>
                  <div className="player-list">
                    {room.players.map((member) => {
                      const tags = getMemberTags(member, room, me);

                      return (
                        <article className={`player-row ${member.id === me?.id ? "player-row-self" : ""}`} key={member.id}>
                          <div className="player-meta">
                            <span className="player-name">{member.id}</span>
                            {tags.length ? (
                              <div className="player-tags">
                                {tags.map((tag) => (
                                  <span className="player-tag" key={`${member.id}-${tag}`}>
                                    {tag}
                                  </span>
                                ))}
                              </div>
                            ) : null}
                          </div>
                          <strong className="player-score">{member.score} pts</strong>
                        </article>
                      );
                    })}
                  </div>
                </div>

                <div className="subsection">
                  <div className="subsection-head">
                    <h3>房间动态</h3>
                    <span>实时</span>
                  </div>
                  <div className="chat-log">
                    {room.messages.map((message) => (
                      <div className={`chat-line ${message.type} ${message.type === "guess" ? "chat-line-celebrate" : ""}`} key={message.id}>
                        {message.text}
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            </div>
          </section>
        </main>
      )}

      {packPickerOpen && (
        <div className="modal-backdrop" onClick={() => setPackPickerOpen(false)}>
          <div className="modal-card page-enter" onClick={(event) => event.stopPropagation()}>
            <div className="section-head">
              <div>
                <p className="eyebrow">词包列表</p>
                <h2>选择已审核词包</h2>
              </div>
              <button className="ghost-button" onClick={() => setPackPickerOpen(false)}>
                关闭
              </button>
            </div>
            <div className="pack-list">
              {packs.map((pack) => (
                <button
                  key={pack.id}
                  type="button"
                  className={`pack-row ${roomForm.packIds.includes(pack.id) ? "selected" : ""}`}
                  onClick={() => togglePackSelection(pack.id)}
                >
                  <div>
                    <strong>{pack.name}</strong>
                    <p>{pack.description}</p>
                  </div>
                  <span>{roomForm.packIds.includes(pack.id) ? "已选中" : "选择"}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {packModalOpen && (
        <div className="modal-backdrop" onClick={() => setPackModalOpen(false)}>
          <div className="modal-card page-enter" onClick={(event) => event.stopPropagation()}>
            <div className="section-head">
              <div>
                <p className="eyebrow">提交词包</p>
                <h2>投稿新的词包内容</h2>
              </div>
              <button className="ghost-button" onClick={() => setPackModalOpen(false)}>
                关闭
              </button>
            </div>
            <div className="stack">
              <label>
                词包名称
                <input value={packForm.name} onChange={(event) => setPackForm((prev) => ({ ...prev, name: event.target.value }))} />
              </label>
              <label>
                简介
                <textarea value={packForm.description} onChange={(event) => setPackForm((prev) => ({ ...prev, description: event.target.value }))} />
              </label>
              <label>
                词语列表
                <textarea
                  value={packForm.words}
                  onChange={(event) => setPackForm((prev) => ({ ...prev, words: event.target.value }))}
                  placeholder="每行一个词"
                />
              </label>
              <button
                className="primary-button primary-button-glow"
                onClick={() =>
                  mutate(
                    () =>
                      api.createPack(session.token, {
                        name: packForm.name,
                        description: packForm.description,
                        words: packForm.words.split("\n").map((item) => item.trim()).filter(Boolean),
                      }),
                    { closePackModal: true },
                  )
                }
              >
                提交审核
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
