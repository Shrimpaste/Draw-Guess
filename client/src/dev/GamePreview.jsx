import { useState } from "react";
import { GameRoom } from "../components/GameRoom.jsx";
import { Button } from "../components/ui/button.jsx";
import { RadioCards, Checkbox } from "../components/ui/selection.jsx";

// Deterministic, local-only scenarios for responsive and slow-response QA.
// This module is only reachable through the DEV branch in main.jsx.
const players = [
  { id: "小圆", score: 2 },
  { id: "阿墨", score: 1 },
  { id: "你", score: 4 },
];
const sample = [
  [
    [290, 400],
    [290, 245],
    [590, 245],
    [590, 400],
    [565, 440],
    [320, 440],
    [290, 400],
  ],
  [
    [590, 270],
    [665, 270],
    [690, 310],
    [665, 350],
    [590, 350],
  ],
  [
    [325, 480],
    [590, 480],
  ],
  [
    [380, 210],
    [365, 170],
    [390, 130],
  ],
  [
    [465, 210],
    [450, 170],
    [475, 130],
  ],
].map((points, index) => ({
  id: `sample-${index}`,
  tool: "pen",
  color: index > 2 ? "#cb4829" : "#16110f",
  width: 6,
  points: points.map(([x, y]) => ({ x, y })),
}));
export default function GamePreview() {
  const [role, setRole] = useState("drawer"),
    [status, setStatus] = useState("active"),
    [online, setOnline] = useState(true),
    [fail, setFail] = useState(false);
  const [canvas, setCanvas] = useState(sample),
    [epoch, setEpoch] = useState(0),
    [messages, setMessages] = useState([
      { id: "welcome", type: "system", text: "第 3 回合开始，灵感已经就位。" },
      {
        id: "guess1",
        type: "guess",
        playerId: "小圆",
        text: "一杯热可可？",
        status: "pending",
      },
    ]);
  const [roundId, setRoundId] = useState("preview"),
    [endsAt, setEndsAt] = useState(Date.now() + 100000);
  const room = {
    code: "INK24",
    name: "周末的灵感小屋",
    mode: "host-judged",
    hostId: "你",
    me: { id: "你" },
    players,
    canvas,
    canvasEpoch: epoch,
    canvasVersion: 0,
    messages,
    round: {
      id: roundId,
      number: 3,
      status,
      drawerId: role === "drawer" ? "你" : "阿墨",
      prompterId: role === "prompter" ? "你" : "小圆",
      viewerIsGuesser: role === "guesser" && status === "active",
      word: role !== "guesser" || status === "finished" ? "咖啡" : null,
      maskedWord: "咖·",
      endsAt: ["active", "collecting-word"].includes(status) ? endsAt : null,
      reason: "guessed",
      scoreChanges: status === "finished" ? { 你: 2, 阿墨: 1 } : null,
    },
  };
  async function delay() {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    if (fail) throw Error("模拟网络波动，请重试。");
  }
  function transition(next) {
    setStatus(next);
    setRoundId(crypto.randomUUID());
    setEndsAt(Date.now() + (next === "collecting-word" ? 30000 : 100000));
  }
  return (
    <>
      <div className="preview-switcher">
        <strong>本地状态预览</strong>
        <RadioCards
          label="预览角色"
          value={role}
          onValueChange={setRole}
          options={[
            { value: "drawer", title: "画师" },
            { value: "guesser", title: "猜词" },
            { value: "prompter", title: "裁定" },
          ]}
        />
        <div className="preview-controls">
          {["waiting", "collecting-word", "active", "finished"].map(
            (next, index) => (
              <Button
                size="sm"
                variant={status === next ? "secondary" : "ghost"}
                key={next}
                onClick={() => transition(next)}
              >
                {["等待", "出题", "作画", "结果"][index]}
              </Button>
            ),
          )}
          <label>
            <Checkbox
              label="在线"
              checked={online}
              onCheckedChange={setOnline}
            />
            在线
          </label>
          <label>
            <Checkbox
              label="请求失败"
              checked={fail}
              onCheckedChange={setFail}
            />
            请求失败
          </label>
        </div>
      </div>
      <div className="app-shell in-room">
        <header className="site-header">
          <a className="brand" href="/__ui">
            ink<span>muse</span>
            <i>你画我猜</i>
          </a>
          <span
            className={`connection connection-${online ? "online" : "reconnecting"}`}
          >
            {online ? "已连接" : "正在重连"}
          </span>
        </header>
        <GameRoom
          room={room}
          connection={online ? "online" : "reconnecting"}
          onStart={async () => {
            await delay();
            transition("active");
          }}
          onSkip={async () => {
            await delay();
            setStatus("finished");
          }}
          onPrompt={async () => {
            await delay();
            setStatus("active");
            setEndsAt(Date.now() + 100000);
          }}
          onGuess={async (text) => {
            await delay();
            setMessages((old) => [
              ...old,
              {
                id: crypto.randomUUID(),
                type: "guess",
                playerId: "你",
                text,
                status: "pending",
              },
            ]);
          }}
          onJudge={async (id, accepted) => {
            await delay();
            setMessages((old) =>
              old.map((message) =>
                message.id === id
                  ? { ...message, status: accepted ? "accepted" : "rejected" }
                  : message,
              ),
            );
          }}
          onCanvas={(type, stroke) => {
            if (type === "canvas:stroke")
              setCanvas((old) => {
                const index = old.findIndex((item) => item.id === stroke.id);
                return index < 0
                  ? [...old, stroke]
                  : old.map((item, i) =>
                      i === index
                        ? {
                            ...item,
                            points: [...item.points, ...stroke.points],
                          }
                        : item,
                    );
              });
            else {
              setCanvas((old) =>
                type === "canvas:clear" ? [] : old.slice(0, -1),
              );
              setEpoch((old) => old + 1);
            }
            return true;
          }}
        />
      </div>
    </>
  );
}
