import React, { useState } from "react";
import { View } from "react-native";
import { usePractice } from "./practice";
import { useAction } from "./use-action";
import { entryInput } from "./journey";
import { Body, Button, Chip, Eyebrow, Notice, TextButton, s } from "./ui";
import {
  HEALTH_THEMES,
  KIDS_AGES,
  kidsAgesPreference,
  priorityThemePreference,
  shouldAskKidsAges,
  shouldAskPriorityTheme,
  type KidsAge,
} from "./round3-preference-rules";

export { shouldAskKidsAges } from "./round3-preference-rules";

export function KidsAgesPrompt({
  context,
  force = false,
  onDone,
}: {
  context: string;
  force?: boolean;
  onDone?: () => void;
}) {
  const { data, putEntry } = usePractice();
  const action = useAction();
  const [ages, setAges] = useState<KidsAge[]>([]);
  const [done, setDone] = useState(false);
  if (done || !shouldAskKidsAges(data, context, force)) return null;
  const save = (chosen: KidsAge[]) =>
    action.run(async () => {
      const existing = kidsAgesPreference(data);
      await putEntry(
        entryInput("preferences", "Kids ages", {
          ...existing,
          body: chosen.join(", "),
          source: chosen.length ? "Chosen by you" : "Left open by you",
          meta: { ...existing?.meta, ages: chosen, asked: true },
        }),
      );
      setDone(true);
      onDone?.();
    });
  return (
    <View style={s.card}>
      <Eyebrow>Chloe</Eyebrow>
      <Body>How old are your kids?</Body>
      <Body style={{ fontSize: 13 }}>
        Pick all that apply. This is optional.
      </Body>
      <View style={s.wrap}>
        {KIDS_AGES.map((age) => (
          <Chip
            key={age}
            label={age}
            selected={ages.includes(age)}
            disabled={action.busy}
            onPress={() =>
              setAges((old) =>
                old.includes(age)
                  ? old.filter((item) => item !== age)
                  : [...old, age],
              )
            }
          />
        ))}
      </View>
      <Button
        label="Save ages"
        disabled={!ages.length}
        loading={action.busy}
        onPress={() => save(ages)}
      />
      <TextButton
        label="Skip for now"
        disabled={action.busy}
        onPress={() => save([])}
      />
      <Notice text={action.error} tone="error" />
    </View>
  );
}

export function PriorityThemePrompt({
  priority = "",
  enabled = true,
}: {
  priority?: string;
  enabled?: boolean;
}) {
  const { data, putEntry } = usePractice();
  const action = useAction();
  const [done, setDone] = useState(false);
  if (!enabled || done || !shouldAskPriorityTheme(data, priority)) return null;
  const save = (theme?: string) =>
    action.run(async () => {
      const existing = priorityThemePreference(data, "healthy");
      await putEntry(
        entryInput("preferences", "Priority theme", {
          ...existing,
          body: theme || "",
          source: theme ? "Chosen by you" : "Left open by you",
          meta: { ...existing?.meta, priority: "healthy", theme, asked: true },
        }),
      );
      setDone(true);
    });
  return (
    <View style={s.card}>
      <Eyebrow>Chloe</Eyebrow>
      <Body>Which part of healthy matters most to you right now?</Body>
      <View style={s.wrap}>
        {HEALTH_THEMES.map((theme) => (
          <Chip
            key={theme}
            label={theme}
            disabled={action.busy}
            onPress={() => save(theme)}
          />
        ))}
      </View>
      <TextButton
        label="Keep it open"
        disabled={action.busy}
        onPress={() => save()}
      />
      <Notice text={action.error} tone="error" />
    </View>
  );
}

export function NightPreferences({
  context,
  priority,
}: {
  context: string;
  priority?: string;
}) {
  const { data } = usePractice();
  const [topic] = useState(() =>
    shouldAskKidsAges(data, context) ? "kids" : "theme",
  );
  return topic === "kids" ? (
    <KidsAgesPrompt context={context} />
  ) : (
    <PriorityThemePrompt priority={priority} />
  );
}
