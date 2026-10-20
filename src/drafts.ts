import { useEffect, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

export const draftKey = (name: string, owner?: string) =>
  `iwillbe.draft.v1.${owner || "guest"}.${name}`;
const pending = new Map<string, Promise<unknown>>();
function enqueue(key: string, write: () => Promise<unknown>) {
  const operation = (pending.get(key) || Promise.resolve())
    .catch(() => {})
    .then(write);
  pending.set(key, operation);
  return operation;
}
// Writes and removal share a queue, so navigating away cannot resurrect a saved draft.
export function useDraft<T>(key: string, initial: T) {
  const initialRef = useRef(initial);
  const active = useRef(true);
  const [state, setState] = useState({ key, value: initial, ready: false });
  const [error, setError] = useState("");
  useEffect(() => {
    initialRef.current = initial;
  }, [initial]);
  useEffect(() => {
    let mounted = true;
    active.current = true;
    void (async () => {
      try {
        await pending.get(key);
        const saved = await AsyncStorage.getItem(key);
        if (mounted)
          setState({
            key,
            value: saved
              ? { ...initialRef.current, ...JSON.parse(saved) }
              : initialRef.current,
            ready: true,
          });
      } catch {
        if (mounted) {
          setState({ key, value: initialRef.current, ready: true });
          setError("Your draft could not be restored on this device.");
        }
      }
    })();
    return () => {
      mounted = false;
    };
  }, [key]);
  const update = (patch: Partial<T>) => {
    const value = { ...state.value, ...patch };
    setState({ key, value, ready: true });
    if (active.current)
      void enqueue(key, () =>
        AsyncStorage.setItem(key, JSON.stringify(value)),
      ).catch(() =>
        setError(
          "Your draft could not be saved on this device. Keep this page open.",
        ),
      );
  };
  const clear = async () => {
    active.current = false;
    await enqueue(key, () => AsyncStorage.removeItem(key));
  };
  return {
    draft: state.value,
    update,
    clear,
    ready: state.ready && state.key === key,
    draftError: error,
  };
}
