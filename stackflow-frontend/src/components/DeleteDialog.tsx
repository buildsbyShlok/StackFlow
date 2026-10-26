import { useRef, useState } from "react";
import { Modal, ErrorState } from "./common";
import { Button } from "./ui/button";
import { errorMessage } from "@/utils/api";

export default function DeleteDialog({ kind, name, description, remove, onDeleted, onClose }: {
  kind: "project" | "milestone"; name: string; description: string;
  remove: () => Promise<unknown>; onDeleted: () => Promise<void>; onClose: () => void;
}) {
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const submitted = useRef(false);
  return <Modal title={"Delete " + kind + "?"} description={description} onClose={() => { if (!submitted.current) onClose(); }}>
    <form className="form-stack" onSubmit={async (event) => {
      event.preventDefault();
      if (submitted.current || confirmation !== name) return;
      submitted.current = true; setBusy(true); setError("");
      try { await remove(); await onDeleted(); }
      catch (e) { setError(errorMessage(e)); }
      finally { submitted.current = false; setBusy(false); }
    }}>
      <div className="deletion-target"><span>{kind}</span><strong>{name}</strong></div>
      <label>Type the {kind} name to confirm<input aria-label="Confirm name" autoComplete="off" value={confirmation} onChange={(e) => setConfirmation(e.target.value)} disabled={busy} required /></label>
      {error && <ErrorState message={error} />}
      <div className="form-footer">
        <Button type="button" variant="outline" disabled={busy} onClick={onClose}>Cancel</Button>
        <Button type="submit" variant="destructive" disabled={busy || confirmation !== name}>{busy ? "Deleting…" : "Delete " + kind}</Button>
      </div>
    </form>
  </Modal>;
}
