import { useEffect, useRef, useState } from "react";
import { CanvasBoard } from "./CanvasBoard.jsx";
import { GuessComposer } from "./GuessComposer.jsx";
import { GuessFeed } from "./GuessFeed.jsx";
import { Button } from "./ui/button.jsx";
import { ConfirmAction } from "./ui/overlay.jsx";
import { errorText } from "../errors.js";
import { Copy, Check, Timer, Trophy, Users } from "lucide-react";
import { PlayerStrip } from "./PlayerStrip.jsx";
import { Input } from "./ui/field.jsx";

import { modes } from "../modes.js";
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
  const currentRound = useRef(room.round.id);
  currentRound.current = room.round.id;
  const [prompt, setPrompt] = useState("");
  const [promptBusy, setPromptBusy] = useState(false);
  const [promptError, setPromptError] = useState("");
  const promptFlight = useRef(false);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2200);
    return () => clearTimeout(timer);
  }, [copied]);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    setRoundError("");
    setRoundBusy(false);
    roundInFlight.current = false;
    setPrompt("");
    setPromptError("");
    setPromptBusy(false);
    promptFlight.current = false;
  }, [room.round.id]);
  const { round, me } = room;
  const online = connection === "online";
  const disabled = busy || !online;
  async function runRound(task) {
    if (roundInFlight.current) return;
    const submittedRound = room.round.id;
    roundInFlight.current = true;
    setRoundBusy(true);
    setRoundError("");
    try {
      if ((await task()) === false) throw new Error("操作失败，请重试。");
    } catch (error) {
      if (currentRound.current === submittedRound)
        setRoundError(errorText(error));
    } finally {
      if (currentRound.current === submittedRound) {
        roundInFlight.current = false;
        setRoundBusy(false);
      }
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
        <Button
          variant="outline"
          className="room-code"
          type="button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(room.code);
              setCopied(true);
              setCopyError(false);
            } catch {
              setCopied(false);
              setCopyError(true);
            }
          }}
          aria-label={`复制房间码 ${room.code}`}
        >
          {copied ? <Check /> : <Copy />} {copied ? "已复制 " : "房间码 "}
          <strong>{room.code}</strong>
        </Button>
      </header>
      {copyError && (
        <p className="field-error" role="status">
          复制失败，请手动复制房间码：{room.code}
        </p>
      )}
      <section
        className={`round-bar round-${round.status}`}
        aria-label="回合状态"
      >
        <div>
          <span className="eyebrow">
            第 {round.number} 轮 · {statuses[round.status]}
          </span>
          <strong>
            {running
              ? role
              : round.status === "finished"
                ? reasons[round.reason] || "本轮结束"
                : room.players.length < minimum
                  ? `再来 ${minimum - room.players.length} 位朋友就能开局`
                  : host
                    ? "朋友到齐，随时开始"
                    : "等房主开启这一轮"}
          </strong>
        </div>
        <div className="word-clue">
          <span>
            {round.word
              ? round.status === "finished"
                ? "答案"
                : prompter
                  ? "你出的词"
                  : "请画这个词"
              : "线索"}
          </span>
          <strong>{round.word || round.maskedWord || "等一个灵感"}</strong>
        </div>
        <span
          className={`timer ${seconds !== null && seconds <= 15 ? "timer-urgent" : ""}`}
          aria-label={seconds === null ? "尚未计时" : `剩余 ${seconds} 秒`}
        >
          {seconds === null ? (
            <Users size={20} />
          ) : (
            <>
              <Timer size={17} />
              <span>
                {seconds}
                <small>秒</small>
              </span>
            </>
          )}
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
      {round.status === "finished" && (
        <div className="round-result" role="status">
          <Trophy size={19} />
          <p>
            <strong>
              {Object.entries(round.scoreChanges || {})
                .filter(([, score]) => score > 0)
                .map(([id, score]) => `${id} +${score}`)
                .join(" · ") || "这一轮没有得分，下一轮再试试"}
            </strong>
            <span>
              {host
                ? "准备好后，点击「再来一轮」。"
                : "画作已留下，等房主开启下一轮。"}
            </span>
          </p>
        </div>
      )}
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
                const submittedRound = room.round.id;
                promptFlight.current = true;
                setPromptBusy(true);
                setPromptError("");
                try {
                  if ((await onPrompt(prompt.trim())) === false)
                    throw new Error("出题失败，请重试。");
                } catch (issue) {
                  if (currentRound.current === submittedRound)
                    setPromptError(errorText(issue));
                } finally {
                  if (currentRound.current === submittedRound) {
                    promptFlight.current = false;
                    setPromptBusy(false);
                  }
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
      <PlayerStrip room={room} />
    </main>
  );
}
