import React, { useCallback, useEffect, useRef, useState } from "react";
import { View, Pressable } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { withAccount } from "../src/access-gate";
import { usePractice } from "../src/practice";
import { useToday, useLocalNow } from "../src/use-today";
import { useRound2 } from "../src/round2-store";
import { useAction } from "../src/use-action";
import {
  currentWhy,
  interestState,
  valueState,
  entryInput,
  type Entry,
} from "../src/journey";
import {
  STAGES,
  STAGE_VALUES,
  LEVELS,
  norm,
  selectMission,
  missionUnavailableReason,
  type Level,
} from "../src/round2";
import {
  closeInterests,
  exploreInterests,
  type InterestLink,
} from "../src/round3-map";
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
  s,
} from "../src/ui";
import { BrandHeader } from "../src/brand-header";
import { useFocusMission } from "../src/use-focus-mission";
import { FocusCard } from "../src/focus-card";
import { recordScreenVisit } from "../src/usage";

type Selection = {
  title: string;
  kind: "interest" | "value";
  entry?: Entry;
  link?: InterestLink;
};
const mapCard = {
  ...s.card,
  borderWidth: 1.5,
  borderColor: "#ADA499",
  padding: 18,
  gap: 8,
};
function MyMap() {
  const { data, session, putEntry, removeEntry } = usePractice();
  const action = useAction();
  const extra = useRound2();
  const today = useToday();
  const now = useLocalNow();
  const [selected, setSelected] = useState<Selection | null>(null),
    [level, setLevel] = useState<Level>("easy"),
    [familyId, setFamilyId] = useState<string>(),
    [adding, setAdding] = useState(false),
    [kind, setKind] = useState<"interest" | "value">("interest"),
    [name, setName] = useState(""),
    [move, setMove] = useState(false),
    [allIn, setAllIn] = useState(false),
    [notice, setNotice] = useState(""),
    [visit, setVisit] = useState(0);
  const live = useRef({ data, owner: session?.user.id });
  useEffect(() => {
    live.current = { data, owner: session?.user.id };
  }, [data, session?.user.id]);
  useFocusEffect(
    useCallback(() => {
      setVisit((value) => value + 1);
      recordScreenVisit(live.current.data, live.current.owner, "my_map");
    }, []),
  );
  const why = currentWhy(data);
  const interests = data.entries.filter((entry) => entry.kind === "interest");
  const suggestions = exploreInterests(data, visit);
  const close =
    selected?.kind === "interest" ? closeInterests(data, selected.title) : [];
  const selection = selectMission(data, {
    priority: selected?.kind === "value" ? selected.title : "",
    where: selected?.kind === "interest" ? selected.title : "anywhere",
    kind: selected?.kind === "interest" ? "interest" : "anywhere",
    level,
    day: today,
    now,
    familyId,
  });
  const generated = useFocusMission(
    selection.mission,
    selected?.title || "",
    level,
    !!selected && !selection.familyId,
    {
      priority: selected?.kind === "value" ? selected.title : "",
      where: selected?.kind === "interest" ? selected.title : "anywhere",
      kind: selected?.kind === "interest" ? "interest" : "anywhere",
    },
  );
  const mission = selection.familyId ? selection.mission : generated.mission;
  const availableLevels = selection.familyId
    ? selection.availableLevels
    : generated.availableLevels;
  const open = (entry: Entry) => {
    if (entry.kind !== "interest" && entry.kind !== "value") return;
    setSelected({ title: entry.title, kind: entry.kind, entry });
    setFamilyId(
      selectMission(data, {
        priority: entry.kind === "value" ? entry.title : "",
        where: entry.kind === "interest" ? entry.title : "anywhere",
        kind: entry.kind === "interest" ? "interest" : "anywhere",
        level: "easy",
        day: today,
        now: new Date(),
      }).familyId,
    );
    setLevel("easy");
    setMove(false);
    setAllIn(false);
    setNotice("");
  };
  const openSuggestion = (link: InterestLink) => {
    setSelected({ title: link.similar_interest, kind: "interest", link });
    setFamilyId(
      selectMission(data, {
        priority: "",
        where: link.similar_interest,
        kind: "interest",
        level: "easy",
        day: today,
        now: new Date(),
      }).familyId,
    );
    setLevel("easy");
    setMove(false);
    setAllIn(false);
    setNotice("");
  };
  const saveSuggestion = (link: InterestLink) =>
    action.run(async () => {
      const existing = data.entries.find(
        (entry) =>
          entry.kind === "interest" &&
          norm(entry.title) === norm(link.similar_interest),
      );
      const saved =
        existing ||
        (await putEntry(
          entryInput("interest", link.similar_interest, {
            state: "want_to_try",
            source: `My map · close to ${link.interest}`,
          }),
        ));
      if (selected?.title === link.similar_interest) open(saved);
      setNotice(`${saved.title} is in Want to try.`);
    });
  const changeState = (state: string) =>
    action.run(async () => {
      if (!selected?.entry) return;
      await putEntry({ ...selected.entry, state });
      setSelected(null);
    });
  const accept = () => {
    if (!selected || !mission) return;
    const unavailable = missionUnavailableReason(mission, data, new Date());
    if (unavailable) {
      setSelected(null);
      setNotice(`That step no longer fits right now. ${unavailable}`);
      return;
    }
    const priority =
      selected.kind === "value"
        ? selected.title
        : mission.priorities.find((value) =>
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
        interest: selected.kind === "interest" ? selected.title : "",
        newInterest: selected.kind === "interest" && !selected.entry ? "1" : "",
      },
    });
  };
  const nextLevel = () => {
    const alternatives = LEVELS.filter((candidate) =>
      availableLevels.includes(candidate),
    );
    if (alternatives.length > 1)
      setLevel(
        alternatives[(alternatives.indexOf(level) + 1) % alternatives.length],
      );
  };
  const askAllIn = () =>
    action.run(async () => {
      if (!selected?.entry) return;
      const allowed = await extra.recordMoment(
        "all_in_check",
        `map:${today}`,
        !!extra.summaries[0]?.hard_day,
      );
      if (allowed) setAllIn(true);
      else {
        await putEntry({ ...selected.entry, state: "all_in" });
        setSelected(null);
      }
    });
  return (
    <Page header={<BrandHeader />} contentStyle={{ gap: 18 }}>
      <Title>My map</Title>
      <View style={mapCard}>
        <Body style={{ fontFamily: F.bold }}>My why</Body>
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
                  (entry) =>
                    entry.kind === "value" && valueState(data, entry) === state,
                )
                .map((entry) => (
                  <Chip
                    key={entry.id}
                    label={`iwillbe.${entry.title}`}
                    onPress={() => open(entry)}
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
        const items = interests.filter(
          (entry) => interestState(data, entry) === stage,
        );
        return items.length ? (
          <View key={stage} style={{ gap: 6 }}>
            <Body style={{ fontSize: 13, color: C.muted }}>{stage}</Body>
            <View style={[s.wrap, { columnGap: 12 }]}>
              {items.map((entry) => (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${entry.title} · ${stage}`}
                  key={entry.id}
                  onPress={() => open(entry)}
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
                    {entry.title}
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
      <View style={s.card}>
        <Title style={{ fontSize: 22, lineHeight: 28 }}>
          Explore close to what you love
        </Title>
        {suggestions.length ? (
          suggestions.map((link) => (
            <Pressable
              key={link.similar_interest}
              accessibilityRole="button"
              accessibilityLabel={`Explore ${link.similar_interest}`}
              onPress={() => openSuggestion(link)}
              style={{ minHeight: 44, gap: 4, paddingVertical: 8 }}
            >
              <Body style={{ fontFamily: F.strong }}>
                {link.similar_interest} <Body style={{ color: C.gold }}>›</Body>
              </Body>
              <Body style={{ color: C.muted, fontSize: 14, lineHeight: 21 }}>
                {link.reason}
              </Body>
            </Pressable>
          ))
        ) : (
          <Body style={{ color: C.muted, fontSize: 14 }}>
            {interests.some((entry) => interestState(data, entry) === "Into it")
              ? "Your nearby interests are already on your map. You can explore a next step by tapping one."
              : "As you find interests you’re into, you’ll discover nearby things to try here."}
          </Body>
        )}
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Future me"
        onPress={() => router.push("/telescope")}
        style={[mapCard, s.row, { justifyContent: "space-between" }]}
      >
        <View style={{ flex: 1, gap: 4 }}>
          <Body style={{ fontFamily: F.bold, fontSize: 20 }}>Future me</Body>
          <Body style={{ color: C.muted, fontSize: 14, lineHeight: 21 }}>
            Your someday list, this year and later in life
          </Body>
        </View>
        <Body style={{ fontSize: 30, color: C.gold }}>›</Body>
      </Pressable>
      <Notice text={notice} />
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
                const title = norm(name);
                const prior = data.entries.find(
                  (entry) => entry.kind === kind && norm(entry.title) === title,
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
            ? `${selected.kind === "value" ? "iwillbe." : ""}${selected.title}`
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
              {availableLevels.length > 1 && (
                <TextButton
                  label={
                    level === availableLevels[availableLevels.length - 1]
                      ? "Easier"
                      : "Harder"
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
            {selected.link && (
              <Body style={{ color: C.muted, fontSize: 14 }}>
                Close to {selected.link.interest}: {selected.link.reason}
              </Body>
            )}
            <FocusCard
              hideActions
              mission={mission}
              level={level}
              onLevel={setLevel}
              onAccept={accept}
              availableLevels={availableLevels}
              unavailableReasons={
                selection.familyId
                  ? selection.unavailableReasons
                  : generated.unavailableReasons
              }
              loading={action.busy}
              label="Make it today's focus"
            />
            {!mission && (
              <TextButton
                label="Write my own focus"
                onPress={() => {
                  setSelected(null);
                  router.push("/");
                }}
              />
            )}
            {generated.error && !selection.familyId && (
              <>
                <Notice text={generated.error} />
                <TextButton label="Retry ideas" onPress={generated.retry} />
              </>
            )}
            {!selected.entry && selected.link && (
              <Button
                secondary
                label="Want to try"
                loading={action.busy}
                onPress={() => saveSuggestion(selected.link!)}
              />
            )}
            {selected.entry && (
              <>
                <TextButton label="Keep it" onPress={() => setSelected(null)} />
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
                        selected={
                          selected.kind === "interest"
                            ? interestState(data, selected.entry!) === stage
                            : valueState(data, selected.entry!) === stage
                        }
                        onPress={() =>
                          stage === "All in"
                            ? askAllIn()
                            : changeState(
                                selected.kind === "interest"
                                  ? STAGE_VALUES[i]
                                  : ["working_on", "important", "let_go"][i],
                              )
                        }
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
                      onPress={() => changeState("all_in")}
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
                      interestState(data, selected.entry) === "On pause"
                        ? "Bring back"
                        : "On pause"
                    }
                    onPress={() =>
                      action.run(async () => {
                        const entry = selected.entry!;
                        await putEntry({
                          ...entry,
                          state:
                            interestState(data, entry) === "On pause"
                              ? entry.meta.previous_state || "want_to_try"
                              : "on_pause",
                          meta: { ...entry.meta, previous_state: entry.state },
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
                      await removeEntry(
                        selected.entry!.id,
                        selected.entry!.revision,
                      );
                      setSelected(null);
                    })
                  }
                />
              </>
            )}
            {selected.kind === "interest" && (
              <View
                style={{
                  gap: 12,
                  borderTopWidth: 1,
                  borderColor: C.line,
                  paddingTop: 18,
                }}
              >
                <Title style={{ fontSize: 22 }}>Close to this</Title>
                {close.length ? (
                  close.map((link) => (
                    <View key={link.similar_interest} style={{ gap: 3 }}>
                      <Body style={{ fontFamily: F.strong }}>
                        {link.similar_interest}
                      </Body>
                      <Body
                        style={{ color: C.muted, fontSize: 14, lineHeight: 21 }}
                      >
                        {link.reason}
                      </Body>
                      <TextButton
                        label={`Want to try ${link.similar_interest}`}
                        color={C.gold}
                        onPress={() => saveSuggestion(link)}
                      />
                    </View>
                  ))
                ) : (
                  <Body style={{ color: C.muted, fontSize: 14 }}>
                    The nearby interests we know are already on your map.
                  </Body>
                )}
              </View>
            )}
            <Notice text={notice} />
            <Notice text={action.error} tone="error" />
          </>
        )}
      </Sheet>
      <Notice text={extra.error} tone="error" />
    </Page>
  );
}
export default withAccount(MyMap);
