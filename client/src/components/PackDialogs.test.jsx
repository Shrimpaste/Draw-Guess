import { useState } from "react";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { PackSubmission } from "./PackDialogs.jsx";
afterEach(cleanup);
function Harness({ onSubmit }) {
  const [draft, setDraft] = useState({ name: "", description: "", words: "" });
  const [open, setOpen] = useState(true);
  return (
    <>
      <button onClick={() => setOpen(true)}>投稿</button>
      {open && (
        <PackSubmission
          draft={draft}
          onDraftChange={setDraft}
          onSubmit={onSubmit}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
it("validates unique word count, focuses errors, and keeps failed submissions editable", async () => {
  const onSubmit = vi.fn().mockRejectedValue(new Error("PACK_NAME_TAKEN"));
  render(<Harness onSubmit={onSubmit} />);
  fireEvent.change(screen.getByLabelText("词包名称"), {
    target: { value: "水果" },
  });
  fireEvent.change(screen.getByLabelText("一句话介绍"), {
    target: { value: "适合热身的水果词包" },
  });
  fireEvent.change(screen.getByLabelText("收集一些词语"), {
    target: { value: "苹果,苹果,苹果,苹果" },
  });
  fireEvent.click(screen.getByRole("button", { name: "提交审核" }));
  expect(screen.getByRole("alert")).toHaveTextContent("不同词语");
  expect(screen.getByLabelText("收集一些词语")).toHaveFocus();
  expect(onSubmit).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText("收集一些词语"), {
    target: { value: "苹果,香蕉,西瓜,葡萄" },
  });
  fireEvent.click(screen.getByRole("button", { name: "提交审核" }));
  await waitFor(() =>
    expect(screen.getByRole("alert")).toHaveTextContent("同名词包"),
  );
  expect(screen.getByLabelText("词包名称")).toHaveValue("水果");
  expect(screen.getByLabelText("收集一些词语")).toBeEnabled();
});
it("preserves the draft after Escape and reopening", async () => {
  render(<Harness onSubmit={vi.fn()} />);
  fireEvent.change(screen.getByLabelText("词包名称"), {
    target: { value: "周末咖啡" },
  });
  fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
  await waitFor(() =>
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
  );
  fireEvent.click(screen.getByRole("button", { name: "投稿" }));
  expect(screen.getByLabelText("词包名称")).toHaveValue("周末咖啡");
});
