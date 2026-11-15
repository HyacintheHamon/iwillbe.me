import React, { useState } from "react";
import { Pressable, View } from "react-native";
import { router } from "expo-router";
import { withAccount } from "../src/access-gate";
import { usePractice } from "../src/practice";
import { useRound2 } from "../src/round2-store";
import { useToday } from "../src/use-today";
import { useAction } from "../src/use-action";
import { currentVision, entryInput } from "../src/journey";
import {
  HORIZONS,
  somedayMission,
  type Someday,
  type Level,
} from "../src/round2";
import {
  Body,
  Button,
  Chip,
  C,
  F,
  Field,
  Notice,
  Page,
  Sheet,
  TextButton,
  Title,
  TopBar,
  s,
} from "../src/ui";
import { FocusCard } from "../src/focus-card";
function FutureMe() {
  const { data, putEntry, saveIntention } = usePractice();
  const extra = useRound2();
  const today = useToday();
  const action = useAction();
  const [vision, setVision] = useState<"year" | "life" | null>(null),
    [text, setText] = useState(""),
    [adding, setAdding] = useState(false),
    [horizon, setHorizon] = useState<Someday["horizon"]>("this_year"),
    [selected, setSelected] = useState<Someday | null>(null),
    [level, setLevel] = useState<Level>("easy");
  const mission = selected ? somedayMission(data, selected, level) : undefined;
  const accept = () =>
    action.run(async () => {
      if (!mission || !selected) return;
      await saveIntention(
        mission.mission_text,
        selected.priority ||
          mission.priorities.find((p) =>
            data.entries.some((e) => e.kind === "value" && e.title === p),
          ) ||
          "",
        "",
        today,
        selected.interest || "",
        {
          source: "suggested",
          mission_id: mission.id,
          mission_step: mission.ladder_step,
          level,
          type: mission.type as "do" | "learn",
          someday_item_id: selected.id,
        },
      );
      setSelected(null);
      router.replace("/");
    });
  return (
    <Page header={<TopBar title="Future me" />}>
      <Title>Make room for your future.</Title>
      {(["year", "life"] as const).map((h) => (
        <View key={h} style={s.card}>
          <Body style={{ fontFamily: F.strong }}>
            {h === "year" ? "One year out" : "Later in life"}
          </Body>
          <Body>
            {currentVision(data, h)?.body ||
              (h === "year"
                ? "Picture a year from now, living the life you want. What’s in it?"
                : "Imagine yourself late in life, looking back. What are you proud of? Who’s around you?")}
          </Body>
          <TextButton
            label={
              currentVision(data, h)
                ? `Shape ${h === "year" ? "one year out" : "later in life"}`
                : `Write ${h === "year" ? "one year out" : "later in life"}`
            }
            onPress={() => {
              setText(currentVision(data, h)?.body || "");
              setVision(h);
            }}
          />
        </View>
      ))}
      <Title style={{ fontSize: 24 }}>My someday list</Title>
      <Body>Things you want to be, do, have, see or share.</Body>
      {Object.entries(HORIZONS).map(([key, label]) => (
        <View key={key} style={{ gap: 8 }}>
          <Body style={{ fontFamily: F.strong, color: C.muted, fontSize: 14 }}>
            {label}
          </Body>
          {extra.someday
            .filter((s) => s.horizon === key && s.status !== "let_go")
            .map((item) => (
              <Pressable
                key={item.id}
                accessibilityRole="button"
                onPress={() => {
                  setSelected(item);
                  setLevel("easy");
                }}
                style={{
                  minHeight: 44,
                  paddingVertical: 10,
                  borderBottomWidth: 1,
                  borderColor: C.line,
                }}
              >
                <Body>
                  {item.status === "lived" ? "✓ " : ""}
                  {item.text}
                </Body>
              </Pressable>
            ))}
        </View>
      ))}
      <TextButton
        label="+ Add"
        color={C.gold}
        onPress={() => {
          setText("");
          setHorizon("this_year");
          setAdding(true);
        }}
      />
      <Sheet
        open={!!vision}
        onClose={() => setVision(null)}
        title={vision === "year" ? "One year out" : "Later in life"}
        footer={
          <Button
            label="Save my picture"
            loading={action.busy}
            disabled={!text.trim()}
            onPress={() =>
              action.run(async () => {
                if (!vision) return;
                const versions = data.entries.filter(
                  (e) => e.kind === "vision" && e.meta.horizon === vision,
                );
                await putEntry(
                  entryInput(
                    "vision",
                    vision === "year" ? "One year out" : "Later in life",
                    {
                      body: text.trim(),
                      source: "Your words",
                      meta: { horizon: vision, version: versions.length + 1 },
                    },
                  ),
                );
                setVision(null);
              })
            }
          />
        }
      >
        <Field
          label="In your words"
          multiline
          value={text}
          onChangeText={setText}
          maxLength={5000}
        />
        <Notice text={action.error} tone="error" />
      </Sheet>
      <Sheet
        open={adding}
        onClose={() => setAdding(false)}
        title="Something for someday"
        footer={
          <Button
            label="Add to my someday list"
            disabled={!text.trim()}
            loading={action.busy}
            onPress={() =>
              action.run(async () => {
                await extra.saveSomeday({
                  text: text.trim(),
                  horizon,
                  status: "open",
                });
                setAdding(false);
              })
            }
          />
        }
      >
        <Field
          label="I’d like to…"
          value={text}
          onChangeText={setText}
          maxLength={500}
        />
        <View style={s.wrap}>
          {Object.entries(HORIZONS).map(([key, label]) => (
            <Chip
              key={key}
              label={label}
              selected={horizon === key}
              onPress={() => setHorizon(key as Someday["horizon"])}
            />
          ))}
        </View>
        <Notice text={action.error} tone="error" />
      </Sheet>
      <Sheet
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected?.text || "A step toward it"}
        footer={
          selected ? (
            <View style={s.row}>
              <View style={{ flex: 1 }}>
                <Button
                  label="Make it today's focus"
                  disabled={!mission}
                  loading={action.busy}
                  onPress={accept}
                />
              </View>
              <TextButton
                label={level === "stretch" ? "Easier" : "Harder"}
                onPress={() =>
                  setLevel(
                    level === "easy"
                      ? "normal"
                      : level === "normal"
                        ? "stretch"
                        : "easy",
                  )
                }
              />
            </View>
          ) : undefined
        }
      >
        {selected && (
          <>
            <Body style={{ fontSize: 13, color: C.muted }}>
              {HORIZONS[selected.horizon]}
            </Body>
            <FocusCard
              hideActions
              mission={mission}
              level={level}
              onLevel={setLevel}
              label="Make it today's focus"
              loading={action.busy}
              onAccept={accept}
            />
            <TextButton label="Keep it" onPress={() => setSelected(null)} />
            <TextButton
              label="Lived it"
              onPress={() =>
                action.run(async () => {
                  await extra.saveSomeday({ ...selected, status: "lived" });
                  setSelected(null);
                })
              }
            />
            <TextButton
              label="Let it go"
              onPress={() =>
                action.run(async () => {
                  await extra.saveSomeday({ ...selected, status: "let_go" });
                  setSelected(null);
                })
              }
            />
            <Notice text={action.error} tone="error" />
          </>
        )}
      </Sheet>
      <Notice text={extra.error} tone="error" />
    </Page>
  );
}
export default withAccount(FutureMe);
