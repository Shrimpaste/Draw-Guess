import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import App from "./App.jsx";

describe("App", () => {
  it("renders login screen by default", () => {
    render(<App />);
    expect(screen.getByText(/进入大厅/)).toBeInTheDocument();
  });
});
