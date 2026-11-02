import { useEffect, useReducer, useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import ArtCanvas from "./ArtCanvas.jsx";
import { AvatarArtwork, PackArtwork, PencilCup, SketchIcon } from "./Artwork.jsx";
import { InkWord, StillContext } from "./InkWord.jsx";
import { MAX_SELECTED_PACKS, artReducer, initialArtState, lobbyRooms, maskWord, rolePlayers } from "./model.js";
import "./art.css";

const colors = [["#504936", "墨"], ["#ad5541", "朱"], ["#4c6091", "靛"], ["#66795a", "苔"], ["#bc9244", "赭"], ["#a46f81", "藕"]];
const modes = { library: "词库局", "host-judged": "裁定局" };
const statuses = { waiting: "等待开局", "collecting-word": "等待出题", active: "正在作画", finished: "本轮结束" };
const reasons = { guessed: "猜中了！", timeout: "时间到", skipped: "房主结束本轮" };
const guessStatus = { rejected: "未猜中", pending: "待裁定", accepted: "猜中了", closed: "已结束" };
const packArt = { plants: "botanical", kitchen: "pantry", oddities: "oddities", animals: "animals" };
const views = [["lobby", "大厅"], ["room", "房间"], ["packs", "词包"]];

function Button({ icon, children, className = "", ...props }) {
  return <button type="button" className={`art-button ${className}`} {...props}>{icon && <SketchIcon name={icon} />}{children}</button>;
}

function Mark({ className = "" }) {
  return <svg className={`art-mark ${className}`} viewBox="0 0 140 12" fill="none" aria-hidden="true"><path pathLength="1" d="M3 7Q42 2 78 6T137 4M10 10Q64 6 121 9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>;
}

function ArtDialog({ open, title, description, onClose, container, children }) {
  return <Dialog.Root open={open} onOpenChange={(value) => { if (!value) onClose(); }}>
    <Dialog.Portal container={container}>
      <Dialog.Overlay className="art-overlay" />
      <Dialog.Content className="art-dialog">
        <span className="art-tape" aria-hidden="true" />
        <Dialog.Title>{title}</Dialog.Title>
        {description ? <Dialog.Description>{description}</Dialog.Description> : <Dialog.Description className="art-sr-only">{title}</Dialog.Description>}
        {children}
        <Dialog.Close asChild><Button className="art-icon-button art-dialog-close" icon="close" aria-label="关闭弹窗" /></Dialog.Close>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
}

function ColorPencil({ color, name, active, onClick, disabled }) {
  return <button type="button" className={`art-pencil ${active ? "is-active" : ""}`} aria-label={`${name}色`} aria-pressed={active} onClick={onClick} disabled={disabled} title={`${name}色`}>
    <svg viewBox="0 0 30 62" aria-hidden="true"><path d="M8 54 7 20 15 3 23 20 22 54Q15 58 8 54Z" fill={color} stroke={color} strokeWidth="1.3" /><path d="M7 20 15 3 23 20 18 18 14 21 10 18Z" fill="#d8bc88" /><path d="m12 9 3-6 3 6Z" fill={color} /><path d="m11 24 1 27M17 23l1 29" stroke="#f1ebde" strokeWidth="1.1" opacity=".48" /><path d="m7 56 16-1M9 59l11-1" stroke={color} strokeWidth="1.2" fill="none" /></svg>
  </button>;
}

function Toolbar({ tool, setTool, disabled, hasStrokes, onUndo, onClear }) {
  return <div className="art-toolbar" role="toolbar" aria-label="绘画工具">
    <div className="art-tool-pair">
      <Button className="art-icon-button" icon="pen" aria-label="画笔" title="画笔 · B" aria-pressed={tool.tool === "pen"} disabled={disabled} onClick={() => setTool({ ...tool, tool: "pen" })} />
      <Button className="art-icon-button" icon="eraser" aria-label="橡皮" title="橡皮 · E" aria-pressed={tool.tool === "eraser"} disabled={disabled} onClick={() => setTool({ ...tool, tool: "eraser" })} />
    </div>
    <div className="art-pencil-row">{colors.map(([color, name]) => <ColorPencil key={color} color={color} name={name} active={tool.color === color && tool.tool === "pen"} disabled={disabled} onClick={() => setTool({ ...tool, color, tool: "pen" })} />)}</div>
    <div className="art-width" role="radiogroup" aria-label="线宽">
      {[3, 6, 12, 20].map((width) => <button key={width} type="button" role="radio" aria-checked={tool.width === width} aria-label={`线宽 ${width}`} disabled={disabled} onClick={() => setTool({ ...tool, width })}><i style={{ width: Math.max(4, width * 0.9), height: Math.max(4, width * 0.9) }} /></button>)}
    </div>
    <div className="art-reset-tools">
      <Button className="art-icon-button" icon="undo" aria-label="撤销" title="撤销 · Ctrl / ⌘ Z" disabled={disabled || !hasStrokes} onClick={onUndo} />
      <Button className="art-icon-button" icon="trash" aria-label="清空" title="清空" disabled={disabled || !hasStrokes} onClick={onClear} />
    </div>
  </div>;
}

function playerName(state, id) {
  return state.players.find((player) => player.id === id)?.name || id;
}

export default function ArtBaseline() {
  const [state, dispatch] = useReducer(artReducer, undefined, initialArtState);
  const [tool, setTool] = useState({ tool: "pen", color: colors[0][0], width: 6 });
  const [dialog, setDialog] = useState(null), [notice, setNotice] = useState("");
  const [draft, setDraft] = useState(""), [prompt, setPrompt] = useState("");
  const [nickname, setNickname] = useState("");
  const [roomForm, setRoomForm] = useState({ name: "午后速写室", mode: "library" });
  const [joinCode, setJoinCode] = useState(""), [joinError, setJoinError] = useState("");
  const [packDraft, setPackDraft] = useState({ name: "", description: "", words: "" });
  const [packTab, setPackTab] = useState("published");
  const [localGuesses, setLocalGuesses] = useState([]);
  const [settings, setSettings] = useState({ timer: false, failSend: false, font: "xiaolai", still: false });
  const [portal, setPortal] = useState(null);
  const feedRef = useRef(null), followFeed = useRef(true), sendTimers = useRef(new Map());
  const [unread, setUnread] = useState(false);
  const people = rolePlayers(state);
  const finished = state.status === "finished";
  const running = ["active", "collecting-word"].includes(state.status);
  const drawing = state.role === "drawer" && state.status === "active" && state.online;
  const guessing = state.role === "guesser" && state.status === "active" && state.online;
  const judging = state.role === "prompter" && state.status === "active" && state.online;
  const canPrompt = state.role === "prompter" && state.status === "collecting-word" && state.online;
  const minimum = state.mode === "host-judged" ? 3 : 2;
  const missingPlayers = Math.max(0, minimum - state.players.length);
  const publishedPacks = state.packs.filter((pack) => pack.status === "published");
  const pendingPacks = state.packs.filter((pack) => pack.status === "pending");
  const roundGuesses = localGuesses.filter((guess) => guess.roundId === state.roundId);
  const act = (type, payload = {}) => dispatch({ type, roundId: state.roundId, ...payload });

  useEffect(() => {
    if (!settings.timer || state.view !== "room" || !running) return undefined;
    const timer = setInterval(() => dispatch({ type: "TICK" }), 1000);
    return () => clearInterval(timer);
  }, [settings.timer, running, state.view]);
  useEffect(() => {
    if (!notice) return undefined;
    const timer = setTimeout(() => setNotice(""), 3200);
    return () => clearTimeout(timer);
  }, [notice]);
  useEffect(() => {
    if (followFeed.current && feedRef.current) feedRef.current.scrollTop = feedRef.current.scrollHeight;
    else if (state.messages.length) setUnread(true);
  }, [state.messages, localGuesses]);
  useEffect(() => {
    setPrompt("");
    followFeed.current = true;
    setUnread(false);
  }, [state.roundId]);
  useEffect(() => () => sendTimers.current.forEach(clearTimeout), []);

  function navigate(view) {
    act("VIEW", { view });
    setJoinError("");
  }
  function sendGuess(text, id) {
    const roundId = state.roundId;
    setLocalGuesses((old) => [...old.filter((guess) => guess.id !== id), { id, text, roundId, status: "sending" }]);
    clearTimeout(sendTimers.current.get(id));
    sendTimers.current.set(id, setTimeout(() => {
      sendTimers.current.delete(id);
      if (settings.failSend) {
        setLocalGuesses((old) => old.map((guess) => guess.id === id ? { ...guess, status: "failed" } : guess));
        return;
      }
      dispatch({ type: "GUESS", roundId, text, clientGuessId: id });
      setLocalGuesses((old) => old.filter((guess) => guess.id !== id));
    }, 650));
  }
  function submitGuess(event) {
    event.preventDefault();
    if (!guessing || !draft.trim()) return;
    sendGuess(draft.trim(), crypto.randomUUID());
    setDraft("");
  }
  function joinRoom(code, name) {
    const normalized = code.trim().toUpperCase();
    if (normalized !== state.code && !lobbyRooms.some((room) => room.code === normalized)) {
      setJoinError("房间已关闭，请检查房间码。");
      return;
    }
    setJoinError("");
    setLocalGuesses([]);
    act("JOIN_ROOM", { code: normalized, name: name || lobbyRooms.find((room) => room.code === normalized)?.name });
  }
  function submitPack(event) {
    event.preventDefault();
    const before = state.packs.length;
    const next = artReducer(state, { type: "SUBMIT_PACK", pack: packDraft });
    dispatch({ type: "SUBMIT_PACK", pack: packDraft });
    if (next.packs.length > before) {
      setPackDraft({ name: "", description: "", words: "" });
      setDialog(null);
      setPackTab("review");
      setNotice("已提交，等待审核");
    }
  }

  const headline = finished ? reasons[state.reason] || "本轮结束"
    : state.status === "waiting" ? missingPlayers ? `还差 ${missingPlayers} 人` : state.host ? "可以开局" : "等房主开局"
      : state.status === "collecting-word" ? state.role === "prompter" ? "轮到你出题" : "等待出题"
        : state.role === "drawer" ? "轮到你画" : state.role === "prompter" ? "轮到你裁定" : "轮到你猜";
  const wordLabel = finished ? "答案" : state.role === "drawer" ? "请画这个词" : state.role === "prompter" ? "你出的词" : "提示";
  const hasWord = state.word && state.status !== "waiting" && state.status !== "collecting-word";
  const wordText = !hasWord ? "—" : finished || state.role !== "guesser" ? state.word : maskWord(state.word);
  const scoreLine = Object.entries(state.scoreChanges).filter(([, score]) => score > 0).map(([id, score]) => `${playerName(state, id)} +${score}`).join(" · ");

  return <StillContext.Provider value={settings.still}>
    <div className="art-app" data-font={settings.font} data-still={settings.still || undefined}>
      <div className="art-page">
        <header className="art-header">
          <button className="art-brand" type="button" onClick={() => navigate(state.view === "enter" ? "enter" : "lobby")} aria-label="InkMuse 大厅">
            <svg viewBox="0 0 35 40" aria-hidden="true"><path d="M5 32 21 4l8 4-17 29-7-5Z" fill="#bc9244" /><path d="m5 32-2 7 9-2M21 4l8 4M8 32 24 7" stroke="#504936" fill="none" strokeWidth="1.6" /><path d="M17 35q7-9 15-3" stroke="#ad5541" fill="none" strokeWidth="2" /></svg>
            <span>InkMuse</span><i>你画我猜</i>
          </button>
          {state.view !== "enter" && <nav aria-label="主导航">{views.map(([view, label]) => <button key={view} type="button" aria-current={state.view === view ? "page" : undefined} onClick={() => navigate(view)}>{label}{view === "packs" && pendingPacks.length > 0 && <small>{pendingPacks.length}</small>}{state.view === view && <Mark />}</button>)}</nav>}
          <div className="art-header-end">
            <span className={`art-connection ${state.online ? "" : "is-offline"}`} role="status"><i />{state.online ? "已连接" : "正在重连 · 房间保留 60 秒"}</span>
            {state.view !== "enter" && <Button className="art-quiet" onClick={() => navigate("enter")}>退出</Button>}
          </div>
        </header>

        {state.view === "enter" && <main className="art-enter">
          <section className="art-enter-slip">
            <span className="art-tape" aria-hidden="true" />
            <h1>进入大厅<Mark /></h1>
            <form onSubmit={(event) => { event.preventDefault(); navigate("lobby"); }}>
              <label htmlFor="art-nickname">昵称</label>
              <input id="art-nickname" maxLength={16} value={nickname} autoComplete="nickname" placeholder="留空自动取名" onChange={(event) => setNickname(event.target.value)} />
              <Button type="submit" className="art-primary" icon="arrow" disabled={!state.online}>进入大厅</Button>
            </form>
            <p className="art-meta">2–10 人 · 每轮 100 秒 · 断线保留 60 秒</p>
          </section>
          <PencilCup className="art-enter-art" />
        </main>}

        {state.view === "lobby" && <main className="art-lobby">
          <div className="art-page-heading">
            <div><span className="art-meta">{lobbyRooms.length + 1} 间开放房间</span><h1>大厅<Mark /></h1></div>
            <Button icon="plus" onClick={() => setDialog("pack")}>投稿词包</Button>
          </div>
          <div className="art-lobby-layout">
            <section className="art-create-sheet" aria-labelledby="art-create-title">
              <h2 id="art-create-title"><SketchIcon name="plus" />创建房间</h2>
              <form className="art-form" onSubmit={(event) => { event.preventDefault(); act("CREATE_ROOM", { ...roomForm }); setLocalGuesses([]); }}>
                <label>房间名称<input required maxLength={32} value={roomForm.name} onChange={(event) => setRoomForm({ ...roomForm, name: event.target.value })} /></label>
                <fieldset className="art-mode-cards"><legend>玩法</legend>
                  {[["library", "2 人起 · 自动判定"], ["host-judged", "3 人起 · 出题者裁定"]].map(([mode, detail]) => <label key={mode} className={roomForm.mode === mode ? "is-checked" : ""}>
                    <input type="radio" name="art-room-mode" checked={roomForm.mode === mode} onChange={() => setRoomForm({ ...roomForm, mode })} />
                    <strong>{modes[mode]}</strong><small>{detail}</small>
                  </label>)}
                </fieldset>
                {roomForm.mode === "library" && <fieldset className="art-pack-chips"><legend>词包 <small>{state.selectedPacks.length ? `已选 ${state.selectedPacks.length} / ${MAX_SELECTED_PACKS}` : "默认词包"}</small></legend>
                  {publishedPacks.map((pack) => { const selected = state.selectedPacks.includes(pack.id); return <button key={pack.id} type="button" aria-pressed={selected} disabled={!selected && state.selectedPacks.length >= MAX_SELECTED_PACKS} onClick={() => act("PACK", { id: pack.id })}>{selected && <SketchIcon name="check" size={16} />}{pack.name}<small>{pack.words.length}</small></button>; })}
                </fieldset>}
                <Button type="submit" className="art-primary" icon="arrow" disabled={!roomForm.name.trim() || !state.online}>创建房间</Button>
              </form>
            </section>
            <section className="art-room-wall" aria-label="开放房间">
              <form className="art-join-slip" onSubmit={(event) => { event.preventDefault(); joinRoom(joinCode); }}>
                <label htmlFor="art-join-code">房间码</label>
                <input id="art-join-code" maxLength={5} minLength={5} required value={joinCode} autoComplete="off" autoCapitalize="characters" placeholder="5 位" aria-invalid={Boolean(joinError)} aria-describedby={joinError ? "art-join-error" : undefined} onChange={(event) => { setJoinCode(event.target.value.toUpperCase()); setJoinError(""); }} />
                <Button type="submit" icon="arrow" disabled={!state.online || joinCode.trim().length !== 5}>加入</Button>
                {joinError && <p className="art-error" id="art-join-error" role="alert">{joinError}</p>}
              </form>
              <div className="art-room-list">
                {[{ code: state.code, name: state.roomName, mode: state.mode, playerCount: state.players.length, status: state.status }, ...lobbyRooms].map((room, index) => {
                  const full = room.playerCount >= 10, playing = ["active", "collecting-word"].includes(room.status);
                  return <article key={room.code} className={`art-room-card art-room-card-${index % 3}`}>
                    <span className={`art-room-state ${playing ? "is-playing" : ""}`}><i />{playing ? "正在游戏" : "等待新一轮"}</span>
                    <h3>{room.name}</h3>
                    <p>{modes[room.mode]} · {room.playerCount}/10 · <span className="art-code">{room.code}</span></p>
                    <Button icon={full ? undefined : "arrow"} disabled={!state.online || full} onClick={() => joinRoom(room.code, room.name)}>{full ? "已满" : "进入"}</Button>
                  </article>;
                })}
              </div>
            </section>
          </div>
          <footer className="art-rules"><SketchIcon name="clock" size={18} />每轮 100 秒 · 猜中 +2 · 画师和出题者各 +1</footer>
        </main>}

        {state.view === "room" && <main className="art-room">
          <div className="art-room-heading">
            <div><span className="art-meta">{modes[state.mode]} · {state.players.length} / 10 人</span><h1>{state.roomName}</h1></div>
            <button className="art-room-code" type="button" aria-label={`复制房间码 ${state.code}`} onClick={async () => {
              try { await navigator.clipboard.writeText(state.code); setNotice("已复制房间码"); } catch { setNotice(`复制失败，房间码：${state.code}`); }
            }}><span className="art-meta">房间码</span><strong className="art-code">{state.code}</strong><SketchIcon name="copy" size={18} /></button>
          </div>
          <div className="art-game-layout">
            <section className="art-desk" aria-label="画布与回合">
              <div className={`art-round-line ${finished ? "is-finished" : ""}`} aria-label="回合状态">
                <div className="art-round-state">
                  <span className="art-meta">第 {state.roundNumber} 轮 · {statuses[state.status]}</span>
                  <InkWord text={headline} className="art-headline" color={finished && state.reason === "guessed" ? "#66795a" : "#504936"} />
                </div>
                <div className="art-word">
                  <span>{wordLabel}</span>
                  {finished && hasWord ? <InkWord text={state.word} className="art-answer" color="#ad5541" /> : <strong className={state.role === "guesser" && hasWord && !finished ? "is-masked" : ""}>{wordText}</strong>}
                  <Mark />
                </div>
                <div className={`art-timer ${running && state.seconds <= 15 ? "is-urgent" : ""}`} aria-label={running ? `剩余 ${state.seconds} 秒` : "尚未计时"}>
                  <SketchIcon name={running ? "clock" : "users"} size={28} />
                  {running ? <strong>{state.seconds}<small>秒</small></strong> : <strong>{state.players.length}<small>人</small></strong>}
                </div>
                {state.host ? running
                  ? <Button className="art-round-action" disabled={!state.online} onClick={() => setDialog("skip")}>结束本轮</Button>
                  : <Button className="art-primary art-round-action" icon="arrow" disabled={!state.online || missingPlayers > 0} onClick={() => { act("START"); setLocalGuesses([]); }}>{state.roundNumber ? "再来一轮" : "开始游戏"}</Button>
                  : <span className="art-round-wait">{running ? `${playerName(state, people.drawerId)} 作画中` : "等房主开局"}</span>}
              </div>

              <div className="art-drawing-paper">
                <span className="art-tape art-tape-left" aria-hidden="true" /><span className="art-tape art-tape-right" aria-hidden="true" />
                {state.role === "drawer" && state.status === "active"
                  ? <Toolbar tool={tool} setTool={setTool} disabled={!drawing} hasStrokes={state.canvas.length > 0} onUndo={() => act("UNDO", { epoch: state.canvasEpoch })} onClear={() => setDialog("clear")} />
                  : <div className="art-watching"><AvatarArtwork kind={people.drawer?.kind} /><span>{finished ? "本轮画作" : state.status === "active" ? `${people.drawer?.name} 正在画` : statuses[state.status]}</span><span className="art-paper-no">No. {String(state.roundNumber).padStart(3, "0")}</span></div>}
                <div className="art-canvas-stage">
                  <ArtCanvas strokes={state.canvas} epoch={state.canvasEpoch} roundId={state.roundId} enabled={drawing} tool={tool} onStroke={(stroke, roundId, epoch) => dispatch({ type: "STROKE", stroke, roundId, epoch })} onUndo={() => act("UNDO", { epoch: state.canvasEpoch })} onTool={(next) => setTool((old) => ({ ...old, tool: next }))} />
                  {!state.canvas.length && !drawing && <div className="art-canvas-empty"><PencilCup /><span>{state.status === "waiting" ? missingPlayers ? `还差 ${missingPlayers} 人开局` : "等待开局" : state.status === "collecting-word" ? `${playerName(state, people.prompterId)} 出题中` : finished ? "本轮没有画作" : "画布空白"}</span></div>}
                </div>
                <div className="art-paper-footer"><span>{drawing ? "B 画笔 · E 橡皮 · Ctrl / ⌘ Z 撤销" : finished ? "画作保留到下一轮开始" : ""}</span><span>{state.role === "drawer" ? "画师 · 你" : state.role === "prompter" ? "出题者 · 你" : "猜词 · 你"}</span></div>
              </div>
              {finished && <div className="art-result" role="status"><SketchIcon name={scoreLine ? "check" : "clock"} /><strong>{scoreLine || "本轮无人得分"}</strong></div>}
            </section>

            <aside className="art-notebook" aria-label="猜词与裁定">
              <div className="art-notebook-rings" aria-hidden="true">{Array.from({ length: 9 }, (_, index) => <i key={index} />)}</div>
              <div className="art-notebook-heading"><h2>{state.role === "prompter" ? "出题与裁定" : "猜词"}</h2><span className="art-meta">{state.messages.length + roundGuesses.length} 条</span></div>
              {state.status === "collecting-word" && state.role === "prompter" && <form className="art-prompt" onSubmit={(event) => { event.preventDefault(); if (canPrompt && prompt.trim()) act("PROMPT", { word: prompt.trim() }); }}>
                <label htmlFor="art-prompt">本轮词语</label>
                <input id="art-prompt" maxLength={28} value={prompt} autoComplete="off" onChange={(event) => setPrompt(event.target.value)} />
                <Button type="submit" className="art-primary" disabled={!canPrompt || !prompt.trim()}>确认出题</Button>
              </form>}
              <div className="art-feed" role="log" aria-label="猜词记录" ref={feedRef} onScroll={() => { const feed = feedRef.current; followFeed.current = feed.scrollHeight - feed.scrollTop - feed.clientHeight < 30; if (followFeed.current) setUnread(false); }}>
                {state.messages.map((message) => <article key={message.id} className={`art-message art-message-${message.status} ${message.playerId === "you" ? "is-mine" : ""}`}>
                  <span className="art-message-name">{message.playerId === "you" ? "我" : playerName(state, message.playerId)}</span>
                  <p>{message.text}</p>
                  <small className="art-message-state">{message.status === "accepted" && <SketchIcon name="check" size={20} />}{guessStatus[message.status]}</small>
                  {message.status === "pending" && judging && <div className="art-judgment">
                    <Button icon="check" className="art-accept" aria-label={`判定 ${playerName(state, message.playerId)} 的 ${message.text} 正确`} onClick={() => act("JUDGE", { guessId: message.id, accepted: true })}>猜对了</Button>
                    <Button icon="cross" className="art-quiet" aria-label={`判定 ${playerName(state, message.playerId)} 的 ${message.text} 错误`} onClick={() => act("JUDGE", { guessId: message.id, accepted: false })}>还不对</Button>
                  </div>}
                </article>)}
                {roundGuesses.map((guess) => <article key={guess.id} className={`art-message art-message-${guess.status} is-mine`}>
                  <span className="art-message-name">我</span><p>{guess.text}</p>
                  <small className="art-message-state">{guess.status === "sending" ? "发送中…" : "未送达"}</small>
                  {guess.status === "failed" && <div className="art-judgment"><Button icon="refresh" className="art-quiet" disabled={!guessing} onClick={() => sendGuess(guess.text, guess.id)}>重试</Button></div>}
                </article>)}
                {!state.messages.length && !roundGuesses.length && <p className="art-feed-empty">暂无猜词</p>}
              </div>
              {unread && <Button className="art-new-messages" onClick={() => { followFeed.current = true; feedRef.current.scrollTop = feedRef.current.scrollHeight; setUnread(false); }}>新消息 ↓</Button>}
              <form className="art-guess-form" onSubmit={submitGuess}>
                <label className="art-sr-only" htmlFor="art-guess">你的答案</label>
                <input id="art-guess" value={draft} maxLength={28} autoComplete="off" disabled={!guessing}
                  placeholder={!state.online ? "正在重连…" : finished ? "本轮已结束" : state.role === "drawer" ? "本轮由你作画" : state.role === "prompter" ? "本轮由你裁定" : state.status === "active" ? "输入答案" : "等待开局"}
                  onChange={(event) => setDraft(event.target.value)}
                  onKeyDown={(event) => { if (event.key === "Enter" && (event.nativeEvent.isComposing || event.keyCode === 229)) event.preventDefault(); }} />
                <Button type="submit" className="art-icon-button art-send" icon="send" aria-label="发送答案" disabled={!guessing || !draft.trim()} />
              </form>
              <span className="art-guess-hint">{guessing ? "Enter 发送" : ""}</span>
            </aside>
          </div>

          <section className="art-players" aria-label="玩家与积分">
            <div className="art-player-label"><SketchIcon name="users" /><span>玩家</span><small>{state.players.length} / 10</small><small className="art-player-rule">猜中 +2 · 画师 / 出题者 +1</small></div>
            <div className="art-player-list">{state.players.map((player) => {
              const role = player.id === people.drawerId ? "画师" : player.id === people.prompterId ? "出题者" : "猜词";
              const delta = finished ? state.scoreChanges[player.id] : 0;
              return <div key={player.id} className={`art-player ${player.id === "you" ? "is-you" : ""} ${player.id === people.drawerId ? "is-drawer" : ""}`}>
                <AvatarArtwork kind={player.kind} />
                <div><strong>{player.name}{(player.id === "you" ? state.host : player.id === "xiaoyuan" && !state.host) && <SketchIcon name="crown" size={15} aria-label="房主" role="img" />}</strong><small>{role}</small></div>
                <span className="art-score">{player.score}<small>分</small>{delta > 0 && <b>+{delta}</b>}</span>
              </div>;
            })}</div>
          </section>
        </main>}

        {state.view === "packs" && <main className="art-packs">
          <div className="art-page-heading">
            <div><span className="art-meta">已选 {state.selectedPacks.length} / {MAX_SELECTED_PACKS} · 未选时使用默认词包</span><h1>词包<Mark /></h1></div>
            <Button icon="plus" onClick={() => setDialog("pack")}>投稿词包</Button>
          </div>
          <div className="art-pack-tabs" role="tablist" aria-label="词包分类">
            <button type="button" role="tab" aria-selected={packTab === "published"} onClick={() => setPackTab("published")}>已发布<small>{publishedPacks.length}</small></button>
            <button type="button" role="tab" aria-selected={packTab === "review"} onClick={() => setPackTab("review")}>待审核<small>{pendingPacks.length}</small></button>
          </div>
          {packTab === "published" ? <div className="art-pack-grid" role="tabpanel">
            {publishedPacks.map((pack, index) => {
              const selected = state.selectedPacks.includes(pack.id);
              return <article key={pack.id} className={`art-pack ${selected ? "is-selected" : ""}`}>
                <span className="art-pack-index">{String(index + 1).padStart(2, "0")}</span>
                <PackArtwork kind={packArt[pack.id] || "botanical"} />
                <h2>{pack.name}</h2>
                <p>{pack.description}</p>
                <p className="art-pack-words">{pack.words.slice(0, 4).join(" · ")}{pack.words.length > 4 ? " …" : ""}</p>
                <div className="art-pack-foot"><span>{pack.words.length} 词</span>
                  <Button className={selected ? "art-selected" : ""} icon={selected ? "check" : "plus"} aria-pressed={selected} disabled={!selected && state.selectedPacks.length >= MAX_SELECTED_PACKS} onClick={() => act("PACK", { id: pack.id })}>{selected ? "已选用" : "选用"}</Button>
                </div>
              </article>;
            })}
          </div> : <section className="art-review-list" role="tabpanel" aria-label="待审核词包">
            {pendingPacks.map((pack) => <article key={pack.id}>
              <span className="art-review-stamp">待审核</span>
              <h2>{pack.name}</h2><p>{pack.description}</p>
              <p className="art-pack-words">{pack.words.join(" · ")}</p>
              <div><Button icon="check" className="art-accept" disabled={!state.online} onClick={() => { act("REVIEW_PACK", { id: pack.id, approved: true }); setNotice(`「${pack.name}」已发布`); }}>通过</Button>
                <Button icon="cross" className="art-quiet" disabled={!state.online} onClick={() => { act("REVIEW_PACK", { id: pack.id, approved: false }); setNotice(`「${pack.name}」已驳回`); }}>驳回</Button></div>
            </article>)}
            {!pendingPacks.length && <div className="art-review-empty"><PackArtwork kind="botanical" /><h2>暂无待审核词包</h2></div>}
          </section>}
        </main>}

        <footer className="art-study-footer">
          <span>/__art · 本地样例</span>
          <details className="art-study-controls">
            <summary><SketchIcon name="settings" size={17} />样例控制</summary>
            <div className="art-study-panel">
              <fieldset><legend>角色</legend><div>{[["drawer", "画师"], ["guesser", "猜词"], ["prompter", "出题者"]].map(([role, label]) => <Button key={role} aria-pressed={state.role === role} onClick={() => { if (role === "prompter" && state.mode !== "host-judged") act("MODE", { mode: "host-judged" }); dispatch({ type: "ROLE", role }); }}>{label}</Button>)}</div></fieldset>
              <fieldset><legend>字体</legend><div>{[["xiaolai", "小赖"], ["yozai", "悠哉"]].map(([font, label]) => <Button key={font} aria-pressed={settings.font === font} onClick={() => setSettings({ ...settings, font })}>{label}</Button>)}</div></fieldset>
              <label>玩法<select value={state.mode} onChange={(event) => act("MODE", { mode: event.target.value })}><option value="library">词库局</option><option value="host-judged">裁定局</option></select></label>
              <label className="art-check-label"><input type="checkbox" checked={state.host} onChange={(event) => act("HOST", { host: event.target.checked })} />我是房主</label>
              <label className="art-check-label"><input type="checkbox" checked={state.online} onChange={(event) => act("ONLINE", { online: event.target.checked })} />在线</label>
              <label className="art-check-label"><input type="checkbox" checked={settings.failSend} onChange={(event) => setSettings({ ...settings, failSend: event.target.checked })} />猜词发送失败</label>
              <label className="art-check-label"><input type="checkbox" checked={settings.timer} onChange={(event) => setSettings({ ...settings, timer: event.target.checked })} />计时</label>
              <label className="art-check-label"><input type="checkbox" checked={settings.still} onChange={(event) => setSettings({ ...settings, still: event.target.checked })} />减少动作</label>
              <div><Button onClick={() => { act("REPLAY"); setLocalGuesses([]); }}>重置</Button><Button onClick={() => act("TICK", { seconds: state.seconds })}>时间到</Button></div>
            </div>
          </details>
        </footer>
      </div>
      {notice && <div className="art-notice" role="status"><SketchIcon name="check" size={22} />{notice}</div>}
      <div ref={setPortal} />

      <ArtDialog container={portal} open={dialog === "clear"} title="清空这张画布？" description="所有笔画都会被移除，清空后无法撤销。" onClose={() => setDialog(null)}>
        <div className="art-dialog-actions"><Button className="art-quiet" onClick={() => setDialog(null)}>取消</Button><Button className="art-primary" icon="trash" onClick={() => { act("CLEAR", { epoch: state.canvasEpoch }); setDialog(null); }}>清空画布</Button></div>
      </ArtDialog>
      <ArtDialog container={portal} open={dialog === "skip"} title="提前结束这一轮？" description="本轮会结束并公布答案，不会计分。" onClose={() => setDialog(null)}>
        <div className="art-dialog-actions"><Button className="art-quiet" onClick={() => setDialog(null)}>取消</Button><Button className="art-primary" onClick={() => { act("SKIP"); setDialog(null); }}>结束本轮</Button></div>
      </ArtDialog>
      <ArtDialog container={portal} open={dialog === "pack"} title="投稿词包" description="审核通过后可在建房时选用。" onClose={() => { setDialog(null); dispatch({ type: "CLEAR_PACK_ERROR" }); }}>
        <form className="art-form" onSubmit={submitPack}>
          <label>词包名称<input required maxLength={24} value={packDraft.name} onChange={(event) => setPackDraft({ ...packDraft, name: event.target.value })} /></label>
          <label>介绍<input required minLength={8} maxLength={120} value={packDraft.description} onChange={(event) => setPackDraft({ ...packDraft, description: event.target.value })} /></label>
          <label>词语 <small>4–32 个，用逗号、顿号或换行分隔</small><textarea required rows={5} value={packDraft.words} onChange={(event) => setPackDraft({ ...packDraft, words: event.target.value })} /></label>
          {state.packError && <p role="alert" className="art-error">{state.packError}</p>}
          <div className="art-dialog-actions"><Button className="art-quiet" onClick={() => { setDialog(null); dispatch({ type: "CLEAR_PACK_ERROR" }); }}>保留草稿</Button><Button type="submit" className="art-primary" disabled={!state.online}>提交审核</Button></div>
        </form>
      </ArtDialog>
    </div>
  </StillContext.Provider>;
}
