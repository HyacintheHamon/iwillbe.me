import React, { useEffect, useState } from "react";
import { View } from "react-native";
import { supabase } from "./supabase";
import { usePractice } from "./practice";
import { useToday } from "./use-today";
import { useAction } from "./use-action";
import { interestState } from "./journey";
import { Body, C, Chip, Notice, TextButton, s } from "./ui";
export function NightSummary({ reflection }: { reflection: string }) {
  const { data, putEntry } = usePractice();
  const today = useToday();
  const action = useAction();
  const [summary, setSummary] = useState(""),
    [hard, setHard] = useState(false),
    [error, setError] = useState(false),
    [retry, setRetry] = useState(0);
  const focus = data.intentions.find((i) => i.day === today);
  const check = data.checkIns.find((c) => c.intention_id === focus?.id);
  const interest = data.entries.find(
    (e) =>
      e.kind === "interest" &&
      (focus?.interest_id
        ? e.id === focus.interest_id
        : e.title === focus?.interest),
  );
  useEffect(() => {
    let live = true;
    void supabase.functions
      .invoke("chloe", { body: { action: "round2_summarize", reflection } })
      .then((r) => {
        if (!live) return;
        if (r.error || r.data?.error) setError(true);
        else {
          setSummary(r.data?.summary || "");
          setHard(!!r.data?.hard_day || !!r.data?.suppressed);
          setError(false);
        }
      });
    return () => {
      live = false;
    };
  }, [reflection, retry]);
  const move = (state: string) =>
    action.run(async () => {
      if (interest)
        await putEntry({
          ...interest,
          state,
          meta: { ...interest.meta, last_stage_asked_day: today },
        });
    });
  return (
    <View style={{ gap: 12 }}>
      {summary ? (
        <View
          style={{ backgroundColor: C.soft, padding: 16, borderRadius: 14 }}
        >
          <Body>{summary}</Body>
        </View>
      ) : error ? (
        <TextButton
          label="Ask Chloe to reflect on this"
          onPress={() => setRetry((x) => x + 1)}
        />
      ) : null}
      {summary &&
        !hard &&
        check?.outcome === "yes" &&
        interest &&
        interestState(data, interest) === "Want to try" &&
        interest.meta.last_stage_asked_day !== today && (
          <View style={{ gap: 10 }}>
            <Body>
              How would you like to keep {interest.title} in your life?
            </Body>
            <View style={s.wrap}>
              <Chip
                label="From time to time"
                onPress={() => move("from_time_to_time")}
              />
              <Chip label="Into it" onPress={() => move("into_it")} />
              <Chip
                label="Keep exploring"
                onPress={() => move("want_to_try")}
              />
              <Chip label="Put on pause" onPress={() => move("on_pause")} />
            </View>
            <Notice text={action.error} tone="error" />
          </View>
        )}
    </View>
  );
}
