import React, { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { supabase } from "./supabase";
import { Body, C, Eyebrow, s } from "./ui";
import type { NightThought as Thought } from "../supabase/functions/_shared/night-thoughts";
import {
  fallbackNightThought,
  validNightThought,
} from "../supabase/functions/chloe/night-fallback";
import { supportLevel } from "../supabase/functions/_shared/safety";
import { SupportNotice } from "./support";
import { usePractice } from "./practice";
import { useToday } from "./use-today";
import { draftKey, useDraft } from "./drafts";
import { entryInput } from "./journey";

function withDeadline<T>(
  task: PromiseLike<T>,
  milliseconds: number,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error("Night thought timed out")),
      milliseconds,
    );
    Promise.resolve(task).then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

export function NightThought({
  reflection = "",
  children,
}: {
  reflection?: string;
  children?: React.ReactNode;
}) {
  const { data, session, putEntry } = usePractice();
  const today = useToday();
  const owner = session?.user.id;
  const { draft, update, ready } = useDraft(
    draftKey("night-thought.last-shown", owner),
    { day: "", thought: null as Thought | null },
  );
  const key = JSON.stringify([owner, today, reflection]);
  const [received, setReceived] = useState({
    key: "",
    thought: null as Thought | null,
    serverLevel: 0,
  });
  const thought = received.key === key ? received.thought : null;
  const serverLevel = received.key === key ? received.serverLevel : 0;
  const state = useRef({ data, putEntry, draft, update });
  useEffect(() => {
    state.current = { data, putEntry, draft, update };
  }, [data, putEntry, draft, update]);
  const level = supportLevel(reflection);
  useEffect(() => {
    let active = true;
    if (!ready || !owner || level >= 2) return;
    const closeNight = async () => {
      let reply: {
        thought?: unknown;
        suppressed?: boolean;
        support_level?: number;
      } | null = null;
      try {
        const result = await withDeadline(
          supabase.functions.invoke("chloe", {
            body: { action: "night_thought", reflection },
          }),
          14000,
        );
        if (!result.error && !result.data?.error) reply = result.data;
      } catch {
        // The saved fallback below is part of the nightly close, not an error screen.
      }
      if (!active) return;
      let knownLevel = Math.max(level, Number(reply?.support_level) || 0);
      if (reply?.suppressed) knownLevel = Math.max(2, knownLevel);
      if (!reply) {
        try {
          const safety = await withDeadline(
            supabase
              .from("support_state")
              .select("level")
              .eq("user_id", owner)
              .maybeSingle(),
            2500,
          );
          if (!safety.error)
            knownLevel = Math.max(knownLevel, Number(safety.data?.level) || 0);
        } catch {
          // Local reflection safety still applies if the service is unreachable.
        }
      }
      if (!active) return;
      if (knownLevel >= 2) {
        setReceived({ key, thought: null, serverLevel: knownLevel });
        return;
      }
      const cached = state.current.draft;
      const shown = validNightThought(reply?.thought)
        ? reply.thought
        : cached.day === today && validNightThought(cached.thought)
          ? cached.thought
          : fallbackNightThought(today)!;
      setReceived({ key, thought: shown, serverLevel: knownLevel });
      // Owner-scoped draft persistence also works when the AI or network is down.
      state.current.update({ day: today, thought: shown });
      const existing = state.current.data.entries.find(
        (entry) =>
          entry.kind === "preferences" && entry.title === "Last night thought",
      );
      if (
        existing?.meta.last_shown_day === today &&
        existing.body === shown.text
      )
        return;
      try {
        await state.current.putEntry(
          entryInput("preferences", "Last night thought", {
            ...existing,
            body: shown.text,
            source: "Shown at your night check-in",
            meta: {
              ...existing?.meta,
              last_shown_day: today,
              thought_snapshot: {
                id: shown.id,
                format: shown.format,
                text: shown.text,
                credit: shown.credit,
              },
            },
          }),
        );
      } catch {
        // Keep the local dated copy; a failed marker save never removes the thought.
      }
    };
    void closeNight();
    return () => {
      active = false;
    };
  }, [key, owner, today, reflection, level, ready]);
  if (Math.max(level, serverLevel) >= 2)
    return <SupportNotice level={Math.max(level, serverLevel)} />;
  if (!thought)
    return (
      <Body style={{ color: C.muted, fontSize: 13 }}>
        One thought to close the day…
      </Body>
    );
  return (
    <>
      {children}
      <View style={[s.card, { backgroundColor: C.paper, borderWidth: 0 }]}>
        <Eyebrow style={{ color: C.muted }}>
          Chloe · Something to sleep on
        </Eyebrow>
        {!!thought.preface && <Body>{thought.preface}</Body>}
        <Body style={{ fontSize: 23, lineHeight: 34, color: C.ink }}>
          {thought.text}
        </Body>
        {!!thought.credit && (
          <Body style={{ fontSize: 13 }}>— {thought.credit}</Body>
        )}
        <Body style={{ color: C.muted }}>Goodnight.</Body>
      </View>
    </>
  );
}
