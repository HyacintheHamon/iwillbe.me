import React, { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { withAccount } from "../src/access-gate";
import { usePractice } from "../src/practice";
import { useRound2 } from "../src/round2-store";
import { useToday, useLocalNow } from "../src/use-today";
import { useAction } from "../src/use-action";
import {
  HORIZONS,
  LEVELS,
  norm,
  somedaySelection,
  missionUnavailableReason,
  type Someday,
  type Level,
} from "../src/round2";
import { HORIZON_QUESTIONS } from "../src/round3-map";
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
import { recordScreenVisit } from "../src/usage";

function FutureMe() {
  const { data, session } = usePractice();
  const extra = useRound2();
  const today = useToday();
  const now = useLocalNow();
  const action = useAction();
  const [text, setText] = useState(""),
    [adding, setAdding] = useState(false),
    [editing, setEditing] = useState<Someday | null>(null),
    [horizon, setHorizon] = useState<Someday["horizon"]>("this_year"),
    [selected, setSelected] = useState<Someday | null>(null),
    [level, setLevel] = useState<Level>("easy"),
    [familyId, setFamilyId] = useState<string>();
  const [notice, setNotice] = useState("");
  const live = useRef({ data, owner: session?.user.id });
  useEffect(() => {
    live.current = { data, owner: session?.user.id };
  }, [data, session?.user.id]);
  useFocusEffect(
    useCallback(() => {
      recordScreenVisit(live.current.data, live.current.owner, "future_me");
    }, []),
  );
  const selection = selected
    ? somedaySelection(data, selected, level, { day: today, familyId, now })
    : undefined;
  const mission = selection?.mission;
  const levels = selection?.availableLevels || [];
  const accept = () => {
    if (!mission || !selected) return;
    const unavailable = missionUnavailableReason(mission, data, new Date());
    if (unavailable) {
      setSelected(null);
      setNotice(`That step no longer fits right now. ${unavailable}`);
      return;
    }
    const priority =
      selected.priority ||
      mission.priorities.find((value) =>
        data.entries.some(
          (entry) =>
            entry.kind === "value" && norm(entry.title) === norm(value),
        ),
      ) ||
      mission.priorities[0] ||
      "";
    setSelected(null);
    router.push({
      pathname: "/",
      params: {
        missionId: mission.id,
        missionText: mission.mission_text,
        missionLevel: level,
        missionType: mission.type,
        missionStep: String(mission.ladder_step),
        priority,
        interest: selected.interest || "",
        somedayId: selected.id,
      },
    });
  };
  const add = (when: Someday["horizon"]) => {
    setText("");
    setHorizon(when);
    setEditing(null);
    setAdding(true);
  };
  const open = (item: Someday) => {
    setNotice("");
    setSelected(item);
    setLevel("easy");
    setFamilyId(
      somedaySelection(data, item, "easy", { day: today, now: new Date() })
        .familyId,
    );
  };
  const save = () =>
    action.run(async () => {
      const content = text.trim();
      if (!content) return;
      const duplicate =
        !editing &&
        extra.someday.find(
          (item) =>
            item.horizon === horizon &&
            item.status !== "let_go" &&
            norm(item.text) === norm(content),
        );
      if (!duplicate)
        await extra.saveSomeday({
          ...editing,
          text: content,
          horizon,
          status: editing?.status || "open",
        });
      setAdding(false);
      setEditing(null);
    });
  const nextLevel = () => {
    const available = LEVELS.filter((candidate) => levels.includes(candidate));
    if (available.length > 1)
      setLevel(available[(available.indexOf(level) + 1) % available.length]);
  };
  return (
    <Page header={<TopBar title="Future me" />} contentStyle={{ gap: 18 }}>
      <Title>Make room for your future.</Title>
      <Body>Things you want to be, do, have, see and share.</Body>
      <Notice text={notice} />
      <Body style={{ color: C.muted }}>
        Give each one a place in your future. A few ideas are enough, and you
        can change them anytime.
      </Body>
      {Object.entries(HORIZONS).map(([key, label]) => {
        const when = key as Someday["horizon"];
        const items = extra.someday.filter(
          (item) => item.horizon === when && item.status !== "let_go",
        );
        return (
          <View key={when} style={[s.card, { padding: 18, gap: 10 }]}>
            <Title style={{ fontSize: 22, lineHeight: 28 }}>{label}</Title>
            <Body style={{ color: C.muted, fontSize: 14, lineHeight: 21 }}>
              {HORIZON_QUESTIONS[when]}
            </Body>
            {items.map((item) => (
              <Pressable
                key={item.id}
                accessibilityRole="button"
                accessibilityLabel={`${item.text}${item.status === "lived" ? " · Lived it" : ""}`}
                onPress={() => open(item)}
                style={{
                  minHeight: 44,
                  paddingVertical: 10,
                  borderBottomWidth: 1,
                  borderColor: C.line,
                }}
              >
                <Body
                  style={{ color: item.status === "lived" ? C.muted : C.ink }}
                >
                  {item.status === "lived" ? "✓ " : ""}
                  {item.text}
                </Body>
              </Pressable>
            ))}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Add to ${label}`}
              onPress={() => add(when)}
              style={{
                minHeight: 44,
                paddingVertical: 10,
                justifyContent: "center",
                alignSelf: "flex-start",
              }}
            >
              <Body style={{ color: C.gold, fontFamily: F.strong }}>+ Add</Body>
            </Pressable>
          </View>
        );
      })}
      <Sheet
        open={adding}
        onClose={() => setAdding(false)}
        title={editing ? "Shape your someday" : HORIZONS[horizon]}
        footer={
          <Button
            label={editing ? "Save changes" : "Add to my someday list"}
            disabled={!text.trim()}
            loading={action.busy}
            onPress={save}
          />
        }
      >
        <Body>{HORIZON_QUESTIONS[horizon]}</Body>
        <Field
          label="I’d like to…"
          value={text}
          onChangeText={setText}
          maxLength={500}
          multiline
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
        title="A step toward it"
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
              {levels.length > 1 && (
                <TextButton
                  label={
                    level === levels[levels.length - 1] ? "Easier" : "Harder"
                  }
                  onPress={nextLevel}
                />
              )}
            </View>
          ) : undefined
        }
      >
        {selected && (
          <>
            <Body style={{ fontSize: 13, color: C.muted }}>
              {HORIZONS[selected.horizon]}
            </Body>
            <Body style={{ fontFamily: F.strong }}>{selected.text}</Body>
            <FocusCard
              hideActions
              mission={mission}
              level={level}
              onLevel={setLevel}
              availableLevels={levels}
              unavailableReasons={selection?.unavailableReasons}
              label="Make it today's focus"
              loading={action.busy}
              onAccept={accept}
            />
            <TextButton label="Keep it" onPress={() => setSelected(null)} />
            <TextButton
              label="Edit"
              onPress={() => {
                setEditing(selected);
                setText(selected.text);
                setHorizon(selected.horizon);
                setSelected(null);
                setAdding(true);
              }}
            />
            {selected.status !== "lived" && (
              <TextButton
                label="Lived it"
                onPress={() =>
                  action.run(async () => {
                    await extra.saveSomeday({ ...selected, status: "lived" });
                    setSelected(null);
                  })
                }
              />
            )}
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
