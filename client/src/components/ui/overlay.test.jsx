import { useState } from "react";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { Modal } from "./overlay.jsx";
import { Input } from "./field.jsx";
afterEach(cleanup);
it("focuses the first field and restores the opening button on Escape", async () => {
  function Example() {
    const [open, setOpen] = useState(false);
    return (
      <>
        <button onClick={() => setOpen(true)}>打开</button>
        <Modal open={open} onOpenChange={setOpen} title="投稿">
          <Input aria-label="名称" />
        </Modal>
      </>
    );
  }
  render(<Example />);
  const trigger = screen.getByRole("button", { name: "打开" });
  trigger.focus();
  fireEvent.click(trigger);
  await waitFor(() => expect(screen.getByLabelText("名称")).toHaveFocus());
  fireEvent.keyDown(screen.getByLabelText("名称"), { key: "Escape" });
  await waitFor(() =>
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
  );
  expect(trigger).toHaveFocus();
});
