import { useState } from "react";
export function useAction() {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const run = async (work: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await work();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not save. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  };
  return { busy, error, run };
}
