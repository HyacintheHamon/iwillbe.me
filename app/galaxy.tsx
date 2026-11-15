import React, { useState } from "react";
import { View, Pressable } from "react-native";
import { router } from "expo-router";
import { withAccount } from "../src/access-gate";
import { usePractice } from "../src/practice";
import { useToday } from "../src/use-today";
import { useRound2 } from "../src/round2-store";
import { useAction } from "../src/use-action";
import {
  currentWhy,
  interestState,
  valueState,
  entryInput,
  type Entry,
} from "../src/journey";
import { STAGES, STAGE_VALUES, pickMission, type Level } from "../src/round2";
import {
  Body,
  Button,
  C,
  Chip,
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
import { useFocusMission } from "../src/use-focus-mission";
import { FocusCard } from "../src/focus-card";
function MyMap() {
  const { data, putEntry, removeEntry, saveIntention } = usePractice();
  const action = useAction();
  const extra = useRound2();
  const today = useToday();
  const [selected, setSelected] = useState<Entry | null>(null),
    [level, setLevel] = useState<Level>("easy"),
    [adding, setAdding] = useState(false),
    [kind, setKind] = useState<"interest" | "value">("interest"),
    [name, setName] = useState(""),
    [move, setMove] = useState(false),
    [allIn, setAllIn] = useState(false),
    [notice, setNotice] = useState("");
  const why = currentWhy(data);
  const interests = data.entries.filter((e) => e.kind === "interest");
  const selectedPriority = selected?.kind === "value" ? selected.title : "";
  const library = selected
    ? pickMission(
        data,
        selectedPriority,
        selected.kind === "interest" ? selected.title : "anywhere",
        selected.kind === "interest" ? "interest" : "anywhere",
        level,
        "do",
        today,
      )
    : undefined;
  const generated = useFocusMission(
    library,
    selected?.title || "",
    level,
    !!selected,
  );
  const mission = generated.mission;
  const open = (entry: Entry) => {
    setSelected(entry);
    setLevel("easy");
    setMove(false);
    setAllIn(false);
    setNotice("");
  };
  const changeState = (state: string) =>
    action.run(async () => {
      if (!selected) return;
      await putEntry({ ...selected, state });
      setSelected(null);
    });
  const accept = () =>
    action.run(async () => {
      if (!selected || !mission) return;
      await saveIntention(
        mission.mission_text,
        selected.kind === "value"
          ? selected.title
          : mission.priorities.find((p) =>
              data.entries.some((e) => e.kind === "value" && e.title === p),
            ) || "",
        "",
        today,
        selected.kind === "interest" ? selected.title : "",
        {
          source: "suggested",
          mission_id: mission.id,
          mission_step: mission.ladder_step,
          level,
          type: mission.type as "do" | "learn",
        },
      );
      setSelected(null);
      router.replace("/");
    });
  return (
    <Page
      header={<TopBar title="be.me" back={false} />}
      contentStyle={{ gap: 18 }}
    >
      <Title>My map</Title>
      <View style={s.card}>
        <Body style={{ fontFamily: F.strong }}>My why</Body>
        <Body>
          {why?.body || "Still forming. Your choices will help it take shape."}
        </Body>
        <TextButton
          label="Shape my why"
          color={C.gold}
          onPress={() => router.push("/why")}
        />
      </View>
      <View style={{ gap: 12 }}>
        <Title style={{ fontSize: 22 }}>Priorities</Title>
        {(["Working on", "Important to me"] as const).map((state) => (
          <View key={state} style={{ gap: 8 }}>
            <Body style={{ fontSize: 13, color: C.muted }}>{state}</Body>
            <View style={s.wrap}>
              {data.entries
                .filter(
                  (e) => e.kind === "value" && valueState(data, e) === state,
                )
                .map((e) => (
                  <Chip
                    key={e.id}
                    label={`iwillbe.${e.title}`}
                    onPress={() => open(e)}
                  />
                ))}
            </View>
          </View>
        ))}
      </View>
      <TextButton
        label="+ Add a priority"
        color={C.gold}
        onPress={() => {
          setKind("value");
          setName("");
          setAdding(true);
        }}
      />
      <Title style={{ fontSize: 22 }}>Interests</Title>
      <Body style={{ color: C.muted, fontSize: 14 }}>
        Tap a word for your next step.
      </Body>
      {STAGES.map((stage) => {
        const items = interests.filter((e) => interestState(data, e) === stage);
        return items.length ? (
          <View key={stage} style={{ gap: 6 }}>
            <Body style={{ fontSize: 13, color: C.muted }}>{stage}</Body>
            <View style={[s.wrap, { columnGap: 12 }]}>
              {items.map((e) => (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${e.title} · ${stage}`}
                  key={e.id}
                  onPress={() => open(e)}
                  style={{
                    minHeight: 44,
                    justifyContent: "center",
                    borderBottomWidth: stage === "Into it" ? 2 : 0,
                    borderColor: C.gold,
                  }}
                >
                  <Body
                    style={{
                      fontSize: 20,
                      fontFamily:
                        stage === "All in" || stage === "Into it"
                          ? F.bold
                          : F.medium,
                      color:
                        stage === "All in"
                          ? C.gold
                          : stage === "On pause"
                            ? C.muted
                            : C.navy,
                    }}
                  >
                    {e.title}
                  </Body>
                </Pressable>
              ))}
            </View>
          </View>
        ) : null;
      })}
      <TextButton
        label="+ Add an interest"
        color={C.gold}
        onPress={() => {
          setKind("interest");
          setName("");
          setAdding(true);
        }}
      />
      <View style={s.section}>
        <TextButton
          label="Future me · One year out, later in life and my someday list"
          onPress={() => router.push("/telescope")}
        />
        <TextButton
          label="Your rhythms"
          onPress={() => router.push("/rhythms")}
        />
        <TextButton
          label="People I admire and saved thoughts"
          onPress={() => router.push("/history")}
        />
      </View>
      <Sheet
        open={adding}
        onClose={() => setAdding(false)}
        title={
          kind === "interest"
            ? "What would you like to explore?"
            : "Who do you want to be?"
        }
        footer={
          <Button
            label="Add to my map"
            disabled={!name.trim()}
            loading={action.busy}
            onPress={() =>
              action.run(async () => {
                const title = name.trim().toLowerCase();
                const prior = data.entries.find(
                  (e) => e.kind === kind && e.title === title,
                );
                const entry =
                  prior ||
                  (await putEntry(
                    entryInput(kind, title, {
                      state: kind === "interest" ? "want_to_try" : "working_on",
                    }),
                  ));
                setAdding(false);
                open(entry);
              })
            }
          />
        }
      >
        <Field
          label={kind === "interest" ? "An interest" : "A priority"}
          value={name}
          onChangeText={setName}
          maxLength={80}
        />
        <Notice text={action.error} tone="error" />
      </Sheet>
      <Sheet
        open={!!selected}
        onClose={() => setSelected(null)}
        title={
          selected
            ? `${selected.kind === "value" ? "iwillbe." : ""}${selected.title} · step ${mission?.ladder_step || 1} of 5`
            : "Your next step"
        }
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
            <FocusCard
              hideActions
              mission={mission}
              level={level}
              onLevel={setLevel}
              onAccept={accept}
              loading={action.busy}
              label="Make it today's focus"
            />
            {!mission && (
              <TextButton
                label="Write my own focus"
                onPress={() => {
                  setSelected(null);
                  router.replace("/");
                }}
              />
            )}
            {generated.error && (
              <>
                <Notice text={generated.error} />
                <TextButton label="Retry ideas" onPress={generated.retry} />
              </>
            )}
            <TextButton label="Move to" onPress={() => setMove(!move)} />
            {move && (
              <View style={s.wrap}>
                {(selected.kind === "interest"
                  ? STAGES.slice(0, 4)
                  : ["Working on", "Important to me", "Let go"]
                ).map((stage, i) => (
                  <Chip
                    key={stage}
                    label={stage}
                    onPress={() => {
                      if (stage === "All in")
                        void action.run(async () => {
                          const allowed = await extra.recordMoment(
                            "all_in_check",
                            `map:${today}`,
                            !!extra.summaries[0]?.hard_day,
                          );
                          if (allowed) setAllIn(true);
                          else {
                            await putEntry({ ...selected, state: "all_in" });
                            setSelected(null);
                          }
                        });
                      else
                        void changeState(
                          selected.kind === "interest"
                            ? STAGE_VALUES[i]
                            : ["working_on", "important", "let_go"][i],
                        );
                    }}
                  />
                ))}
              </View>
            )}
            {allIn && (
              <View
                style={{
                  gap: 10,
                  backgroundColor: C.soft,
                  padding: 14,
                  borderRadius: 14,
                }}
              >
                <Body>
                  Is this something you truly want to go all in on, or is it
                  just interesting right now?
                </Body>
                <Button
                  label="All in"
                  onPress={() =>
                    action.run(async () => {
                      await putEntry({ ...selected, state: "all_in" });
                      setSelected(null);
                    })
                  }
                />
                <TextButton
                  label="Just interesting for now"
                  onPress={() => changeState("into_it")}
                />
              </View>
            )}
            {selected.kind === "interest" && (
              <TextButton
                label={
                  interestState(data, selected) === "On pause"
                    ? "Bring back"
                    : "Put on pause"
                }
                onPress={() =>
                  action.run(async () => {
                    await putEntry({
                      ...selected,
                      state:
                        interestState(data, selected) === "On pause"
                          ? selected.meta.previous_state || "want_to_try"
                          : "on_pause",
                      meta: {
                        ...selected.meta,
                        previous_state: selected.state,
                      },
                    });
                    setSelected(null);
                  })
                }
              />
            )}
            <TextButton
              label="Remove"
              onPress={() =>
                action.run(async () => {
                  await removeEntry(selected.id, selected.revision);
                  setSelected(null);
                })
              }
            />
            <Notice text={action.error || notice} tone="error" />
          </>
        )}
      </Sheet>
      <Notice text={extra.error} tone="error" />
    </Page>
  );
}
export default withAccount(MyMap);
