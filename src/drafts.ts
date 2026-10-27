import { useEffect, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createDraftStore } from "./draft-store";

export const draftKey = (name: string, owner?: string) =>
  `iwillbe.draft.v1.${owner || "guest"}.${name}`;
const store = createDraftStore(AsyncStorage);
export const clearOwnerDrafts = (owner: string) => store.clearOwner(owner);
// Writes and removal share a queue, so navigating away cannot resurrect a saved draft.
export function useDraft<T>(key: string, initial: T) {
  const initialRef = useRef(initial);
  const active = useRef(true);
  const lease = useRef({ key, token: store.lease(key) });
  const [state, setState] = useState({ key, value: initial, ready: false });
  const latest = useRef({ key, value: initial });
  const edits = useRef(0);
  const [error, setError] = useState("");
  useEffect(() => {
    initialRef.current = initial;
  }, [initial]);
  useEffect(() => {
    let mounted = true;
    active.current = true;
    lease.current = { key, token: store.lease(key) };
    const token = lease.current.token;
    const editAtStart = edits.current;
    void (async () => {
      try {
        const saved = await store.read(key, token);
        if (
          mounted &&
          store.valid(key, token) &&
          edits.current === editAtStart
        ) {
          const restored = {
            key,
            value: saved
              ? { ...initialRef.current, ...JSON.parse(saved) }
              : initialRef.current,
            ready: true,
          };
          latest.current = restored;
          setState(restored);
          setError("");
        }
      } catch {
        if (mounted && edits.current === editAtStart) {
          const restored = { key, value: initialRef.current, ready: true };
          latest.current = restored;
          setState(restored);
          setError("Your draft could not be restored on this device.");
        }
      }
    })();
    return () => {
      mounted = false;
    };
  }, [key]);
  const update = (patch: Partial<T>) => {
    // An async reply can finish after account switch or deletion. Its closure
    // belongs to the old key and must not replace the new screen's draft.
    if (
      !active.current ||
      lease.current.key !== key ||
      !store.valid(key, lease.current.token)
    )
      return;
    const previous =
      latest.current.key === key ? latest.current.value : initialRef.current;
    const value = { ...previous, ...patch };
    latest.current = { key, value };
    edits.current += 1;
    setState({ key, value, ready: true });
    if (active.current && lease.current.key === key)
      void store
        .write(key, JSON.stringify(value), lease.current.token)
        .catch(() =>
          setError(
            "Your draft could not be saved on this device. Keep this page open.",
          ),
        );
  };
  const clear = async () => {
    active.current = false;
    await store.clear(key);
  };
  return {
    draft: state.value,
    update,
    clear,
    ready: state.ready && state.key === key,
    draftError: error,
  };
}
