import { withAccount } from "../src/access-gate";
import React, { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { usePractice } from "../src/practice";
import {
  currentWhy,
  entryInput,
  interestState,
  valueState,
  type Entry,
} from "../src/journey";
import { useToday } from "../src/use-today";
import {
  Body,
  Button,
  C,
  Chip,
  Eyebrow,
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
import { IWillBe } from "../src/priority-onboarding";
import {
  loadMissions,
  ladderStep,
  missionTrio,
  missionTag,
  type Mission,
} from "../src/missions";
import { MissionCards } from "../src/mission-cards";
import { priorityName } from "../src/priorities";
const stages = ["All in", "Into it", "Want to try", "Maybe", "On pause"];
const stageValues: Record<string, string> = {
  "All in": "all_in",
  "Into it": "into_it",
  "Want to try": "want_to_try",
  Maybe: "spark",
  "On pause": "paused",
  "Working on": "working_on",
  "Important to me": "important",
  "Let go": "let_go",
};
function MyMap() {
  const { data, putEntry, removeEntry } = usePractice();
  const today = useToday();
  const [layer, setLayer] = useState<"interest" | "value">("interest"),
    [selected, setSelected] = useState<Entry | null>(null),
    [adding, setAdding] = useState(false),
    [name, setName] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [paused, setPaused] = useState(false),
    [move, setMove] = useState(false),
    [remove, setRemove] = useState(false);
  const [missions, setMissions] = useState<Mission[]>([]),
    [missionId, setMissionId] = useState(""),
    [offset, setOffset] = useState(0),
    [requestedStep, setRequestedStep] = useState(0),
    [ideasLoading, setIdeasLoading] = useState(false),
    [ideasError, setIdeasError] = useState(""),
    [retry, setRetry] = useState(0),
    [replace, setReplace] = useState(false);
  const why = currentWhy(data);
  const step = selected ? ladderStep(data, selected) : 1;
  const lastActivity = (entry: Entry) =>
    [
      entry.meta.last_activity_at || entry.updated_at,
      ...data.intentions
        .filter(
          (i) =>
            i.interest_id === entry.id &&
            data.checkIns.some(
              (c) => c.intention_id === i.id && c.outcome === "yes",
            ),
        )
        .map((i) => i.day),
    ]
      .sort()
      .at(-1) || entry.updated_at;
  const items = data.entries
    .filter((e) =>
      layer === "value"
        ? ["value", "strength"].includes(e.kind)
        : e.kind === "interest",
    )
    .filter(
      (e, i, all) =>
        layer !== "value" ||
        all.findIndex(
          (x) => priorityName(x.title) === priorityName(e.title),
        ) === i,
    )
    .sort((a, b) => lastActivity(b).localeCompare(lastActivity(a)));
  const openEntry = (entry: Entry) => {
    setMissions([]);
    setMissionId("");
    setIdeasError("");
    setReplace(false);
    setMove(false);
    setRemove(false);
    setOffset(0);
    setRequestedStep(0);
    setIdeasLoading(true);
    setSelected(entry);
  };
  const state = (e: Entry) =>
    e.kind === "interest"
      ? interestState(data, e)
      : e.kind === "strength"
        ? "Important to me"
        : valueState(data, e);
  const run = async (work: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await work();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => {
    let active = true;
    if (!selected) return;
    loadMissions(missionTag(selected.title), requestedStep || step)
      .then(
        (result) => {
          if (active) {
            setMissions(result.missions);
            setMissionId(
              missionTrio(result.missions).find((m) => m.size === "Normal")
                ?.id || "",
            );
          }
        },
        (e) => {
          if (active) setIdeasError(e.message);
        },
      )
      .finally(() => {
        if (active) setIdeasLoading(false);
      });
    return () => {
      active = false;
    };
  }, [selected, step, retry, requestedStep]);
  const options = missionTrio(missions, offset);
  const mission =
    options.find((m) => m.id === missionId) ||
    options.find((m) => m.size === "Normal");
  const openAction = () => {
    if (!selected || !mission) return;
    const entry = selected;
    setSelected(null);
    router.push({
      pathname: "/ritual",
      params: {
        day: today,
        action: mission.mission_text,
        interest: entry.kind === "interest" ? entry.title : "",
        value: entry.kind !== "interest" ? entry.title : "",
        planet: mission.area,
        mission_id: mission.id,
        mission_step: String(mission.ladder_step),
        from_map: "1",
      },
    });
  };
  const current = data.intentions.find((i) => i.day === today);
  const completed =
    !!current && data.checkIns.some((c) => c.intention_id === current.id);
  return (
    <Page header={<TopBar back={false} title="iwillbe.me" />}>
      <Eyebrow>What matters. What’s next.</Eyebrow>
      <Title>My map</Title>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Shape my why"
        onPress={() => router.push("/why")}
        style={s.card}
      >
        <Eyebrow>MY WHY</Eyebrow>
        <Body numberOfLines={2}>
          {why?.body || "Still forming. Your choices will help it take shape."}
        </Body>
        <Body style={{ color: C.gold }}>Shape my why →</Body>
      </Pressable>
      <View style={s.wrap}>
        <Chip
          label="Interests"
          selected={layer === "interest"}
          onPress={() => setLayer("interest")}
        />
        <Chip
          label="Priorities"
          selected={layer === "value"}
          onPress={() => setLayer("value")}
        />
      </View>
      <Body>Tap a word for something you can do today.</Body>
      {!items.length && (
        <Body>
          {layer === "interest"
            ? "Add something you’re curious about. We’ll help you find a first step."
            : "Add a priority you want to live, or start with your map’s quick picks."}
        </Body>
      )}
      {(layer === "interest"
        ? stages
        : ["Working on", "Important to me", "Let go"]
      ).map((group) => {
        const grouped = items.filter((e) => state(e) === group);
        if (!grouped.length) return null;
        const collapsed = group === "On pause" || group === "Let go";
        return (
          <View key={group} style={{ gap: 12, marginTop: 12 }}>
            {collapsed ? (
              <TextButton
                label={`${group} (${grouped.length})`}
                onPress={() => setPaused(!paused)}
              />
            ) : (
              <Eyebrow style={{ color: "#5C5850", fontFamily: F.strong }}>
                {group}
              </Eyebrow>
            )}
            {(!collapsed || paused) && (
              <View
                style={{
                  flexDirection: "row",
                  flexWrap: "wrap",
                  alignItems: "center",
                  columnGap: 4,
                }}
              >
                {grouped.map((entry, i) => (
                  <React.Fragment key={entry.id}>
                    {i > 0 && (
                      <Text style={{ fontSize: 20, color: "#C9C5BC" }}>
                        {" "}
                        ·{" "}
                      </Text>
                    )}
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`${entry.title} · ${group}`}
                      onPress={() => {
                        setError("");
                        openEntry(entry);
                      }}
                      style={{ minHeight: 44, justifyContent: "center" }}
                    >
                      <Text
                        style={{
                          fontSize: 20,
                          lineHeight: 30,
                          fontFamily:
                            group === "Maybe"
                              ? F.sans
                              : ["Into it", "All in", "Working on"].includes(
                                    group,
                                  )
                                ? F.bold
                                : F.medium,
                          color:
                            group === "Maybe"
                              ? "#8A857B"
                              : group === "All in"
                                ? C.gold
                                : C.navy,
                          borderBottomWidth: group === "Into it" ? 3 : 0,
                          borderBottomColor: C.gold,
                        }}
                      >
                        {entry.title}
                      </Text>
                    </Pressable>
                  </React.Fragment>
                ))}
              </View>
            )}
          </View>
        );
      })}
      <TextButton
        label="+ Add to my map"
        color={C.gold}
        onPress={() => {
          setName("");
          setError("");
          setAdding(true);
        }}
      />
      <View style={s.section}>
        <TextButton
          label="People I admire, habits and history"
          onPress={() => router.push("/history")}
        />
        <TextButton
          label="One year out and Later in life"
          onPress={() => router.push("/telescope")}
        />
        <TextButton
          label="Meaning To and Open Questions"
          onPress={() => router.push("/rhythms")}
        />
      </View>
      <Sheet
        open={adding}
        onClose={() => setAdding(false)}
        title={
          layer === "interest"
            ? "What would you like to explore?"
            : "Who do you want to be?"
        }
      >
        <Field
          label={layer === "interest" ? "An interest" : "A priority"}
          value={name}
          onChangeText={setName}
          maxLength={80}
          placeholder={
            layer === "interest" ? "e.g. learning guitar" : "e.g. patient"
          }
        />
        <Button
          label="Add to my map"
          disabled={!name.trim()}
          loading={busy}
          onPress={() =>
            run(async () => {
              const title =
                layer === "interest" ? missionTag(name) : priorityName(name);
              const known = data.entries.find(
                (e) =>
                  e.kind === layer && missionTag(e.title) === missionTag(title),
              );
              const entry =
                known ||
                (await putEntry(
                  entryInput(layer, title, {
                    state: layer === "interest" ? "spark" : "working_on",
                    meta: { ladder_step: 1 },
                  }),
                ));
              setAdding(false);
              openEntry(entry);
            })
          }
        />
        <Notice text={error} tone="error" />
      </Sheet>
      <Sheet
        open={!!selected}
        onClose={() => setSelected(null)}
        title="Your next step"
      >
        {selected && (
          <>
            <IWillBe>{selected.title}</IWillBe>
            <Body>
              {state(selected)} · step{" "}
              {mission?.ladder_step || requestedStep || step} of 5
            </Body>
            {ideasLoading ? (
              <Body>Finding a few ideas…</Body>
            ) : (
              <MissionCards
                missions={options}
                selected={mission?.id || ""}
                onSelect={(m) => setMissionId(m.id)}
              />
            )}
            <Notice text={ideasError} tone="error" />
            {ideasError && (
              <TextButton
                label="Try loading ideas again"
                onPress={() => {
                  setIdeasLoading(true);
                  setIdeasError("");
                  setRetry(retry + 1);
                }}
              />
            )}
            {completed ? (
              <Body>
                You’ve reflected on today’s action. Come back tomorrow for a
                fresh one.
              </Body>
            ) : replace ? (
              <>
                <Title style={{ fontSize: 24 }}>Replace today’s action?</Title>
                <Body>{current?.action}</Body>
                <Button label="Replace and choose when" onPress={openAction} />
                <TextButton
                  label="Keep today’s action"
                  onPress={() => setReplace(false)}
                />
              </>
            ) : (
              <Button
                label="Make this today’s action"
                disabled={!mission || ideasLoading}
                onPress={() => (current ? setReplace(true) : openAction())}
              />
            )}
            <TextButton
              label="Write my own action"
              onPress={() => {
                const entry = selected;
                setSelected(null);
                router.push({
                  pathname: "/ritual",
                  params: {
                    [entry.kind === "interest" ? "interest" : "value"]:
                      entry.title,
                  },
                });
              }}
            />
            <TextButton
              label="Show other ideas"
              onPress={() => {
                if (missions.length > 3) {
                  setOffset(offset + 1);
                  setMissionId("");
                } else {
                  setIdeasLoading(true);
                  setIdeasError("");
                  setRequestedStep(Math.min(5, (requestedStep || step) + 1));
                  setRetry(retry + 1);
                }
              }}
            />
            <TextButton label="Move stage" onPress={() => setMove(!move)} />
            {move && (
              <View style={s.wrap}>
                {(selected.kind === "interest"
                  ? stages.slice(0, 4)
                  : ["Working on", "Important to me", "Let go"]
                ).map((label) => (
                  <Chip
                    key={label}
                    label={label}
                    selected={state(selected) === label}
                    disabled={busy}
                    onPress={() =>
                      run(async () => {
                        await putEntry({
                          ...selected,
                          kind:
                            selected.kind === "strength"
                              ? "value"
                              : selected.kind,
                          state: stageValues[label],
                        });
                        setSelected(null);
                      })
                    }
                  />
                ))}
              </View>
            )}
            {selected.kind === "interest" && (
              <TextButton
                label={
                  state(selected) === "On pause"
                    ? "Resume exploring"
                    : "Put on pause"
                }
                onPress={() =>
                  run(async () => {
                    await putEntry({
                      ...selected,
                      state:
                        state(selected) === "On pause"
                          ? selected.meta.previous_state || "spark"
                          : "paused",
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
            <TextButton label="Remove" onPress={() => setRemove(true)} />
            {remove && (
              <>
                <Body>
                  Remove this from your map? Your past actions will stay in your
                  history.
                </Body>
                <Button
                  secondary
                  label="Remove from my map"
                  loading={busy}
                  onPress={() =>
                    run(async () => {
                      await removeEntry(selected.id, selected.revision);
                      setSelected(null);
                    })
                  }
                />
              </>
            )}
            <Notice text={error} tone="error" />
          </>
        )}
      </Sheet>
    </Page>
  );
}
export default withAccount(MyMap);
