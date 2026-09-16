import { useEffect, useRef, useState } from "react";
import { CanvasBoard } from "./CanvasBoard.jsx";
import { GuessComposer } from "./GuessComposer.jsx";
import { GuessFeed } from "./GuessFeed.jsx";
import { Button } from "./ui/button.jsx";
import { ConfirmAction } from "./ui/overlay.jsx";
import { errorText } from "../errors.js";
import { Input } from "./ui/field.jsx";

export const modes = { library: "词库局", "host-judged": "裁定局" };
const statuses = {
  waiting: "等待开局",
  "collecting-word": "等待出题",
  active: "正在作画",
  finished: "本轮结束",
};
const reasons = {
  guessed: "猜中了！",
  timeout: "时间到",
  skipped: "房主结束本轮",
  "player-left": "玩家离开，本轮结束",
};

export function GameRoom({
  room,
  connection,
  busy,
  onStart,
  onSkip,
  onGuess,
  onPrompt,
  onJudge,
  onCanvas,
}) {
  const [now, setNow] = useState(Date.now());
  const [roundBusy, setRoundBusy] = useState(false);
  const [roundError, setRoundError] = useState("");
  const roundInFlight = useRef(false);
  const [prompt, setPrompt] = useState("");
  const [promptBusy, setPromptBusy] = useState(false);
  const [promptError, setPromptError] = useState("");
  const promptFlight = useRef(false);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    setRoundError("");
    setPrompt("");
  }, [room.round.id]);
  const { round, me } = room;
  const online = connection === "online";
  const disabled = busy || !online;
  async function runRound(task) {
    if (roundInFlight.current) return;
    roundInFlight.current = true;
    setRoundBusy(true);
    setRoundError("");
    try {
      if ((await task()) === false) throw new Error("操作失败，请重试。");
    } catch (error) {
      setRoundError(errorText(error));
    } finally {
      roundInFlight.current = false;
      setRoundBusy(false);
    }
  }
  const drawer = round.drawerId === me.id;
  const prompter = round.prompterId === me.id;
  const host = room.hostId === me.id;
  const running = ["active", "collecting-word"].includes(round.status);
  const minimum = room.mode === "host-judged" ? 3 : 2;
  const seconds = round.endsAt
    ? Math.min(
        round.status === "collecting-word" ? 30 : 100,
        Math.max(0, Math.ceil((round.endsAt - now) / 1000)),
      )
    : null;
  const role = drawer
    ? "你是画师"
    : prompter
      ? "你来出题与裁定"
      : round.viewerIsGuesser
        ? "轮到你猜"
        : "一起等开局";
  return (
    <main className="game-room">
      <header className="room-heading">
        <div>
          <span className="eyebrow">
            {modes[room.mode]} · {room.players.length} / 10 人
          </span>
          <h1>{room.name}</h1>
        </div>
        <button
          className="room-code"
          type="button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(room.code);
              setCopied(true);
            } catch {
              setCopied(false);
            }
          }}
          aria-label={`复制房间码 ${room.code}`}
        >
          {copied ? "已复制 " : "房间码 "}
          <strong>{room.code}</strong>
        </button>
      </header>
      <section className="round-bar" aria-label="回合状态">
        <div>
          <span className="eyebrow">
            第 {round.number} 轮 · {statuses[round.status]}
          </span>
          <strong>
            {running
              ? role
              : round.status === "finished"
                ? reasons[round.reason] || "本轮结束"
                : `还需 ${Math.max(0, minimum - room.players.length)} 人即可开局`}
          </strong>
        </div>
        <div className="word-clue">
          <span>
            {round.word
              ? round.status === "finished"
                ? "答案"
                : "请画这个词"
              : "线索"}
          </span>
          <strong>{round.word || round.maskedWord || "等一个灵感"}</strong>
        </div>
        <span
          className={`timer ${seconds !== null && seconds <= 15 ? "timer-urgent" : ""}`}
          aria-label="剩余时间"
        >
          {seconds === null ? "—" : `${seconds}s`}
        </span>
        {host &&
          (running ? (
            <ConfirmAction
              title="提前结束这一轮？"
              description="本轮会结束并公布答案，不会计分。"
              confirmText="结束本轮"
              onConfirm={() => runRound(onSkip)}
            >
              <Button variant="ghost" disabled={disabled || roundBusy}>
                结束本轮
              </Button>
            </ConfirmAction>
          ) : (
            <Button
              disabled={disabled || room.players.length < minimum}
              pending={roundBusy}
              onClick={() => runRound(onStart)}
            >
              {round.number ? "再来一轮" : "开始游戏"}
            </Button>
          ))}
        {roundError && (
          <p className="field-error" role="alert">
            {roundError}
          </p>
        )}
      </section>
      <div className="play-layout">
        <CanvasBoard
          room={room}
          isDrawer={drawer && round.status === "active" && online}
          onStroke={(stroke) => onCanvas("canvas:stroke", stroke)}
          onClear={() => onCanvas("canvas:clear")}
          onUndo={() => onCanvas("canvas:undo")}
        />
        <section className="guess-panel" aria-label="猜词与裁定">
          <header>
            <h2>{prompter ? "出题与裁定" : "灵感接力"}</h2>
            <small>
              {round.viewerIsGuesser
                ? "大胆猜，猜错也没关系"
                : drawer
                  ? "用画面表达，别写出答案"
                  : "看画，也看大家的脑洞"}
            </small>
          </header>
          {round.status === "collecting-word" && prompter && (
            <form
              className="prompt-form"
              onSubmit={async (event) => {
                event.preventDefault();
                if (promptFlight.current || !prompt.trim()) return;
                promptFlight.current = true;
                setPromptBusy(true);
                setPromptError("");
                try {
                  if ((await onPrompt(prompt.trim())) === false)
                    throw new Error("出题失败，请重试。");
                } catch (issue) {
                  setPromptError(errorText(issue));
                } finally {
                  promptFlight.current = false;
                  setPromptBusy(false);
                }
              }}
            >
              <label>
                本轮词语
                <Input
                  required
                  maxLength={28}
                  value={prompt}
                  disabled={promptBusy}
                  onChange={(event) => setPrompt(event.target.value)}
                  placeholder="给画师一个灵感"
                />
              </label>
              {promptError && (
                <p role="alert" className="field-error">
                  {promptError}
                </p>
              )}
              <Button
                type="submit"
                pending={promptBusy}
                disabled={disabled || !prompt.trim()}
              >
                确认出题
              </Button>
            </form>
          )}
          <GuessFeed
            room={room}
            canJudge={prompter && round.status === "active"}
            disabled={disabled}
            onJudge={onJudge}
          />
          {round.viewerIsGuesser ? (
            <GuessComposer
              roundId={round.id}
              online={online && !busy}
              onGuess={onGuess}
            />
          ) : (
            <div className="role-hint">
              {round.status === "finished"
                ? "画作先留着，等下一次灵感。"
                : drawer
                  ? "你负责画，朋友们负责脑洞。"
                  : prompter
                    ? "观察大家的答案，及时给出裁定。"
                    : "朋友到齐后，就可以开始了。"}
            </div>
          )}
        </section>
      </div>
      <details className="players-details">
        <summary>
          玩家与积分{" "}
          <span>{room.players.length} 人 · 猜中 +2，画师 / 出题者 +1</span>
        </summary>
        <div className="player-list">
          {room.players.map((player) => (
            <div key={player.id} className="player-row">
              <strong>
                {player.id}
                {player.id === me.id ? "（我）" : ""}
              </strong>
              <span>
                {player.id === room.hostId ? "房主 " : ""}
                {player.id === round.drawerId
                  ? "画师"
                  : player.id === round.prompterId
                    ? "出题者"
                    : ""}
              </span>
              <b>
                {player.score} 分{" "}
                {round.scoreChanges?.[player.id] > 0
                  ? `(+${round.scoreChanges[player.id]})`
                  : ""}
              </b>
            </div>
          ))}
        </div>
      </details>
    </main>
  );
}
