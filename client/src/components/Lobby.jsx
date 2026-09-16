import { ArrowRight, BookOpen, ChevronDown, Plus, Users } from "lucide-react";
import { Button } from "./ui/button.jsx";
import { Input, Field } from "./ui/field.jsx";
import { Checkbox, RadioCards } from "./ui/selection.jsx";
import { modes } from "../modes.js";

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
  return (
    <main className="lobby">
      <div className="lobby-heading">
        <div>
          <span className="eyebrow">找个位置，落笔吧</span>
          <h1>今天，画点什么？</h1>
        </div>
        <Button variant="outline" onClick={() => onDialog("submit")}>
          <Plus />
          投稿词包
        </Button>
      </div>
      <div className="lobby-layout">
        <section className="compose-panel">
          <div className="panel-title">
            <span className="panel-icon">
              <Plus size={20} />
            </span>
            <div>
              <h2>开一间画室</h2>
              <p>留个位置，等朋友们来。</p>
            </div>
          </div>
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
              hint="中英文、数字、空格、下划线或短横线。"
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
              <span className="field-label">选个玩法</span>
              <RadioCards
                label="玩法"
                value={roomForm.mode}
                onValueChange={(mode) => setRoomForm({ ...roomForm, mode })}
                options={[
                  {
                    value: "library",
                    title: "词库局",
                    description: "2 人起 · 自动判定",
                  },
                  {
                    value: "host-judged",
                    title: "裁定局",
                    description: "3 人起 · 朋友出题",
                  },
                ]}
              />
              <p className="field-hint">
                {roomForm.mode === "library"
                  ? "随机抽一个词，一人画，其余人猜。"
                  : "一人出题，一人画，由出题者裁定答案。"}
              </p>
            </div>
            {roomForm.mode === "library" && (
              <details className="pack-picker">
                <summary>
                  <BookOpen size={16} />
                  <strong>词包</strong>
                  <span>
                    {selected.length
                      ? `已选 ${selected.length} / 6`
                      : "默认词包"}
                  </span>
                  <ChevronDown size={16} />
                </summary>
                <div className="pack-options">
                  <p className="field-hint">
                    最多选择 6 个；不选时使用默认词包。
                  </p>
                  {packs.map((pack) => (
                    <label className="pack-option" key={pack.id}>
                      <Checkbox
                        label={pack.name}
                        checked={selected.includes(pack.id)}
                        disabled={
                          selected.length >= 6 && !selected.includes(pack.id)
                        }
                        onCheckedChange={(checked) =>
                          setRoomForm({
                            ...roomForm,
                            packIds: checked
                              ? [...selected, pack.id]
                              : selected.filter((id) => id !== pack.id),
                          })
                        }
                      />
                      <span>
                        <strong>
                          {pack.name}
                          <small>{pack.wordCount} 词</small>
                        </strong>
                        <span>{pack.description}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </details>
            )}
            <Button
              type="submit"
              disabled={disabled || !roomForm.name.trim()}
              pending={busy}
            >
              创建房间
              <ArrowRight />
            </Button>
          </form>
        </section>
        <section className="room-wall" aria-label="大厅房间">
          <form
            className="join-form"
            onSubmit={(event) => {
              event.preventDefault();
              onJoin(joinCode.trim().toUpperCase());
            }}
          >
            <label className="sr-only" htmlFor="room-code">
              房间码
            </label>
            <Input
              id="room-code"
              placeholder="输入 5 位房间码"
              maxLength={5}
              minLength={5}
              required
              autoComplete="off"
              autoCapitalize="characters"
              value={joinCode}
              onChange={(event) =>
                setJoinCode(event.target.value.toUpperCase())
              }
            />
            <Button
              type="submit"
              variant="secondary"
              pending={pendingJoin === `join:${joinCode.trim().toUpperCase()}`}
              disabled={disabled || joinCode.trim().length !== 5}
            >
              加入朋友
              <ArrowRight />
            </Button>
          </form>
          <div className="section-heading">
            <h2>正在开放的画室</h2>
            <span>{lobby.length} 间</span>
          </div>
          {!lobby.length && (
            <div className="empty-lobby">
              <span aria-hidden="true">✳</span>
              <h3>第一笔，等你来画</h3>
              <p>创建房间，把房间码分享给朋友。</p>
            </div>
          )}
          <div className="room-list">
            {lobby.map((item) => (
              <article key={item.code} className="room-tile">
                <div>
                  <span className="room-status">
                    <i
                      className={
                        ["active", "collecting-word"].includes(item.status)
                          ? "status-playing"
                          : ""
                      }
                    />
                    {["active", "collecting-word"].includes(item.status)
                      ? "正在游戏"
                      : "等待新一轮"}
                  </span>
                  <h3>{item.name}</h3>
                  <small>
                    {modes[item.mode]}
                    <span>·</span>
                    <Users size={13} />
                    {item.playerCount}/10<span>·</span>
                    {item.code}
                  </small>
                </div>
                <Button
                  variant="outline"
                  pending={pendingJoin === `join:${item.code}`}
                  disabled={disabled || item.playerCount >= 10}
                  onClick={() => onJoin(item.code)}
                >
                  {item.playerCount >= 10 ? "已满" : "进入"}
                  <ArrowRight />
                </Button>
              </article>
            ))}
          </div>
        </section>
      </div>
      <footer className="lobby-footer">
        <p>每轮 100 秒 · 猜中 +2，画师和出题者各 +1</p>
        <Button variant="ghost" size="sm" onClick={() => onDialog("admin")}>
          词包审核
        </Button>
      </footer>
    </main>
  );
}
