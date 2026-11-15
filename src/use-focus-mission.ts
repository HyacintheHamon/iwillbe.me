import { useEffect, useRef, useState } from "react";
import { supabase } from "./supabase";
import { usePractice } from "./practice";
import type { Level, Round2Mission } from "./round2";
// The supplied catalogue always wins. AI is requested only for an uncovered choice.
export function useFocusMission(
  library: Round2Mission | undefined,
  tag: string,
  level: Level,
  enabled = true,
) {
  const { session } = usePractice();
  const [generated, setGenerated] = useState<{
    key: string;
    rows: Round2Mission[];
  } | null>(null);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const cache = useRef(new Map<string, Round2Mission[]>());
  const owner = session?.user.id;
  const hasLibrary = !!library;
  const key = `${owner}:${tag}`;
  useEffect(() => {
    let active = true;
    if (hasLibrary || !enabled || !tag.trim() || !owner) return;
    const saved = cache.current.get(key);
    if (saved) {
      setGenerated({ key, rows: saved });
      return;
    }
    setError("");
    void supabase.functions
      .invoke("chloe", {
        body: { action: "missions", interest: tag, ladder_step: 1 },
      })
      .then((r) => {
        if (!active) return;
        if (r.error || r.data?.error || !r.data?.missions?.length) {
          setError(
            "Ideas could not load. You can retry or write your own focus.",
          );
          return;
        }
        const rows = r.data.missions as Round2Mission[];
        cache.current.set(key, rows);
        setGenerated({ key, rows });
      })
      .catch(() => {
        if (active) setError("Ideas could not load. Please try again.");
      });
    return () => {
      active = false;
    };
  }, [key, tag, hasLibrary, enabled, owner, retry]);
  return {
    mission:
      library ||
      (generated?.key === key
        ? generated.rows.find((m) => m.level === level)
        : undefined),
    error,
    retry: () => setRetry((n) => n + 1),
  };
}
