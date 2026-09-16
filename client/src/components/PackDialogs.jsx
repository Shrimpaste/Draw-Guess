import { useRef, useState } from "react";
import { api } from "../api.js";
import { errorText } from "../errors.js";
import { Modal, ConfirmAction } from "./ui/overlay.jsx";
import { Button } from "./ui/button.jsx";
import { Field, Input, Textarea } from "./ui/field.jsx";

export function parseWords(value) {
  const items = value
    .split(/[\n,，]/)
    .map((word) => word.trim())
    .filter(Boolean);
  const seen = new Set();
  const words = items.filter((word) => {
    const key = word.toLowerCase().replace(/\s+/g, " ");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return { words, duplicates: items.length - words.length };
}
const validText = /^[\p{L}\p{N}\s_-]+$/u;
export function PackSubmission({ draft, onDraftChange, onClose, onSubmit }) {
  const [error, setError] = useState("");
  const [fields, setFields] = useState({});
  const [busy, setBusy] = useState(false);
  const flight = useRef(false);
  const { words, duplicates } = parseWords(draft.words);
  const change = (key) => (event) => {
    onDraftChange({ ...draft, [key]: event.target.value });
    setFields((old) => ({ ...old, [key]: undefined }));
  };
  return (
    <Modal
      title="投稿词包"
      description="分享适合画出来的词，审核通过后，大家都能选用。"
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <form
        className="stack"
        noValidate
        onSubmit={async (event) => {
          event.preventDefault();
          if (flight.current) return;
          const issues = {};
          if (
            !draft.name.trim() ||
            draft.name.trim().length > 24 ||
            !validText.test(draft.name.trim())
          )
            issues.name =
              "填写 1–24 字名称，支持中英文、数字、空格、下划线和短横线。";
          if (
            draft.description.trim().length < 8 ||
            draft.description.trim().length > 120
          )
            issues.description = "请用 8–120 字介绍这个词包。";
          if (
            words.length < 4 ||
            words.length > 32 ||
            words.some((word) => word.length > 28 || !validText.test(word))
          )
            issues.words =
              "请填写 4–32 个不同词语，每词 1–28 字，不含标点符号。";
          setFields(issues);
          if (Object.keys(issues).length) {
            document.getElementById(`pack-${Object.keys(issues)[0]}`)?.focus();
            return;
          }
          flight.current = true;
          setBusy(true);
          setError("");
          try {
            await onSubmit({
              name: draft.name.trim(),
              description: draft.description.trim(),
              words,
            });
          } catch (issue) {
            setError(errorText(issue));
          } finally {
            flight.current = false;
            setBusy(false);
          }
        }}
      >
        <Field id="pack-name" label="词包名称" error={fields.name}>
          {(props) => (
            <Input
              {...props}
              value={draft.name}
              onChange={change("name")}
              maxLength={24}
              disabled={busy}
              placeholder="例如：周末小食堂"
            />
          )}
        </Field>
        <Field
          id="pack-description"
          label="一句话介绍"
          hint={`${draft.description.length}/120 字 · 至少 8 字`}
          error={fields.description}
        >
          {(props) => (
            <Textarea
              {...props}
              value={draft.description}
              onChange={change("description")}
              maxLength={120}
              rows={2}
              disabled={busy}
              placeholder="这是一个什么主题的词包？"
            />
          )}
        </Field>
        <Field
          id="pack-words"
          label="收集一些词语"
          hint={`${words.length}/32 个不同词语${duplicates ? ` · 已自动合并 ${duplicates} 个重复词` : ""} · 每行一个或逗号分隔`}
          error={fields.words}
        >
          {(props) => (
            <Textarea
              {...props}
              value={draft.words}
              onChange={change("words")}
              maxLength={1000}
              rows={5}
              disabled={busy}
              placeholder={"咖啡\n牛角包\n煎蛋\n三明治"}
            />
          )}
        </Field>
        {error && (
          <p className="field-error" role="alert">
            {error}
          </p>
        )}
        <p className="draft-note">
          暂时关闭也没关系，草稿会保留到退出登录或刷新页面。
        </p>
        <footer className="ui-dialog-footer">
          <Button variant="outline" onClick={onClose} disabled={busy}>
            暂存并关闭
          </Button>
          <Button type="submit" pending={busy}>
            提交审核
          </Button>
        </footer>
      </form>
    </Modal>
  );
}

export function PackAdmin({ token, onClose, onChanged }) {
  const [key, setKey] = useState("");
  const [packs, setPacks] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const flight = useRef(false);
  async function run(task) {
    if (flight.current) return;
    flight.current = true;
    setBusy(true);
    setError("");
    try {
      const result = await task();
      setPacks(result.packs);
      onChanged();
    } catch (issue) {
      setError(errorText(issue));
    } finally {
      flight.current = false;
      setBusy(false);
    }
  }
  return (
    <Modal
      title="词包审核"
      description="审核适合大家一起画、一起猜的词语。"
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <form
        className="stack"
        onSubmit={(event) => {
          event.preventDefault();
          run(() => api.adminPacks(token, key));
        }}
      >
        <label>
          审核密钥
          <Input
            type="password"
            autoComplete="off"
            required
            value={key}
            disabled={busy}
            onChange={(event) => {
              setKey(event.target.value);
              setPacks(null);
            }}
          />
        </label>
        <small>密钥仅在本次弹窗中使用，关闭后清除。</small>
        <Button type="submit" pending={busy} disabled={!key}>
          读取待审核词包
        </Button>
      </form>
      {error && (
        <p role="alert" className="feedback-error">
          {error}
        </p>
      )}
      {packs && !packs.some((pack) => pack.status === "pending") && (
        <p>没有待审核的投稿。</p>
      )}
      {packs
        ?.filter((pack) => pack.status === "pending")
        .map((pack) => (
          <article className="pack-review" key={pack.id}>
            <h3>{pack.name}</h3>
            <p>{pack.description}</p>
            <p className="pack-words">{pack.words.join(" · ")}</p>
            <div className="actions">
              <Button
                disabled={busy}
                onClick={() => run(() => api.approvePack(token, key, pack.id))}
              >
                通过审核
              </Button>
              <ConfirmAction
                title={`拒绝「${pack.name}」？`}
                description="这份投稿将被删除，无法恢复。"
                confirmText="拒绝投稿"
                disabled={busy}
                onConfirm={() =>
                  run(async () => {
                    await api.deletePack(token, key, pack.id);
                    return api.adminPacks(token, key);
                  })
                }
              >
                <Button variant="ghost" disabled={busy}>
                  拒绝投稿
                </Button>
              </ConfirmAction>
            </div>
          </article>
        ))}
    </Modal>
  );
}
