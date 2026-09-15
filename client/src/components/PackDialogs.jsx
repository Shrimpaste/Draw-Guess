import { useState } from "react";
import { api } from "../api.js";
import { errorText } from "../errors.js";
import { Dialog } from "./Dialog.jsx";

export function PackSubmission({ onClose, onSubmit }) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <Dialog title="投稿词包" onClose={onClose}>
      <p>把适合画出来的词分享给大家，审核通过后会出现在词包列表。</p>
      <form
        className="stack"
        onSubmit={async (event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          const words = [
            ...new Set(
              data
                .get("words")
                .split(/[\n,，]/)
                .map((word) => word.trim())
                .filter(Boolean),
            ),
          ];
          if (
            words.length < 4 ||
            words.length > 32 ||
            words.some((word) => word.length > 28)
          )
            return setError("请填写 4–32 个不同词语，每词不超过 28 字。");
          setBusy(true);
          setError("");
          try {
            await onSubmit({
              name: data.get("name").trim(),
              description: data.get("description").trim(),
              words,
            });
          } catch (issue) {
            setError(errorText(issue));
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          名称
          <input name="name" required maxLength={24} />
        </label>
        <label>
          介绍（8–120 字）
          <textarea
            name="description"
            required
            minLength={8}
            maxLength={120}
            rows={2}
          />
        </label>
        <label>
          词语（每行一个，也可用逗号分隔）
          <textarea name="words" required rows={6} maxLength={1000} />
        </label>
        {error && (
          <p className="feedback-error" role="alert">
            {error}
          </p>
        )}
        <button className="primary-button" disabled={busy}>
          {busy ? "正在投稿…" : "提交审核"}
        </button>
      </form>
    </Dialog>
  );
}

export function PackAdmin({ token, onClose, onChanged }) {
  const [key, setKey] = useState("");
  const [packs, setPacks] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function run(task) {
    setBusy(true);
    setError("");
    try {
      const result = await task();
      setPacks(result.packs);
      onChanged();
    } catch (issue) {
      setError(errorText(issue));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog title="词包审核" onClose={onClose}>
      <form
        className="stack"
        onSubmit={(event) => {
          event.preventDefault();
          run(() => api.adminPacks(token, key));
        }}
      >
        <label>
          审核密钥
          <input
            type="password"
            autoComplete="off"
            required
            value={key}
            onChange={(event) => {
              setKey(event.target.value);
              setPacks(null);
            }}
          />
        </label>
        <small>密钥仅在本次弹窗中使用，关闭后清除。</small>
        <button disabled={busy || !key}>读取待审核词包</button>
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
              <button
                disabled={busy}
                onClick={() => run(() => api.approvePack(token, key, pack.id))}
              >
                通过审核
              </button>
              <button
                disabled={busy}
                onClick={() =>
                  run(async () => {
                    await api.deletePack(token, key, pack.id);
                    return api.adminPacks(token, key);
                  })
                }
              >
                拒绝投稿
              </button>
            </div>
          </article>
        ))}
    </Dialog>
  );
}
