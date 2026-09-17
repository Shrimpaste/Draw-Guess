import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { PackAdmin } from "./PackDialogs.jsx";
import { api } from "../api.js";
vi.mock("../api.js", () => ({
  api: { adminPacks: vi.fn(), approvePack: vi.fn(), deletePack: vi.fn() },
}));
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});
const pack = {
  id: "pack",
  name: "周末食堂",
  description: "朋友们的美食词包",
  words: ["咖啡", "面包", "煎蛋", "牛奶"],
  status: "pending",
};

async function openQueue() {
  api.adminPacks.mockResolvedValue({ packs: [pack] });
  render(
    <PackAdmin token="test-session" onClose={vi.fn()} onChanged={vi.fn()} />,
  );
  fireEvent.change(screen.getByLabelText("审核密钥"), {
    target: { value: "test-only-key" },
  });
  fireEvent.click(screen.getByRole("button", { name: "读取待审核词包" }));
  await screen.findByRole("heading", { name: pack.name });
}

it("keeps the queue available when approving fails", async () => {
  await openQueue();
  api.approvePack.mockRejectedValue(new Error("暂时无法审核"));
  fireEvent.click(screen.getByRole("button", { name: "通过审核" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("暂时无法审核");
  expect(screen.getByRole("button", { name: "通过审核" })).toBeEnabled();
  expect(api.approvePack).toHaveBeenCalledWith(
    "test-session",
    "test-only-key",
    "pack",
  );
});

it("does not delete a submission when its confirmation is cancelled", async () => {
  await openQueue();
  fireEvent.click(screen.getByRole("button", { name: "拒绝投稿" }));
  expect(screen.getByRole("alertdialog")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "取消" }));
  expect(api.deletePack).not.toHaveBeenCalled();
  expect(screen.getByRole("heading", { name: pack.name })).toBeInTheDocument();
});
