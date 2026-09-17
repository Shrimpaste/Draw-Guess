import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { GameRoom } from "./GameRoom.jsx";
vi.mock("./CanvasBoard.jsx", () => ({ CanvasBoard: () => <div>画布</div> }));
afterEach(cleanup);
const baseRoom = {
  code: "ABCDE",
  name: "朋友画室",
  mode: "host-judged",
  hostId: "host",
  me: { id: "guess" },
  players: [
    { id: "host", score: 0 },
    { id: "drawer", score: 0 },
    { id: "guess", score: 0 },
  ],
  canvas: [],
  messages: [],
  round: {
    id: "r1",
    number: 1,
    status: "active",
    viewerIsGuesser: true,
    drawerId: "drawer",
    prompterId: "host",
    maskedWord: "火·",
    endsAt: Date.now() + 100000,
  },
};
it("does not carry a failed prompt response into a newer round", async () => {
  let reject;
  const onPrompt = vi.fn(
    () =>
      new Promise((_, fail) => {
        reject = fail;
      }),
  );
  const room = {
    ...baseRoom,
    me: { id: "host" },
    round: {
      ...baseRoom.round,
      status: "collecting-word",
      viewerIsGuesser: false,
    },
  };
  const view = render(
    <GameRoom room={room} connection="online" onPrompt={onPrompt} />,
  );
  fireEvent.change(screen.getByLabelText("本轮词语"), {
    target: { value: "咖啡" },
  });
  fireEvent.click(screen.getByRole("button", { name: "确认出题" }));
  view.rerender(
    <GameRoom
      room={{ ...room, round: { ...room.round, id: "r2" } }}
      connection="online"
      onPrompt={onPrompt}
    />,
  );
  await act(async () => reject(new Error("旧回合失败")));
  expect(screen.queryByText("旧回合失败")).not.toBeInTheDocument();
  expect(screen.getByLabelText("本轮词语")).toBeEnabled();
});
it("keeps failed guesses for retry and disables submission during reconnect", async () => {
  const onGuess = vi
    .fn()
    .mockResolvedValueOnce(false)
    .mockResolvedValueOnce(true);
  const props = { room: baseRoom, connection: "online", onGuess };
  const view = render(<GameRoom {...props} />);
  fireEvent.change(screen.getByLabelText("你的答案"), {
    target: { value: "火箭" },
  });
  fireEvent.click(screen.getByRole("button", { name: "发送" }));
  await waitFor(() => expect(onGuess).toHaveBeenCalledWith("火箭"));
  await screen.findByRole("alert");
  expect(screen.getByLabelText("你的答案")).toHaveValue("火箭");
  fireEvent.click(screen.getByRole("button", { name: "发送" }));
  await waitFor(() =>
    expect(screen.getByLabelText("你的答案")).toHaveValue(""),
  );
  view.rerender(<GameRoom {...props} connection="reconnecting" />);
  expect(screen.getByLabelText("你的答案")).toBeEnabled();
  expect(screen.getByRole("button", { name: "发送" })).toBeDisabled();
});
it("judges the selected pending guess by id and exposes round results", () => {
  const onJudge = vi.fn();
  const room = {
    ...baseRoom,
    me: { id: "host" },
    messages: [
      {
        id: "g1",
        type: "guess",
        playerId: "guess",
        text: "月亮",
        status: "pending",
      },
      {
        id: "g2",
        type: "guess",
        playerId: "guess",
        text: "火箭",
        status: "pending",
      },
    ],
  };
  const view = render(
    <GameRoom room={room} connection="online" onJudge={onJudge} />,
  );
  fireEvent.click(
    screen.getByRole("button", { name: "判定 guess 的 火箭 正确" }),
  );
  expect(onJudge).toHaveBeenCalledWith("g2", true);
  view.rerender(
    <GameRoom
      room={{
        ...room,
        round: {
          ...room.round,
          status: "finished",
          word: "火箭",
          reason: "guessed",
          scoreChanges: { guess: 2 },
        },
      }}
      connection="online"
    />,
  );
  expect(screen.getByText("猜中了！")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "再来一轮" })).toBeEnabled();
});
