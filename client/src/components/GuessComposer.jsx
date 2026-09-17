import { memo, useEffect, useRef, useState } from "react";
import { ArrowUp, RotateCcw } from "lucide-react";
import { errorText } from "../errors.js";
import { Input } from "./ui/field.jsx";
import { Button } from "./ui/button.jsx";

export const GuessComposer = memo(function GuessComposer({ roundId, online, onGuess }) {
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState(null);
  const busyRef = useRef(false),
    composing = useRef(false),
    edits = useRef(0),
    input = useRef(null);
  const context = useRef(roundId);
  context.current = roundId;
  useEffect(() => {
    setDraft("");
    setPending(false);
    setFailure(null);
    busyRef.current = false;
    edits.current++;
  }, [roundId]);
  async function submit(value = draft.trim()) {
    if (!value || !online || busyRef.current || composing.current) return;
    const submittedRound = roundId,
      version = edits.current,
      matchesDraft = value === draft.trim(),
      clientGuessId = failure?.value === value ? failure.clientGuessId : crypto.randomUUID();
    busyRef.current = true;
    setPending(true);
    setFailure(null);
    if (matchesDraft) setDraft("");
    input.current?.focus({ preventScroll: true });
    try {
      if ((await onGuess(value, clientGuessId)) === false)
        throw new Error("发送失败，请稍后重试。");
      if (context.current !== submittedRound) return;
    } catch (error) {
      if (context.current === submittedRound) {
        setFailure({ text: errorText(error), value, clientGuessId });
        if (matchesDraft && edits.current === version) setDraft(value);
      }
    } finally {
      if (context.current === submittedRound) {
        busyRef.current = false;
        setPending(false);
      }
    }
  }
  return (
    <div className="composer-shell">
      <form
        className="guess-composer"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <Input
          ref={input}
          aria-label="你的答案"
          aria-describedby={failure ? "guess-error" : "guess-hint"}
          value={draft}
          maxLength={28}
          autoComplete="off"
          enterKeyHint="send"
          placeholder={online ? "这是……？" : "重连中，可以先写下答案"}
          onChange={(event) => {
            edits.current++;
            setDraft(event.target.value);
          }}
          onCompositionStart={() => {
            composing.current = true;
          }}
          onCompositionEnd={() => {
            composing.current = false;
          }}
          onKeyDown={(event) => {
            if (
              event.key === "Enter" &&
              (composing.current ||
                event.nativeEvent.isComposing ||
                event.keyCode === 229)
            )
              event.preventDefault();
          }}
        />
        <Button
          type="submit"
          size="icon"
          aria-label={pending ? "正在发送" : "发送"}
          pending={pending}
          disabled={!online || !draft.trim()}
        >
          {!pending && <ArrowUp />}
        </Button>
      </form>
      {failure ? (
        <div className="composer-error" id="guess-error" role="alert">
          <span>
            {failure.text}
            {failure.value !== draft.trim() && (
              <small>未发送：{failure.value}</small>
            )}
          </span>
          <Button
            size="sm"
            variant="ghost"
            disabled={!online || pending}
            onClick={() => submit(failure.value)}
          >
            <RotateCcw />
            重试
          </Button>
        </div>
      ) : (
        <p id="guess-hint" className="composer-hint">
          {pending
            ? "正在发送，可以继续输入下一条"
            : online
              ? "Enter 发送 · 猜错也没关系"
              : "连接恢复后再发送"}
        </p>
      )}
    </div>
  );
});
