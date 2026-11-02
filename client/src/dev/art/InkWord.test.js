import { describe, expect, it } from "vitest";
import { inkLayout, sharedInk } from "./InkWord.jsx";

describe("stroke-order labels", () => {
  it("keeps the ink of a shared leading phrase when only the tail changes", () => {
    const drawer = inkLayout("轮到你画"), guesser = inkLayout("轮到你猜");
    const kept = sharedInk("轮到你画", "轮到你猜");
    expect(kept).toBe(guesser.glyphs[3].strokes[0].start);
    expect(kept).toBe(drawer.glyphs[3].strokes[0].start);
    expect(sharedInk("猜中了！", "时间到")).toBe(0);
    expect(sharedInk("轮到你画", "轮到你画")).toBe(drawer.total);
  });

  it("falls back to static text for characters without stroke data", () => {
    expect(inkLayout("鸭梨")).not.toBeNull();
    expect(inkLayout("INK24")).toBeNull();
    expect(sharedInk("INK24", "INK25")).toBe(0);
  });
});
