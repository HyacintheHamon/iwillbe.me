import React, { useEffect, useState } from "react";
import { View } from "react-native";
import { supabase } from "./supabase";
import { Body, C, Eyebrow, Notice, TextButton, s } from "./ui";
import type { NightThought as Thought } from "../supabase/functions/_shared/night-thoughts";
import { supportLevel } from "../supabase/functions/_shared/safety";
import { SupportNotice } from "./support";
export function NightThought({ reflection = "" }: { reflection?: string }) {
  const [thought, setThought] = useState<Thought | null>(null),
    [error, setError] = useState(""),
    [retry, setRetry] = useState(0),
    [serverLevel, setServerLevel] = useState(0);
  const level = supportLevel(reflection);
  useEffect(() => {
    let active = true;
    if (level >= 2) return;
    supabase.functions
      .invoke("chloe", { body: { action: "night_thought" } })
      .then(({ data, error }) => {
        if (!active) return;
        if (error || data?.error) {
          setError(
            "Your reflection is saved. Tonight’s thought couldn’t load.",
          );
          return;
        }
        setServerLevel(Number(data?.support_level) || 0);
        setThought(data?.thought || null);
      });
    return () => {
      active = false;
    };
  }, [level, retry]);
  if (Math.max(level, serverLevel) >= 2)
    return <SupportNotice level={Math.max(level, serverLevel)} />;
  return (
    <>
      {thought && (
        <View style={[s.card, { backgroundColor: C.paper, borderWidth: 0 }]}>
          <Eyebrow style={{ color: C.muted }}>Something to sleep on:</Eyebrow>
          {!!thought.preface && <Body>{thought.preface}</Body>}
          <Body>{thought.text}</Body>
          {thought.credit && (
            <Body style={{ fontSize: 13 }}>— {thought.credit}</Body>
          )}
          <Body style={{ color: C.muted }}>Goodnight.</Body>
        </View>
      )}
      {error && (
        <>
          <Notice text={error} />
          <TextButton
            label="Load tonight’s thought"
            onPress={() => {
              setError("");
              setRetry(retry + 1);
            }}
          />
        </>
      )}
    </>
  );
}
