import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, expect, it } from "vitest";
import { InkWord, inkLayout, loadMedians, sharedInk } from "./InkWord.jsx";
import { inkLabels } from "./labels.js";

beforeAll(loadMedians);
afterEach(cleanup);

it("has stroke data for every status label", () => {
  for (const label of Object.values(inkLabels)) expect(inkLayout(label), label).not.toBeNull();
});

it("keeps a shared leading phrase written while only the tail changes", () => {
  const guess = inkLayout("轮到你猜");
  expect(sharedInk("轮到你画", "轮到你猜")).toBe(guess.glyphs[3].strokes[0].start);
  expect(sharedInk("猜中了！", "时间到")).toBe(0);
});

it("exposes the label as text and switches to static text for unknown characters", async () => {
  const view = render(<InkWord text="轮到你画" />);
  expect(view.container.querySelector(".sr-only")).toHaveTextContent("轮到你画");
  view.rerender(<InkWord text="还差 2 人" />);
  await waitFor(() => expect(view.container.querySelector(".ink-word-static")).toHaveTextContent("还差 2 人"), { timeout: 3000 });
});
