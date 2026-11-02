import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CanvasBoard } from "./CanvasBoard.jsx";
import { GuessComposer } from "./GuessComposer.jsx";
import { GuessFeed } from "./GuessFeed.jsx";
import { Button } from "./ui/button.jsx";
import { ConfirmAction } from "./ui/overlay.jsx";
import { SketchIcon } from "./ui/sketch-icon.jsx";
import { InkWord, inkLayout } from "./ink/InkWord.jsx";
import { inkLabels } from "./ink/labels.js";
import { errorText } from "../errors.js";
import { sfx } from "../sound.js";
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
  guessed: inkLabels.guessed,
  timeout: inkLabels.timeout,
  skipped: inkLabels.skipped,
  "player-left": inkLabels.left,
};

function WordClue({ round, drawer, prompter }) {
  const finished = round.status === "finished";
  if (round.word) {
    const label = finished ? "答案" : prompter ? "你出的词" : drawer ? "请画这个词" : "词语";
    return (
      <div className={`word-clue ${finished ? "word-answer" : "word-open"}`}>
        <span>{label}</span>
        {finished && inkLayout(round.word) ? (
          <strong><InkWord text={round.word} /></strong>
        ) : (
          <strong>{round.word}</strong>
        )}
      </div>
    );
  }
  if (round.maskedWord) {
    const chars = Array.from(round.maskedWord);
    return (
      <div className="word-clue">
        <span>提示</span>
        <div className="clue-slots" role="group" aria-label={`提示，共 ${chars.length} 字`}>
          {chars.map((char, index) =>
            char === "·" ? (
              <span key={index} className="clue-slot clue-slot-empty" aria-hidden="true" />
            ) : (
              <span key={index} className="clue-slot">{char}</span>
            ),
          )}
        </div>
      </div>
    );
  }
  return (
    <div className="word-clue word-none">
      <span>词语</span>
      <strong>{round.status === "collecting-word" ? "出题中" : "—"}</strong>
    </div>
  );
}

const RING = 2 * Math.PI * 21;
function TimerRing({ seconds, total }) {
  if (seconds === null)
    return (
      <span className="timer timer-idle" role="timer" aria-label="尚未计时">
        <SketchIcon name="clock" size={26} />
      </span>
    );
  const urgent = seconds <= 15;
  return (
    <span className={`timer ${urgent ? "timer-urgent" : ""}`} role="timer" aria-label={`剩余 ${seconds} 秒`}>
      <svg viewBox="0 0 52 52" aria-hidden="true">
        <circle className="timer-track" cx="26" cy="26" r="21" />
        <circle
          className="timer-ink"
          cx="26"
          cy="26"
          r="21"
          strokeDasharray={RING}
          strokeDashoffset={RING * (1 - seconds / total)}
          transform="rotate(-90 26 26)"
        />
      </svg>
      <strong key={seconds <= 10 ? seconds : "steady"} aria-hidden="true">
        {seconds}
      </strong>
    </span>
  );
}

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
  const latestRoom = useRef(room);
  latestRoom.current = room;
  const [localGuesses, setLocalGuesses] = useState([]);
  const confirmedGuesses = useMemo(() => new Set(
    room.messages.filter((message) => message.playerId === room.me.id).map((message) => message.clientGuessId),
  ), [room.messages, room.me.id]);
  const pendingGuesses = useMemo(() => localGuesses.filter(
    (guess) => guess.roundId === room.round.id && !confirmedGuesses.has(guess.id),
  ), [localGuesses, confirmedGuesses, room.round.id]);
  useEffect(() => {
    setLocalGuesses((previous) => {
      const remaining = previous.filter((guess) => guess.roundId === room.round.id && !confirmedGuesses.has(guess.id));
      return remaining.length === previous.length ? previous : remaining;
    });
  }, [confirmedGuesses, room.round.id]);
  const submitGuess = useCallback(async (text, id) => {
    const roundId = room.round.id;
    sfx.tap();
    setLocalGuesses((previous) => [...previous.filter((guess) => guess.id !== id), { id, text, roundId, status: "sending" }]);
    try {
      if ((await onGuess(text, id)) === false) throw new Error("发送失败，请稍后重试。");
      if (currentRound.current === roundId) {
        setLocalGuesses((previous) => previous.map((guess) => guess.id === id ? { ...guess, status: "confirming" } : guess));
      }
      return true;
    } catch (error) {
      // The broadcast can succeed even when the HTTP response is lost.
      if (latestRoom.current.messages.some((message) => message.playerId === latestRoom.current.me.id && message.clientGuessId === id)) return true;
      if (currentRound.current === roundId) {
        setLocalGuesses((previous) => previous.map((guess) => guess.id === id ? { ...guess, status: "failed" } : guess));
      }
      throw error;
    }
  }, [onGuess, room.round.id]);
  const judge = useCallback((id, accepted) => {
    sfx.stamp();
    return onJudge(id, accepted);
  }, [onJudge]);
  const stroke = useCallback((value) => onCanvas("canvas:stroke", value), [onCanvas]);
  const clear = useCallback(() => onCanvas("canvas:clear"), [onCanvas]);
  const undo = useCallback(() => onCanvas("canvas:undo"), [onCanvas]);
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

  // Cues follow authoritative transitions only; the state seen on entering a room is silent.
  const heard = useRef(null);
  useEffect(() => {
    const accepted = new Set(room.messages.filter((message) => message.status === "accepted").map((message) => message.id));
    const previous = heard.current;
    heard.current = { roundId: round.id, status: round.status, accepted };
    if (!previous) return;
    const freshAccept = [...accepted].some((id) => !previous.accepted.has(id));
    if (freshAccept) sfx.correct();
    if (previous.roundId === round.id && previous.status === round.status) return;
    if (round.status === "active") sfx.start();
    else if (round.status === "finished") {
      if (round.reason === "guessed" && !freshAccept) sfx.correct();
      if (round.reason === "timeout") sfx.timeUp();
    }
  }, [room.messages, round.id, round.status, round.reason]);

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
  const finished = round.status === "finished";
  const minimum = room.mode === "host-judged" ? 3 : 2;
  const total = round.status === "collecting-word" ? 30 : 100;
  const seconds = round.endsAt
    ? Math.min(total, Math.max(0, Math.ceil((round.endsAt - now) / 1000)))
    : null;
  const tick = useRef(null);
  useEffect(() => {
    if (round.status !== "active" || seconds === null || seconds > 10 || seconds <= 0) {
      tick.current = null;
      return;
    }
    if (tick.current !== null && tick.current !== seconds) (seconds <= 3 ? sfx.urgentTick : sfx.tick)();
    tick.current = seconds;
  }, [seconds, round.status]);

  const headline = running
    ? round.status === "collecting-word"
      ? prompter ? inkLabels.prompt : inkLabels.waitPrompt
      : drawer ? inkLabels.draw : prompter ? inkLabels.judge : round.viewerIsGuesser ? inkLabels.guess : inkLabels.drawing
    : finished
      ? reasons[round.reason] || inkLabels.finished
      : room.players.length < minimum
        ? `还差 ${minimum - room.players.length} 人`
        : host ? inkLabels.ready : inkLabels.waitHost;
  const scoreLine = Object.entries(round.scoreChanges || {})
    .filter(([, score]) => score > 0)
    .map(([id, score]) => `${id} +${score}`)
    .join(" · ");
  const roleHint = finished
    ? null
    : drawer
      ? round.status === "collecting-word" ? "出题后开始计时" : "画出词语，不要写字"
      : prompter
        ? round.status === "collecting-word" ? "写下词语后开始作画" : "逐条裁定猜词"
        : running ? "等待下一轮" : "开局后在这里猜词";
  return (
    <main className={`game-room status-${round.status} ${drawer ? "me-drawer" : ""}`}>
      <header className="room-heading">
        <div className="room-title">
          <h1>{room.name}</h1>
          <span className="meta">
            {modes[room.mode]} · {room.players.length} / 10 人
          </span>
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
          <span className="room-code-label">{copied ? "已复制" : "房间码"}</span>
          <strong>{room.code}</strong>
          <SketchIcon name={copied ? "check" : "copy"} />
        </Button>
      </header>
      {copyError && (
        <p className="field-error" role="status">
          复制失败，请手动复制房间码：{room.code}
        </p>
      )}
      <section className="round-strip" aria-label="回合状态">
        <div className="round-state">
          <span className="meta">
            {round.number ? `第 ${round.number} 轮` : "未开局"} · {statuses[round.status]}
          </span>
          <strong className={`round-headline ${finished && round.reason === "guessed" ? "is-correct" : ""}`}>
            <InkWord text={headline} />
          </strong>
        </div>
        <WordClue round={round} drawer={drawer} prompter={prompter} />
        <TimerRing seconds={seconds} total={total} />
        <div className="round-action">
          {host ? (
            running ? (
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
                <SketchIcon name="arrow" />
              </Button>
            )
          ) : (
            !drawer && <span className="round-wait">{running ? `${round.drawerId || "画师"} 作画` : "等房主开局"}</span>
          )}
        </div>
        {roundError && (
          <p className="field-error round-error" role="alert">
            {roundError}
          </p>
        )}
      </section>
      <div className="play-layout">
        <PlayerStrip room={room} />
        <div className="stage-column">
          <CanvasBoard
            room={room}
            isDrawer={drawer && round.status === "active" && online}
            onStroke={stroke}
            onClear={clear}
            onUndo={undo}
          />
          {finished && (
            <div className="result-slip" role="status" key={round.id}>
              <SketchIcon name={scoreLine ? "star" : "clock"} size={22} />
              <p>
                <strong>{scoreLine || "本轮无人得分"}</strong>
                <span>{host ? "点「再来一轮」开始" : "等房主开下一轮"}</span>
              </p>
            </div>
          )}
        </div>
        <section className="guess-panel" aria-label="猜词与裁定">
          <span className="notebook-rings" aria-hidden="true" />
          <header>
            <h2>{prompter ? "出题与裁定" : "猜词"}</h2>
            <small>{room.messages.filter((message) => message.type === "guess").length + pendingGuesses.length} 条</small>
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
              <label className="ui-field">
                <span>本轮词语</span>
                <Input
                  required
                  maxLength={28}
                  value={prompt}
                  disabled={promptBusy}
                  autoComplete="off"
                  onChange={(event) => setPrompt(event.target.value)}
                  placeholder="1–28 字"
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
            localGuesses={pendingGuesses}
            canJudge={prompter && round.status === "active"}
            disabled={disabled}
            onJudge={judge}
          />
          {round.viewerIsGuesser ? (
            <GuessComposer
              roundId={round.id}
              online={online && !busy}
              onGuess={submitGuess}
              confirmedGuessIds={confirmedGuesses}
            />
          ) : (
            roleHint && <p className="role-hint">{roleHint}</p>
          )}
        </section>
      </div>
    </main>
  );
}
