import { useState } from "react";
import { ui } from "@/i18n/ui";
import { Button } from "../ui";
import Dialog from "./Dialog";

/**
 * Asked before unsaved edits would be lost: when leaving Create, or when
 * another variant is about to replace the one being edited.
 */
export default function UnsavedChangesDialog({
  open,
  name,
  intent,
  onSave,
  onDiscard,
  onCancel,
}: {
  open: boolean;
  name: string;
  intent: "leave" | "replace";
  onSave: () => Promise<void> | void;
  onDiscard: () => Promise<void> | void;
  onCancel: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const run = (action: () => Promise<void> | void) => async () => {
    setBusy(true);
    try {
      await action();
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog
      open={open}
      onClose={onCancel}
      size="sm"
      eyebrow={ui("Unsaved changes")}
      title={ui("You have unsaved changes.")}
      description={
        <>
          “{name}” {intent === "leave" ? ui("has changes that are not in My Games yet.") : ui("has changes that will be replaced by the variant you are opening.")}
        </>
      }
      footer={
        <>
          <Button onClick={onCancel} disabled={busy}>
            {ui("Cancel")}
          </Button>
          <Button tone="danger" onClick={run(onDiscard)} disabled={busy}>
            {intent === "leave" ? ui("Leave Without Saving") : ui("Discard changes")}
          </Button>
          <Button tone="primary" onClick={run(onSave)} disabled={busy}>
            {intent === "leave" ? ui("Save and Leave") : ui("Save and Continue")}
          </Button>
        </>
      }
    />
  );
}
