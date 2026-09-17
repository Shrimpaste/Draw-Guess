import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { GuessComposer } from "./GuessComposer.jsx";

afterEach(cleanup);
const type = (value) =>
  fireEvent.change(screen.getByLabelText("你的答案"), { target: { value } });
const send = () =>
  fireEvent.submit(screen.getByLabelText("你的答案").closest("form"));

it("blocks duplicate requests and preserves a newer draft during a slow send", async () => {
  let finish;
  const onGuess = vi.fn(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  render(<GuessComposer roundId="one" online onGuess={onGuess} />);
  type("月亮");
  send();
  expect(screen.getByLabelText("你的答案")).toHaveValue("");
  send();
  expect(onGuess).toHaveBeenCalledTimes(1);
  type("太阳");
  await act(async () => finish(true));
  expect(screen.getByLabelText("你的答案")).toHaveValue("太阳");
});

it("retries the failed answer without clearing a different draft", async () => {
  const onGuess = vi
    .fn()
    .mockRejectedValueOnce(new Error("断线了"))
    .mockResolvedValue(true);
  render(<GuessComposer roundId="one" online onGuess={onGuess} />);
  type("月亮");
  send();
  await screen.findByRole("alert");
  type("太阳");
  fireEvent.click(screen.getByRole("button", { name: "重试" }));
  await waitFor(() => expect(onGuess).toHaveBeenCalledTimes(2));
  expect(onGuess).toHaveBeenLastCalledWith("月亮", onGuess.mock.calls[0][1]);
  expect(screen.getByLabelText("你的答案")).toHaveValue("太阳");
});

it("restores failed text only when the user has not started another draft", async () => {
  let reject;
  const onGuess = vi.fn(() => new Promise((_, fail) => { reject = fail; }));
  render(<GuessComposer roundId="one" online onGuess={onGuess} />);
  type("月亮"); send();
  type("太阳");
  await act(async () => reject(new Error("网络中断")));
  expect(screen.getByLabelText("你的答案")).toHaveValue("太阳");
  expect(screen.getByRole("alert")).toHaveTextContent("未发送：月亮");
});

it("does not submit composition text and ignores completion from an older round", async () => {
  let finish;
  const onGuess = vi.fn(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const view = render(<GuessComposer roundId="one" online onGuess={onGuess} />);
  const input = screen.getByLabelText("你的答案");
  fireEvent.compositionStart(input);
  type("月亮");
  send();
  expect(onGuess).not.toHaveBeenCalled();
  fireEvent.compositionEnd(input);
  send();
  view.rerender(<GuessComposer roundId="two" online onGuess={onGuess} />);
  type("新答案");
  await act(async () => finish(true));
  expect(input).toHaveValue("新答案");
});
