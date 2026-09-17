import { memo, useEffect, useRef, useState } from "react";
import { ArrowDown, Check, X } from "lucide-react";
import { Button } from "./ui/button.jsx";
import { errorText } from "../errors.js";

function JudgeActions({ message, disabled, onJudge }) {
  const [pending, setPending] = useState(false),
    [error, setError] = useState("");
  const inFlight = useRef(false);
  async function judge(accepted) {
    if (inFlight.current) return;
    inFlight.current = true;
    setPending(true);
    setError("");
    try {
      if ((await onJudge(message.id, accepted)) === false)
        throw new Error("裁定失败，请重试。");
    } catch (issue) {
      setError(errorText(issue));
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }
  return (
    <>
      <div className="judge-actions">
        <Button
          size="sm"
          variant="secondary"
          pending={pending}
          disabled={disabled}
          onClick={() => judge(true)}
          aria-label={`判定 ${message.playerId} 的 ${message.text} 正确`}
        >
          <Check />
          猜对了
        </Button>
        <Button
          size="sm"
          variant="ghost"
          disabled={disabled || pending}
          onClick={() => judge(false)}
          aria-label={`判定 ${message.playerId} 的 ${message.text} 错误`}
        >
          <X />
          还不对
        </Button>
      </div>
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
    </>
  );
}
const noLocalGuesses = [];
export const GuessFeed = memo(function GuessFeed({ room, localGuesses = noLocalGuesses, canJudge, disabled, onJudge }) {
  const ref = useRef(null),
    pinned = useRef(true),
    last = useRef(null);
  const [unread, setUnread] = useState(false);
  useEffect(() => {
    pinned.current = true;
    setUnread(false);
  }, [room.round.id]);
  useEffect(() => {
    const newest = localGuesses.at(-1)?.id || room.messages.at(-1)?.id;
    if (pinned.current && ref.current)
      ref.current.scrollTop = ref.current.scrollHeight;
    else if (newest !== last.current) setUnread(true);
    last.current = newest;
  }, [room.messages, localGuesses]);
  return (
    <div className="feed-wrap">
      <div
        className="guess-feed"
        role="log"
        aria-label="猜词记录"
        ref={ref}
        onScroll={() => {
          const n = ref.current;
          pinned.current = n.scrollHeight - n.scrollTop - n.clientHeight < 40;
          if (pinned.current) setUnread(false);
        }}
      >
        {room.messages.map((message) => (
          <div
            className={`message message-${message.type} message-${message.status || "info"} ${message.playerId === room.me.id ? "message-mine" : ""}`}
            key={message.id}
          >
            {message.playerId && (
              <strong>
                {message.playerId === room.me.id ? "我" : message.playerId}
              </strong>
            )}
            <span>{message.text}</span>
            {message.type === "guess" && (
              <small>
                {
                  {
                    pending: "待裁定",
                    rejected: "未猜中",
                    accepted: "猜中了",
                    closed: "已结束",
                  }[message.status]
                }
              </small>
            )}
            {canJudge && message.status === "pending" && (
              <JudgeActions
                message={message}
                disabled={disabled}
                onJudge={onJudge}
              />
            )}
          </div>
        ))}
        {localGuesses.map((guess) => (
          <div key={guess.id} className={`message message-guess message-mine message-${guess.status}`}>
            <strong>我</strong>
            <span>{guess.text}</span>
            <small>{{ sending: "发送中…", confirming: "等待同步…", failed: "未确认送达，请重试" }[guess.status]}</small>
          </div>
        ))}
      </div>
      {unread && (
        <Button
          className="new-messages"
          size="sm"
          variant="secondary"
          onClick={() => {
            pinned.current = true;
            setUnread(false);
            ref.current.scrollTop = ref.current.scrollHeight;
          }}
        >
          <ArrowDown />
          新消息
        </Button>
      )}
    </div>
  );
}, (before, after) => before.room.messages === after.room.messages && before.room.round.id === after.room.round.id && before.room.me.id === after.room.me.id && before.localGuesses === after.localGuesses && before.canJudge === after.canJudge && before.disabled === after.disabled && before.onJudge === after.onJudge);
