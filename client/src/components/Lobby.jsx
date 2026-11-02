import { Button } from "./ui/button.jsx";
import { Input, Field } from "./ui/field.jsx";
import { RadioCards } from "./ui/selection.jsx";
import { SketchIcon } from "./ui/sketch-icon.jsx";
import { SketchMark } from "./ui/sketch-mark.jsx";
import { InkWord } from "./ink/InkWord.jsx";
import { inkLabels } from "./ink/labels.js";
import { modes } from "../modes.js";

const playing = (status) => ["active", "collecting-word"].includes(status);

function LibraryArt() {
  return (
    <svg viewBox="0 0 64 44" fill="none" strokeLinecap="round" strokeLinejoin="round">
      <path d="m14 9 27-4 4 28-27 4Z" fill="#e6dcc7" stroke="#7a715c" strokeWidth="1.4" />
      <path d="m20 12 27-3 3 28-27 3Z" fill="#f9f4e9" stroke="#504936" strokeWidth="1.6" />
      <path d="m27 19 15-1.6M28 25l11-1.2" stroke="#ad5541" strokeWidth="1.8" />
      <path d="m52 6 2 4 4 .5-3 3 .8 4-3.6-2-3.6 2 .8-4-3-3 4-.5Z" stroke="#bc9244" strokeWidth="1.3" />
    </svg>
  );
}
function JudgedArt() {
  return (
    <svg viewBox="0 0 64 44" fill="none" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 10c0-4 3-5 7-5h22c4 0 6 2 6 5v11c0 3-2 5-6 5H22l-8 7 1-7c-5 0-7-2-7-5Z" fill="#f9f4e9" stroke="#504936" strokeWidth="1.6" />
      <path d="m17 16 5 5 9-10" stroke="#66795a" strokeWidth="2" />
      <path d="M48 24h9l-1 6h-7Z" fill="#ad5541" stroke="#8f4232" strokeWidth="1.3" />
      <path d="M50 24c-1-5 0-9 3-9s4 4 3 9M46 33h13" stroke="#8f4232" strokeWidth="1.4" />
    </svg>
  );
}

export function Lobby({
  roomForm,
  setRoomForm,
  joinCode,
  setJoinCode,
  packs,
  lobby,
  disabled,
  busy,
  pendingJoin,
  onCreate,
  onJoin,
  onDialog,
}) {
  const selected = roomForm.packIds;
  const code = joinCode.trim().toUpperCase();
  return (
    <main className="lobby">
      <div className="page-heading">
        <div>
          <span className="meta">{lobby.length} 间开放房间</span>
          <h1 className="marked-heading">
            <InkWord text={inkLabels.lobby} />
            <SketchMark variant="underline" className="heading-mark" />
          </h1>
        </div>
        <Button variant="outline" onClick={() => onDialog("submit")}>
          <SketchIcon name="plus" />
          投稿词包
        </Button>
      </div>
      <div className="lobby-layout">
        <section className="create-sheet paper-sheet" aria-labelledby="create-title">
          <span className="paper-tape" aria-hidden="true" />
          <h2 id="create-title">
            <SketchIcon name="plus" size={22} />
            创建房间
          </h2>
          <form
            className="stack"
            onSubmit={(event) => {
              event.preventDefault();
              onCreate();
            }}
          >
            <Field
              id="room-name"
              label="房间名称"
              hint="中英文、数字、空格、下划线或短横线"
            >
              {(props) => (
                <Input
                  {...props}
                  required
                  maxLength={32}
                  pattern="[\p{L}\p{N}\s_\-]+"
                  value={roomForm.name}
                  onChange={(event) =>
                    setRoomForm({ ...roomForm, name: event.target.value })
                  }
                />
              )}
            </Field>
            <div className="ui-field">
              <span className="field-label">玩法</span>
              <RadioCards
                label="玩法"
                value={roomForm.mode}
                onValueChange={(mode) => setRoomForm({ ...roomForm, mode })}
                options={[
                  {
                    value: "library",
                    title: "词库局",
                    description: "2 人起 · 自动判定",
                    art: <LibraryArt />,
                  },
                  {
                    value: "host-judged",
                    title: "裁定局",
                    description: "3 人起 · 出题者裁定",
                    art: <JudgedArt />,
                  },
                ]}
              />
              <p className="field-hint">
                {roomForm.mode === "library"
                  ? "随机抽一个词，一人画，其余人猜。"
                  : "一人出题，一人画，出题者裁定答案。"}
              </p>
            </div>
            {roomForm.mode === "library" && (
              <fieldset className="pack-chips">
                <legend>
                  词包
                  <small>
                    {selected.length
                      ? `已选 ${selected.length} / 6`
                      : "未选时使用默认词包"}
                  </small>
                </legend>
                <div className="pack-chip-list">
                  {packs.map((pack) => {
                    const on = selected.includes(pack.id);
                    return (
                      <button
                        type="button"
                        key={pack.id}
                        className="pack-chip"
                        aria-pressed={on}
                        title={pack.description}
                        disabled={selected.length >= 6 && !on}
                        onClick={() =>
                          setRoomForm((form) => ({
                            ...form,
                            packIds: form.packIds.includes(pack.id)
                              ? form.packIds.filter((id) => id !== pack.id)
                              : form.packIds.length < 6
                                ? [...form.packIds, pack.id]
                                : form.packIds,
                          }))
                        }
                      >
                        <SketchIcon name={on ? "check" : "plus"} size={15} />
                        {pack.name}
                        <small>{pack.wordCount}</small>
                      </button>
                    );
                  })}
                </div>
              </fieldset>
            )}
            <Button
              type="submit"
              size="lg"
              disabled={disabled || !roomForm.name.trim()}
              pending={busy}
            >
              创建房间
              <SketchIcon name="arrow" />
            </Button>
          </form>
        </section>
        <section className="room-board" aria-label="大厅房间">
          <form
            className="join-slip"
            onSubmit={(event) => {
              event.preventDefault();
              onJoin(code);
            }}
          >
            <label htmlFor="room-code">房间码</label>
            <Input
              id="room-code"
              className="code-input"
              placeholder="5 位"
              maxLength={5}
              minLength={5}
              required
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              value={joinCode}
              onChange={(event) =>
                setJoinCode(event.target.value.toUpperCase())
              }
            />
            <Button
              type="submit"
              variant="secondary"
              pending={pendingJoin === `join:${code}`}
              disabled={disabled || code.length !== 5}
            >
              加入
              <SketchIcon name="arrow" />
            </Button>
          </form>
          <div className="section-heading">
            <h2>开放房间</h2>
            <span>{lobby.length} 间</span>
          </div>
          {!lobby.length && (
            <div className="empty-lobby">
              <svg viewBox="0 0 120 80" fill="none" aria-hidden="true" strokeLinecap="round" strokeLinejoin="round">
                <path d="M28 12h64l-3 46H31Z" fill="#f9f4e9" stroke="#7a715c" strokeWidth="1.6" />
                <path d="m40 58-10 18M80 58l10 18M60 58v16M24 76h72" stroke="#7a715c" strokeWidth="1.6" />
                <path className="draw" d="M46 40c6-12 14-12 18-4s10 6 14-6" stroke="#ad5541" strokeWidth="2" pathLength="1" style={{ "--at": "0.2s", "--len": "0.7s" }} />
              </svg>
              <h3>暂无开放房间</h3>
              <p>创建房间后，把房间码发给朋友。</p>
            </div>
          )}
          <div className="room-list">
            {lobby.map((item, index) => {
              const full = item.playerCount >= 10;
              return (
                <article key={item.code} className={`room-card tilt-${index % 3}`}>
                  <span className={`room-status ${playing(item.status) ? "is-playing" : ""}`}>
                    <i aria-hidden="true" />
                    {playing(item.status) ? "正在游戏" : "等待新一轮"}
                  </span>
                  <h3>{item.name}</h3>
                  <p className="room-meta">
                    {modes[item.mode]}
                    <span aria-hidden="true">·</span>
                    <span className="room-code-text">{item.code}</span>
                  </p>
                  <div className="room-seats" aria-label={`${item.playerCount} / 10 人`}>
                    {Array.from({ length: 10 }, (_, seat) => (
                      <i key={seat} className={seat < item.playerCount ? "is-taken" : ""} aria-hidden="true" />
                    ))}
                    <small aria-hidden="true">{item.playerCount}/10</small>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    pending={pendingJoin === `join:${item.code}`}
                    disabled={disabled || full}
                    onClick={() => onJoin(item.code)}
                  >
                    {full ? "已满" : "进入"}
                    {!full && <SketchIcon name="arrow" />}
                  </Button>
                </article>
              );
            })}
          </div>
        </section>
      </div>
      <footer className="lobby-footer">
        <p>
          <SketchIcon name="clock" size={18} />
          每轮 100 秒 · 猜中 +2 · 画师和出题者各 +1
        </p>
        <Button variant="ghost" size="sm" onClick={() => onDialog("admin")}>
          词包审核
        </Button>
      </footer>
    </main>
  );
}
