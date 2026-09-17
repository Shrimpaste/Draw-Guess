import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { GuessFeed } from "./GuessFeed.jsx";
afterEach(cleanup);
const message = (id) => ({
  id,
  type: "guess",
  text: id,
  playerId: "小圆",
  status: "pending",
});
const room = {
  me: { id: "画师" },
  round: { id: "round" },
  messages: [message("热可可")],
};

it("keeps the reader's scroll position and offers a new-message jump", () => {
  const view = render(<GuessFeed room={room} />);
  const log = screen.getByRole("log");
  Object.defineProperties(log, {
    scrollHeight: { value: 1000 },
    clientHeight: { value: 200 },
  });
  log.scrollTop = 100;
  fireEvent.scroll(log);
  view.rerender(
    <GuessFeed
      room={{ ...room, messages: [...room.messages, message("咖啡")] }}
    />,
  );
  expect(log.scrollTop).toBe(100);
  fireEvent.click(screen.getByRole("button", { name: "新消息" }));
  expect(log.scrollTop).toBe(1000);
  expect(
    screen.queryByRole("button", { name: "新消息" }),
  ).not.toBeInTheDocument();
});

it("locks only the answer being judged and reports its failure locally", async () => {
  let reject;
  const onJudge = vi.fn(
    () =>
      new Promise((_, fail) => {
        reject = fail;
      }),
  );
  render(
    <GuessFeed
      room={{ ...room, messages: [...room.messages, message("咖啡")] }}
      canJudge
      onJudge={onJudge}
    />,
  );
  const selected = screen.getByRole("button", {
    name: "判定 小圆 的 热可可 正确",
  });
  fireEvent.click(selected);
  expect(selected).toBeDisabled();
  expect(
    screen.getByRole("button", { name: "判定 小圆 的 咖啡 正确" }),
  ).toBeEnabled();
  await act(async () => reject(new Error("裁定失败")));
  expect(screen.getByRole("alert")).toHaveTextContent("裁定失败");
  expect(selected).toBeEnabled();
});
