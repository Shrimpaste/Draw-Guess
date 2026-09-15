import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { CanvasBoard, drawStroke } from "./CanvasBoard.jsx";
const context = Object.fromEntries(["save", "restore", "beginPath", "arc", "fill", "moveTo", "lineTo", "stroke", "clearRect", "drawImage", "scale", "setTransform"].map((name) => [name, vi.fn()]));
const room = { round: { id: "round", status: "active" }, canvasEpoch: 1, canvasVersion: 1, canvas: [] };
beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("PointerEvent", MouseEvent);
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(context);
  vi.spyOn(HTMLCanvasElement.prototype, "getBoundingClientRect").mockReturnValue({ left: 0, top: 0, width: 960, height: 620 });
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); });
it("sends a dot immediately and streams moved points before pointer-up", () => {
  const onStroke = vi.fn(() => true);
  const view = render(<CanvasBoard room={room} isDrawer onStroke={onStroke} onClear={vi.fn()} onUndo={vi.fn()} />);
  const canvas = screen.getByLabelText("绘画画布");
  fireEvent.pointerDown(canvas, { button: 0, clientX: 10, clientY: 10 });
  expect(onStroke).toHaveBeenCalledOnce();
  fireEvent.pointerMove(canvas, { clientX: 20, clientY: 20 });
  act(() => vi.advanceTimersByTime(50));
  expect(onStroke.mock.calls[1][0]).toMatchObject({ offset: 1, points: [{ x: 20, y: 20 }] });
  fireEvent.pointerCancel(canvas);
  const count = onStroke.mock.calls.length;
  fireEvent.pointerMove(canvas, { clientX: 30, clientY: 30 });
  act(() => vi.advanceTimersByTime(100));
  expect(onStroke).toHaveBeenCalledTimes(count);
  view.unmount();
});
it("drops unsent local input when the round changes or drawing permission is lost", () => {
  const onStroke = vi.fn(() => true);
  const props = { room, isDrawer: true, onStroke, onClear: vi.fn(), onUndo: vi.fn() };
  const view = render(<CanvasBoard {...props} />);
  const canvas = screen.getByLabelText("绘画画布");
  fireEvent.pointerDown(canvas, { button: 0, clientX: 10, clientY: 10 });
  fireEvent.pointerMove(canvas, { clientX: 20, clientY: 20 });
  view.rerender(<CanvasBoard {...props} room={{ ...room, round: { id: "new", status: "active" } }} isDrawer={false} />);
  act(() => vi.advanceTimersByTime(100));
  expect(onStroke).toHaveBeenCalledOnce();
  view.unmount();
});
it("renders taps as circles and uses compositing for the eraser", () => {
  drawStroke(context, { tool: "eraser", color: "#000000", width: 8, points: [{ x: 10, y: 20 }] });
  expect(context.globalCompositeOperation).toBe("destination-out");
  expect(context.arc).toHaveBeenCalledWith(10, 20, 4, 0, Math.PI * 2);
});
