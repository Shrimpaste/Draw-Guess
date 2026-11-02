import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import ArtBaseline from "./ArtBaseline.jsx";

const context = Object.fromEntries(["save", "restore", "beginPath", "arc", "fill", "moveTo", "lineTo", "stroke", "clearRect", "drawImage", "scale", "setTransform", "quadraticCurveTo"].map((name) => [name, vi.fn()]));
beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(context);
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.useRealTimers(); });

const studyButton = (name) => within(screen.getByText("样例控制").closest("details")).getByRole("button", { name });

it("renders the room with stroke-order status text and moves between real modules", () => {
  render(<ArtBaseline />);
  expect(screen.getByRole("heading", { name: "午后速写室" })).toBeInTheDocument();
  expect(screen.getByText("轮到你画")).toBeInTheDocument();
  expect(screen.getByRole("toolbar", { name: "绘画工具" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "大厅" }));
  expect(screen.getByRole("heading", { name: "大厅" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "已满" })).toBeDisabled();
  fireEvent.click(within(screen.getByRole("navigation", { name: "主导航" })).getByRole("button", { name: "词包" }));
  expect(screen.getByRole("heading", { name: "花草植物" })).toBeInTheDocument();
});

it("echoes a guess while sending, keeps it for retry on failure, then confirms once", () => {
  render(<ArtBaseline />);
  fireEvent.click(studyButton("猜词"));
  fireEvent.click(screen.getByLabelText("猜词发送失败"));
  const input = screen.getByLabelText("你的答案");
  fireEvent.change(input, { target: { value: "苹果" } });
  fireEvent.submit(input.closest("form"));
  expect(screen.getByText("发送中…")).toBeInTheDocument();
  expect(input).toHaveValue("");
  act(() => vi.advanceTimersByTime(700));
  expect(screen.getByText("未送达")).toBeInTheDocument();
  fireEvent.click(screen.getByLabelText("猜词发送失败"));
  fireEvent.click(screen.getByRole("button", { name: "重试" }));
  act(() => vi.advanceTimersByTime(700));
  expect(screen.queryByText("未送达")).not.toBeInTheDocument();
  expect(screen.getAllByText("苹果")).toHaveLength(1);
});

it("judges a specific pending guess as the prompter", () => {
  render(<ArtBaseline />);
  fireEvent.change(screen.getByRole("combobox"), { target: { value: "host-judged" } });
  fireEvent.click(screen.getByRole("button", { name: /开始游戏|再来一轮/ }));
  fireEvent.click(studyButton("出题者"));
  fireEvent.change(screen.getByLabelText("本轮词语"), { target: { value: "风筝" } });
  fireEvent.click(screen.getByRole("button", { name: "确认出题" }));
  fireEvent.click(studyButton("猜词"));
  const input = screen.getByLabelText("你的答案");
  fireEvent.change(input, { target: { value: "纸风筝" } });
  fireEvent.submit(input.closest("form"));
  act(() => vi.advanceTimersByTime(700));
  fireEvent.click(studyButton("出题者"));
  fireEvent.click(screen.getByRole("button", { name: /纸风筝 正确/ }));
  expect(screen.getAllByText("猜中了！").length).toBeGreaterThan(0);
});
