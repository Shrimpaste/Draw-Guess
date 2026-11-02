import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import App from "./App.jsx";

afterEach(cleanup);

describe("App", () => {
  it("renders login screen by default", () => {
    render(<App />);
    expect(screen.getByRole("heading", { name: "进入大厅" })).toBeInTheDocument();
  });

  it("keeps the entry free of slogans and opens the rules", async () => {
    render(<App />);
    expect(document.body.textContent).not.toMatch(/一支画笔|灵感|奇思妙想|一起玩一会儿|很高兴见到你/);
    fireEvent.click(screen.getAllByRole("button", { name: "玩法" })[0]);
    expect(await screen.findByRole("dialog", { name: "玩法" })).toHaveTextContent("词库局");
  });
});
