import { useEffect, useMemo, useState } from "react";
import { useGameConnection } from "./hooks/useGameConnection.js";
import { api } from "./api.js";
import { CanvasBoard } from "./components/CanvasBoard.jsx";

const defaultRoomForm = {
  name: "午夜速写局",
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
  finished: "本轮结算",
};

const modeTextMap = {
  library: "公共词库局",
  "host-judged": "主持裁定局",
};

function TypewriterText({ text, className = "", speed = 55 }) {
  const [visibleText, setVisibleText] = useState("");

  useEffect(() => {
    setVisibleText("");
    let index = 0;
    const chars = Array.from(text);
    const timer = window.setInterval(() => {
      index += 1;
      setVisibleText(chars.slice(0, index).join(""));
      if (index >= chars.length) {
        window.clearInterval(timer);
      }
    }, speed);

    return () => window.clearInterval(timer);
  }, [text, speed]);

  return (
    <span className={`typewriter ${className}`.trim()} aria-label={text}>
      {visibleText}
    </span>
  );
}

function getMemberTags(member, room, me) {
  const tags = [];
  if (member.id === me?.id) tags.push("我");
  if (member.id === room?.hostId) tags.push("房主");
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
    return <div className="feedback-banner feedback-info">正在同步房间与画布状态...</div>;
  }
  if (room?.round?.status === "finished") {
    return <div className="feedback-banner feedback-success">本轮已结算，房主可以继续发起下一轮。</div>;
  }
  return null;
}

function ModeSummary({ mode }) {
  if (mode === "host-judged") {
    return (
      <>
        <p className="mini-kicker">主持裁定局</p>
        <h3>更适合朋友聚会和自由发挥</h3>
        <p>一人给词，一人作画，其余玩家猜测，是否命中由出题者裁定，适合更灵活的规则和现场互动。</p>
      </>
    );
  }

  return (
    <>
      <p className="mini-kicker">公共词库局</p>
      <h3>节奏清晰，适合快速开局</h3>
      <p>从已审核词包中随机抽题，系统自动管理标准答案，流程更轻，适合稳定的多人房间。</p>
    </>
  );
}

function LoginHero() {
  return (
    <section className="hero-panel surface-panel page-enter">
      <div className="hero-gridline" />
      <p className="brand-mark">InkMuse / Live Drawing Room</p>
      <div className="hero-copy">
        <p className="section-kicker">协作绘画 · 实时猜词 · 房间制</p>
        <h1>
          <TypewriterText text="把“你画我猜”做成一场像现场演出一样的实时舞台。" />
        </h1>
        <p className="hero-text">
          这一版不再是普通卡片堆叠，而是把大厅、开局、画布和裁定状态都做成同一套编排感更强的交互系统。
        </p>
      </div>

      <div className="hero-metrics">
        <article className="metric-card">
          <span>房间模式</span>
          <strong>词库局 / 裁定局</strong>
        </article>
        <article className="metric-card">
          <span>同步方式</span>
          <strong>HTTP + WebSocket</strong>
        </article>
        <article className="metric-card">
          <span>核心舞台</span>
          <strong>实时画布</strong>
        </article>
      </div>

      <div className="hero-notes">
        <article className="note-card">
          <p className="mini-kicker">01</p>
          <h3>大厅像策展墙</h3>
          <p>房间列表不再只是表格，它应该像一排正在上演的展间入口。</p>
        </article>
        <article className="note-card">
          <p className="mini-kicker">02</p>
          <h3>画布永远是主角</h3>
          <p>所有信息围绕画布展开，而不是把画布挤成页面里的一个普通组件。</p>
        </article>
      </div>
    </section>
  );
}

function RoomTile({ item, onJoin }) {
  return (
    <article className="room-card editorial-card interactive-lift">
      <div className={`room-card-rail room-card-rail-${item.status}`} />
      <div className="room-card-head">
        <div>
          <p className="room-code">{item.code}</p>
          <h3>{item.name}</h3>
        </div>
        <span className="status-pill">{statusTextMap[item.status] || item.status}</span>
      </div>
      <p className="room-card-copy">{modeTextMap[item.mode] || item.mode}</p>
      <div className="room-card-meta">
        <span>{item.playerCount} 人在线</span>
        <button className="primary-button" onClick={onJoin} type="button">
          进入房间
        </button>
      </div>
    </article>
  );
}

function StatusPanel({ room, roleLabel, isHost, loading, onStartRound }) {
  const facts = [
    { label: "当前状态", value: statusTextMap[room.round.status] || room.round.status },
    { label: "画师", value: room.round.drawerId || "待定" },
    { label: "出题者", value: room.round.prompterId || "系统词库" },
    { label: "线索", value: room.round.maskedWord || "本轮开始后显示" },
  ];

  return (
    <section className="surface-panel status-panel">
      <div className="status-panel-head">
        <div>
          <p className="section-kicker">Round Console</p>
          <h2>{roleLabel}</h2>
        </div>
        {isHost ? (
          <button className="primary-button accent-button" onClick={onStartRound} disabled={loading || !["waiting", "finished"].includes(room.round.status) || room.players.length < (room.mode === "host-judged" ? 3 : 2)} type="button">
            开始下一轮
          </button>
        ) : null}
      </div>
      <div className="status-grid">
        {facts.map((fact) => (
          <article className="status-box" key={fact.label}>
            <span>{fact.label}</span>
            <strong>{fact.value}</strong>
          </article>
        ))}
      </div>
    </section>
  );
}

function RoundWrapup({ room }) {
  const winnerIds = room?.round?.winnerIds || [];
  const winners = room.players.filter((member) => winnerIds.includes(member.id));
  const answerText = room?.round?.word || room?.round?.maskedWord || "本轮答案已揭晓";

  return (
    <section className="surface-panel wrapup-panel page-enter">
      <div className="wrapup-copy">
        <p className="section-kicker">Round Closed</p>
        <h2>这一轮已经收束，结果留在台前。</h2>
        <p>正确答案：{answerText}</p>
      </div>
      <div className="wrapup-stats">
        <article className="wrapup-box">
          <span>命中玩家</span>
          <strong>{winners.length ? winners.map((member) => member.id).join("、") : "本轮无人猜中"}</strong>
        </article>
        <article className="wrapup-box">
          <span>下一步</span>
          <strong>房主可以直接继续下一轮</strong>
        </article>
      </div>
    </section>
  );
}

function ModeGuide({ modeDescriptions }) {
  return (
    <section className="surface-panel guide-panel">
      <div className="section-head">
        <div>
          <p className="section-kicker">玩法说明</p>
          <h2>不同局制，不同节奏</h2>
        </div>
      </div>
      <div className="guide-list">
        {modeDescriptions.map((mode) => (
          <article className="guide-card interactive-lift" key={mode.id}>
            <p className="mini-kicker">{mode.id}</p>
            <h3>{mode.title}</h3>
            <p>{mode.description}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function ActivityPanel({ room }) {
  return (
    <div className="room-side-stack">
      <section className="surface-panel side-panel">
        <div className="subsection-head">
          <h3>房间玩家</h3>
          <span>{room.players.length} 在线</span>
        </div>
        <div className="player-list">
          {room.players.map((member) => {
            const tags = getMemberTags(member, room, room?.me);

            return (
              <article className={`player-card interactive-lift ${member.id === room?.me?.id ? "player-card-self" : ""}`} key={member.id}>
                <div className="player-card-copy">
                  <strong>{member.id}</strong>
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
                <span className="score-chip">{member.score} pts</span>
              </article>
            );
          })}
        </div>
      </section>

      <section className="surface-panel side-panel">
        <div className="subsection-head">
          <h3>房间动态</h3>
          <span>实时</span>
        </div>
        <div className="chat-log">
          {room.messages.map((message) => (
            <div className={`chat-line ${message.type}`} key={message.id}>
              {message.playerId ? `${message.playerId}: ` : ""}{message.text}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

export default function App() {
  const [session, setSession] = useState(null);
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
  const { player, lobby, packs, room, modeDescriptions, connection, connectionError, send, applyResponse } = useGameConnection(session?.token, () => {
    localStorage.removeItem("draw-guess-session");
    setSession(null);
    setError("会话已过期或服务已重启，请重新进入大厅。");
  });
  useEffect(() => {
    if (session) localStorage.setItem("draw-guess-session", JSON.stringify(session));
  }, [session]);
  useEffect(() => {
    if (packs.length) setRoomForm((previous) => ({ ...previous, packIds: previous.packIds.length ? previous.packIds : [packs[0].id] }));
  }, [packs]);

  const me = room?.me || player;
  const isDrawer = room?.round?.drawerId === me?.id;
  const isPrompter = room?.round?.prompterId === me?.id;
  const isHost = room?.hostId === me?.id;
  const selectedPacks = packs.filter((pack) => roomForm.packIds.includes(pack.id));

  useEffect(() => {
    const saved = localStorage.getItem("draw-guess-session");
    if (!saved) return;
    try {
      const value = JSON.parse(saved);
      if (typeof value?.token === "string") setSession(value);
      else localStorage.removeItem("draw-guess-session");
    } catch { localStorage.removeItem("draw-guess-session"); }
  }, []);

  async function handleLogin(event) {
    event.preventDefault();
    try {
      setLoading(true);
      const payload = await api.createSession(preferredId);
      setSession(payload.player);
      setLoading(false);
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
    localStorage.removeItem("draw-guess-session");
    setSession(null);
    setError("");
    setLoading(false);
  }

  async function mutate(task, options = {}) {
    try {
      setLoading(true);
      setError("");
      const payload = await task();
      applyResponse(payload, session.token);
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
    if (!room?.round) return "你现在在大厅等待新一轮";
    if (isDrawer) return "这一轮由你作画";
    if (isPrompter) return "这一轮由你出题与裁定";
    if (room.round.viewerIsGuesser) return "这一轮由你负责猜词";
    return "当前正在观战";
  }, [room, isDrawer, isPrompter]);

  function sendStroke(stroke) {
    return send({ type: "canvas:stroke", stroke, roundId: room.round.id });
  }

  function clearCanvas() {
    send({ type: "canvas:clear", roundId: room.round.id });
  }

  if (!session) {
    return (
      <div className="app-shell">
        <main className="login-layout">
          <LoginHero />

          <form className="surface-panel login-panel page-enter delay-1" onSubmit={handleLogin}>
            <div className="section-head">
              <div>
                <p className="section-kicker">临时身份</p>
                <h2>进入大厅</h2>
              </div>
            </div>
            <label>
              玩家 ID
              <input value={preferredId} onChange={(event) => setPreferredId(event.target.value)} placeholder="例如 AuroraFox" />
            </label>
            <button className="primary-button accent-button" type="submit" disabled={loading}>
              {loading ? "正在连接..." : "创建临时身份"}
            </button>
            <Feedback error={error || connectionError} loading={loading} room={null} />
          </form>
        </main>
      </div>
    );
  }

  return (
    <div className="app-shell">
      {!room && (
        <main className="lobby-shell">
          <header className="surface-panel lobby-topbar page-enter">
            <div>
              <p className="section-kicker">InkMuse Lobby</p>
              <h1>今晚开哪一局？</h1>
            </div>
            <div className="topbar-actions">
              <div className="identity-pill">当前身份 {player?.id}</div>
              <button className="ghost-button" onClick={handleLogout} type="button">
                退出登录
              </button>
            </div>
          </header>

          <Feedback error={error || connectionError} loading={loading} room={room} />

          <section className="lobby-grid page-enter">
            <aside className="lobby-sidebar">
              <section className="surface-panel compose-panel">
                <div className="section-head">
                  <div>
                    <p className="section-kicker">创建房间</p>
                    <h2>从这里发起一场新的对局</h2>
                  </div>
                  <button className="ghost-button" onClick={() => setPackModalOpen(true)} type="button">
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
                      className={`mode-switch-button ${roomForm.mode === "library" ? "active" : ""}`}
                      onClick={() => setRoomForm((prev) => ({ ...prev, mode: "library" }))}
                    >
                      公共词库局
                    </button>
                    <button
                      type="button"
                      className={`mode-switch-button ${roomForm.mode === "host-judged" ? "active" : ""}`}
                      onClick={() => setRoomForm((prev) => ({ ...prev, mode: "host-judged", packIds: [] }))}
                    >
                      主持裁定局
                    </button>
                  </div>

                  <div className="mode-summary-card">
                    <ModeSummary mode={roomForm.mode} />
                  </div>

                  {roomForm.mode === "library" ? (
                    <div className="selector-card">
                      <div>
                        <p className="mini-kicker">已选词包</p>
                        <strong>{selectedPacks.length ? selectedPacks.map((pack) => pack.name).join("、") : "暂未选择词包"}</strong>
                      </div>
                      <button className="ghost-button" type="button" onClick={() => setPackPickerOpen(true)}>
                        选择词包
                      </button>
                    </div>
                  ) : null}

                  <button className="primary-button accent-button" onClick={() => mutate(() => api.createRoom(session.token, roomForm))} disabled={loading} type="button">
                    创建并进入
                  </button>
                </div>
              </section>

              <ModeGuide modeDescriptions={modeDescriptions} />
            </aside>

            <section className="lobby-main">
              <section className="surface-panel billboard-panel">
                <div className="billboard-copy">
                  <p className="section-kicker">Live Rooms</p>
                  <h2>大厅像一面演出排期墙，每个房间都应该看起来随时可以进入。</h2>
                </div>
                <div className="billboard-stats">
                  <article className="billboard-stat interactive-lift">
                    <span>活跃房间</span>
                    <strong>{lobby.length}</strong>
                  </article>
                  <article className="billboard-stat interactive-lift">
                    <span>可用词包</span>
                    <strong>{packs.length}</strong>
                  </article>
                  <article className="billboard-stat interactive-lift">
                    <span>当前身份</span>
                    <strong>{player?.id}</strong>
                  </article>
                </div>
              </section>

              <section className="surface-panel rooms-panel">
                <div className="section-head rooms-head">
                  <div>
                    <p className="section-kicker">房间列表</p>
                    <h2>正在开放的实时房间</h2>
                  </div>
                  <div className="join-inline">
                    <input value={joinCode} onChange={(event) => setJoinCode(event.target.value.toUpperCase())} placeholder="输入房间码" />
                    <button className="ghost-button" onClick={() => mutate(() => api.joinRoom(session.token, joinCode))} type="button">
                      加入
                    </button>
                  </div>
                </div>

                <div className="room-list">
                  {lobby.map((item) => (
                    <RoomTile key={item.code} item={item} onJoin={() => mutate(() => api.joinRoom(session.token, item.code))} />
                  ))}
                  {!lobby.length ? <p className="empty-copy">大厅里还没有活跃房间，现在就开一局，留下今晚第一笔。</p> : null}
                </div>
              </section>
            </section>
          </section>
        </main>
      )}

      {room && (
        <main className="stage-shell">
          <header className="surface-panel stage-topbar page-enter">
            <div>
              <p className="section-kicker">Room Stage</p>
              <h1>{room.name}</h1>
              <p className="topbar-subcopy">
                {modeTextMap[room.mode]} · {roleLabel}
              </p>
            </div>
            <div className="topbar-actions">
              <span className="identity-pill">房间码 {room.code}</span>
              <span className="identity-pill">在线 {room.players.length} 人</span>
              <span className="identity-pill">{statusTextMap[room.round.status] || room.round.status}</span>
              <button
                className="ghost-button"
                onClick={() =>
                  mutate(() => api.leaveRoom(session.token), {
                    resetPrompt: true,
                    resetGuess: true,
                  })
                }
                type="button"
              >
                返回大厅
              </button>
            </div>
          </header>

          <div className="stage-banner page-enter">
            <span className="live-dot" />
            {connection === "online" ? "已连接 · 实时同步" : "连接恢复中，请稍候…"}
          </div>

          <Feedback error={error || connectionError} loading={loading} room={room} />

          <section className="stage-grid">
            <div className="stage-main">
              {room.round?.status === "finished" ? <RoundWrapup room={room} /> : null}
              <StatusPanel room={room} roleLabel={roleLabel} isHost={isHost} loading={loading} onStartRound={() => mutate(() => api.startRound(session.token, room.code, room.round.id))} />
              <CanvasBoard room={room} isDrawer={isDrawer && room.round.status === "active" && connection === "online"} onStroke={sendStroke} onClear={clearCanvas} />
            </div>

            <aside className="stage-side">
              <section className="surface-panel side-panel control-panel">
                {room.round.word ? (
                  <div className="spotlight-card">
                    <p className="mini-kicker">你可见的词</p>
                    <h3>{room.round.word}</h3>
                  </div>
                ) : null}

                {isPrompter && room.round.status === "collecting-word" ? (
                  <form
                    className="stack"
                    onSubmit={(event) => {
                      event.preventDefault();
                      mutate(() => api.submitPrompt(session.token, room.code, promptWord, room.round.id), { resetPrompt: true });
                    }}
                  >
                    <label>
                      输入给词
                      <input value={promptWord} onChange={(event) => setPromptWord(event.target.value)} placeholder="例如：月球车" />
                    </label>
                    <button className="primary-button accent-button" type="submit">
                      发送给画师
                    </button>
                  </form>
                ) : null}

                {room.round.viewerIsGuesser ? (
                  <form
                    className="stack"
                    onSubmit={(event) => {
                      event.preventDefault();
                      mutate(() => api.submitGuess(session.token, room.code, guess, room.round.id), { resetGuess: true });
                    }}
                  >
                    <label>
                      输入你的猜测
                      <input value={guess} onChange={(event) => setGuess(event.target.value)} placeholder="想到什么就直接猜" />
                    </label>
                    <button className="primary-button accent-button" type="submit">
                      提交答案
                    </button>
                  </form>
                ) : null}

                {isPrompter ? room.round.pendingGuesses.map((pending) => (
                  <div className="judge-panel" key={pending.id}>
                    <p className="mini-kicker">待裁定答案</p>
                    <h3>
                      {pending.playerId}: {pending.text}
                    </h3>
                    <div className="inline-actions">
                      <button
                        className="primary-button accent-button"
                        onClick={() => mutate(() => api.judgeGuess(session.token, room.code, pending.id, true, room.round.id))}
                        type="button"
                      >
                        判定正确
                      </button>
                      <button
                        className="ghost-button"
                        onClick={() => mutate(() => api.judgeGuess(session.token, room.code, pending.id, false, room.round.id))}
                        type="button"
                      >
                        继续游戏
                      </button>
                    </div>
                  </div>
                )) : null}
              </section>

              <ActivityPanel room={room} />
            </aside>
          </section>
        </main>
      )}

      {packPickerOpen ? (
        <div className="modal-backdrop" onClick={() => setPackPickerOpen(false)}>
          <div className="surface-panel modal-card page-enter" onClick={(event) => event.stopPropagation()}>
            <div className="section-head">
              <div>
                <p className="section-kicker">词包列表</p>
                <h2>选择已审核词包</h2>
              </div>
              <button className="ghost-button" onClick={() => setPackPickerOpen(false)} type="button">
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
      ) : null}

      {packModalOpen ? (
        <div className="modal-backdrop" onClick={() => setPackModalOpen(false)}>
          <div className="surface-panel modal-card page-enter" onClick={(event) => event.stopPropagation()}>
            <div className="section-head">
              <div>
                <p className="section-kicker">投稿词包</p>
                <h2>提交新的词包内容</h2>
              </div>
              <button className="ghost-button" onClick={() => setPackModalOpen(false)} type="button">
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
                className="primary-button accent-button"
                onClick={() =>
                  mutate(
                    () =>
                      api.createPack(session.token, {
                        name: packForm.name,
                        description: packForm.description,
                        words: packForm.words
                          .split("\n")
                          .map((item) => item.trim())
                          .filter(Boolean),
                      }),
                    { closePackModal: true },
                  )
                }
                type="button"
              >
                提交审核
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
