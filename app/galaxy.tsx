import React, { useCallback, useEffect, useRef, useState } from "react";
import { View, Pressable, type ViewStyle } from "react-native";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { withAccount } from "../src/access-gate";
import { usePractice } from "../src/practice";
import { useToday, useLocalNow } from "../src/use-today";
import { useRound2 } from "../src/round2-store";
import { useAction } from "../src/use-action";
import { shiftDay } from "../src/domain";
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
  MISSIONS,
  norm,
  priorityOptions,
  selectMission,
  missionUnavailableReason,
  type Level,
} from "../src/round2";
import { PRIORITY_WORDS } from "../src/priorities";
import { growingInterests, discoverInterests } from "../src/round4-map";
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
import { BrandHeader } from "../src/brand-header";
import { ScrollWheel } from "../src/scroll-wheel";
import { MapDrawing } from "../src/map-drawings";
import { recordScreenVisit } from "../src/usage";

const tileStyle: ViewStyle = {
  borderWidth: 1,
  borderColor: C.line,
  borderRadius: 23,
  padding: 16,
  gap: 12,
  minHeight: 176,
  overflow: "hidden",
};
function Tile({
  label,
  children,
  onPress,
  style,
}: {
  label: string;
  children: React.ReactNode;
  onPress: () => void;
  style?: ViewStyle;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={[tileStyle, style]}
    >
      {children}
    </Pressable>
  );
}
function TileLabel({
  children,
  light = false,
}: {
  children: React.ReactNode;
  light?: boolean;
}) {
  return (
    <Body
      style={{
        fontSize: 13,
        lineHeight: 19,
        color: light ? "#FFFFFF" : C.muted,
      }}
    >
      {children}
    </Body>
  );
}

function MyMap() {
  const { data, session, putEntry, removeEntry } = usePractice();
  const extra = useRound2();
  const action = useAction();
  const today = useToday();
  const now = useLocalNow();
  const params = useLocalSearchParams<{ build?: string; interest?: string }>();
  const [screen, setScreen] = useState<"map" | "build" | "growing">("map");
  const [panel, setPanel] = useState<"priorities" | "people" | null>(null);
  const [selected, setSelected] = useState<Entry | null>(null);
  const [priorityChoice, setPriorityChoice] = useState("");
  const [interestChoice, setInterestChoice] = useState("");
  const [placeChoice, setPlaceChoice] = useState("");
  const [growingChoice, setGrowingChoice] = useState("");
  const [level, setLevel] = useState<Level>("easy");
  const [familyId, setFamilyId] = useState<string>();
  const [excluded, setExcluded] = useState<string[]>([]);
  const [name, setName] = useState("");
  const [addingPriority, setAddingPriority] = useState(false);
  const [notice, setNotice] = useState("");
  const [allIn, setAllIn] = useState(false);
  const [handledRequest, setHandledRequest] = useState("");
  const live = useRef({ data, owner: session?.user.id });
  useEffect(() => {
    live.current = { data, owner: session?.user.id };
  }, [data, session?.user.id]);
  useFocusEffect(
    useCallback(() => {
      recordScreenVisit(live.current.data, live.current.owner, "my_map");
    }, []),
  );

  const priorities = priorityOptions(data);
  const priorityNames = priorities.length
    ? priorities
    : PRIORITY_WORDS.map((item) => item.name);
  const priority = priorityNames.includes(priorityChoice)
    ? priorityChoice
    : priorityNames[0] || "";
  const interests = growingInterests(data);
  const activeInterests = interests.filter(
    (entry) => interestState(data, entry) !== "On pause",
  );
  const interest = activeInterests.some(
    (entry) => entry.title === interestChoice,
  )
    ? interestChoice
    : "";
  const places = extra.places
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order);
  const place = places.some((item) => item.label === placeChoice)
    ? placeChoice
    : "";
  const growing =
    interests.find((entry) => entry.id === growingChoice) || interests[0];
  const growingStage = growing ? interestState(data, growing) : "Want to try";
  const selection = selectMission(data, {
    priority,
    interest,
    place,
    where: "anywhere",
    kind: "anywhere",
    level,
    day: today,
    now,
    familyId,
    excludedFamilyIds: excluded,
  });
  const mission = selection.mission;
  const nextLevel = LEVELS.find(
    (candidate) =>
      LEVELS.indexOf(candidate) > LEVELS.indexOf(level) &&
      selection.availableLevels.includes(candidate),
  );
  const nextDay = shiftDay(today, 1);
  const reminder = data.entries.find(
    (entry) =>
      entry.kind === "preferences" &&
      entry.title === "Action reminder" &&
      entry.meta.status === "open" &&
      entry.meta.reminder_day === nextDay &&
      entry.meta.mission_id === mission?.id &&
      entry.meta.priority === priority &&
      (entry.meta.interest || "") === interest &&
      (entry.meta.place || "") === place,
  );

  const resetIdea = () => {
    setLevel("easy");
    setFamilyId(undefined);
    setExcluded([]);
    setNotice("");
  };
  const startBuild = (entry?: Entry, chosenInterest?: string) => {
    const title =
      chosenInterest || (entry?.kind === "interest" ? entry.title : "");
    const matchingPriority = title
      ? MISSIONS.find(
          (item) =>
            item.interests.some((name) => norm(name) === norm(title)) &&
            item.priorities.some((name) => priorityNames.includes(name)),
        )?.priorities.find((name) => priorityNames.includes(name))
      : undefined;
    setPriorityChoice(
      entry?.kind === "value" ? entry.title : matchingPriority || priority,
    );
    setInterestChoice(title);
    setPlaceChoice("");
    resetIdea();
    setSelected(null);
    setPanel(null);
    setScreen("build");
  };
  const buildRequest =
    params.build === "1" ? `build:${params.interest || ""}` : "";
  if (buildRequest !== handledRequest) {
    setHandledRequest(buildRequest);
    if (buildRequest) {
      const title = typeof params.interest === "string" ? params.interest : "";
      setInterestChoice(title);
      if (title) {
        const availablePriorities = priorityOptions(data);
        const found = MISSIONS.find((item) =>
          item.interests.some((name) => norm(name) === norm(title)),
        );
        setPriorityChoice(
          found?.priorities.find((name) =>
            availablePriorities.includes(name),
          ) || "",
        );
      }
      setLevel("easy");
      setFamilyId(undefined);
      setExcluded([]);
      setScreen("build");
    }
  }
  useEffect(() => {
    if (params.build === "1") router.setParams({ build: "", interest: "" });
  }, [params.build, params.interest]);

  const another = () => {
    if (!selection.familyId) return;
    const allPassed = [...excluded, selection.familyId];
    let next = selectMission(data, {
      priority,
      interest,
      place,
      where: "anywhere",
      kind: "anywhere",
      level: "easy",
      day: today,
      now,
      excludedFamilyIds: allPassed,
    });
    let nextExcluded = allPassed;
    if (!next.mission) {
      nextExcluded = [selection.familyId];
      next = selectMission(data, {
        priority,
        interest,
        place,
        where: "anywhere",
        kind: "anywhere",
        level: "easy",
        day: today,
        now,
        excludedFamilyIds: nextExcluded,
      });
    }
    if (!next.mission) {
      setNotice(
        "That's the only idea that fits all three choices right now. Try another word on a wheel.",
      );
      return;
    }
    setExcluded(nextExcluded);
    setFamilyId(next.familyId);
    setLevel("easy");
    setNotice("");
  };
  const accept = () => {
    if (!mission) return;
    const unavailable = missionUnavailableReason(mission, data, new Date());
    if (unavailable) {
      setNotice(unavailable);
      return;
    }
    router.push({
      pathname: "/",
      params: {
        missionId: mission.id,
        missionText: mission.mission_text,
        missionLevel: level,
        missionType: mission.type,
        missionStep: String(mission.ladder_step),
        priority,
        interest,
        place,
      },
    });
  };
  const saveReminder = () =>
    action.run(async () => {
      if (!mission || reminder) return;
      await putEntry(
        entryInput("preferences", "Action reminder", {
          body: mission.mission_text,
          source: "Chosen in Build an action",
          meta: {
            reminder_day: nextDay,
            mission_id: mission.id,
            priority,
            interest,
            place,
            level,
            status: "open",
            created_from: "build_action",
            mission_snapshot: mission,
          },
        }),
      );
    });
  const changeState = (state: string) =>
    action.run(async () => {
      if (!selected) return;
      await putEntry({
        ...selected,
        state,
        meta: { ...selected.meta, previous_state: selected.state },
      });
      setSelected(null);
      setAllIn(false);
    });

  const why = currentWhy(data);
  const people = places.filter((item) =>
    /^(with |for |in my community)/i.test(item.label),
  );
  const discovery = discoverInterests(data, [], today);
  const previewInterests = [...discovery.close, ...discovery.different].map(
    (idea) => idea.title,
  );
  const displayPriorities = priorities.slice(0, 2);
  const topInterests = activeInterests.slice(0, 3).map((entry) => entry.title);
  const openSelected = (entry: Entry) => {
    setSelected(entry);
    setPanel(null);
    setAllIn(false);
  };

  return (
    <Page
      header={
        screen === "map" ? (
          <BrandHeader
            right={
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Build an action"
                onPress={() => startBuild()}
                style={{
                  minHeight: 44,
                  borderRadius: 24,
                  borderWidth: 1,
                  borderColor: C.ink,
                  paddingHorizontal: 14,
                  justifyContent: "center",
                }}
              >
                <Body style={{ fontSize: 13, fontFamily: F.strong }}>
                  <Body style={{ color: C.gold }}>+ </Body>Build an action
                </Body>
              </Pressable>
            }
          />
        ) : (
          <TopBar
            title={screen === "build" ? "Build an action" : "What I'm growing"}
            onBack={() => {
              setScreen("map");
              setNotice("");
            }}
          />
        )
      }
      contentStyle={{ gap: screen === "map" ? 12 : 18, paddingBottom: 32 }}
    >
      {screen === "map" && (
        <>
          <Tile
            label="My why · Shape my why"
            onPress={() => router.push("/why")}
            style={{
              backgroundColor: C.ink,
              minHeight: 142,
              borderColor: C.ink,
              paddingRight: 65,
            }}
          >
            <View style={{ position: "absolute", right: -8, top: -15 }}>
              <MapDrawing kind="target" size={96} />
            </View>
            <TileLabel light>My why</TileLabel>
            <Body
              numberOfLines={3}
              style={{
                fontFamily: F.bold,
                fontSize: 20,
                lineHeight: 26,
                color: C.white,
              }}
            >
              {why?.body ||
                "Still forming. Your choices will help it take shape."}
            </Body>
          </Tile>
          <View style={{ flexDirection: "row", gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Tile
                label="Who I'm becoming"
                onPress={() => setPanel("priorities")}
                style={{ flex: 1, backgroundColor: C.soft }}
              >
                <TileLabel>{"Who I'm becoming"}</TileLabel>
                <View style={{ gap: 3 }}>
                  {displayPriorities.length ? (
                    displayPriorities.map((name) => (
                      <Body
                        key={name}
                        style={{
                          fontFamily: F.bold,
                          fontSize: 18,
                          lineHeight: 24,
                        }}
                      >
                        iwillbe.
                        <Body style={{ color: C.gold, fontFamily: F.bold }}>
                          {name}
                        </Body>
                      </Body>
                    ))
                  ) : (
                    <Body style={{ fontFamily: F.bold }}>
                      Who do you want to be?
                    </Body>
                  )}
                </View>
                {priorities.length > 2 && (
                  <Body
                    style={{ fontSize: 13, lineHeight: 19, color: C.muted }}
                  >
                    + {priorities.slice(2, 4).join(", ")}
                    {priorities.length > 4
                      ? ` and ${priorities.length - 4} more`
                      : ""}
                  </Body>
                )}
              </Tile>
            </View>
            <View style={{ flex: 1 }}>
              <Tile
                label="What I'm growing"
                onPress={() => setScreen("growing")}
                style={{
                  flex: 1,
                  backgroundColor: C.gold,
                  borderColor: C.gold,
                }}
              >
                <TileLabel light>{"What I'm growing"}</TileLabel>
                <View style={{ alignSelf: "center" }}>
                  <MapDrawing kind="sprout" color={C.white} size={64} />
                </View>
                <Body style={{ fontFamily: F.bold, color: C.white }}>
                  {topInterests.join(", ") ||
                    "Make room for what lights you up"}
                </Body>
              </Tile>
            </View>
          </View>
          <View style={{ flexDirection: "row", gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Tile
                label="Who I show up for"
                onPress={() => setPanel("people")}
                style={{ flex: 1, backgroundColor: C.white }}
              >
                <TileLabel>Who I show up for</TileLabel>
                <View
                  style={{
                    flexDirection: "row",
                    minHeight: 48,
                    alignItems: "center",
                    paddingLeft: 3,
                  }}
                >
                  {(people.length
                    ? people
                        .slice(0, 3)
                        .map((item) =>
                          item.label.replace(/^(with |for |in )?(my )?/i, ""),
                        )
                    : ["me"]
                  ).map((name, index) => (
                    <View
                      key={name}
                      style={{
                        width: 44,
                        height: 44,
                        marginLeft: index ? -8 : 0,
                        borderRadius: 22,
                        borderWidth: 2,
                        borderColor: C.white,
                        backgroundColor: [C.gold, C.ink, "#F2C4A7"][index],
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Body
                        numberOfLines={1}
                        style={{
                          fontSize: 11,
                          lineHeight: 16,
                          paddingHorizontal: 3,
                          color: index === 2 ? C.ink : C.white,
                        }}
                      >
                        {name}
                      </Body>
                    </View>
                  ))}
                </View>
                <Body style={{ fontSize: 14, lineHeight: 21, color: C.muted }}>
                  {people.length
                    ? people
                        .map((item) => item.label.replace(/^with /, ""))
                        .join(", ")
                    : "The people who matter, including you."}
                </Body>
              </Tile>
            </View>
            <View style={{ flex: 1 }}>
              <Tile
                label="Try something new"
                onPress={() => router.push("/explore")}
                style={{
                  flex: 1,
                  backgroundColor: C.white,
                  borderStyle: "dashed",
                  borderColor: C.gold,
                }}
              >
                <TileLabel>Try something new</TileLabel>
                <View style={{ alignSelf: "center" }}>
                  <MapDrawing kind="compass" size={50} />
                </View>
                <Body style={{ fontFamily: F.bold }}>
                  {previewInterests.slice(0, 2).join(", ") ||
                    "Follow your curiosity"}
                  {previewInterests.length > 2 && (
                    <Body style={{ color: C.gold }}>
                      {" "}
                      +{previewInterests.length - 2}
                    </Body>
                  )}
                </Body>
              </Tile>
            </View>
          </View>
          <Tile
            label="Future me"
            onPress={() => router.push("/telescope")}
            style={{
              minHeight: 96,
              flexDirection: "row",
              alignItems: "center",
              backgroundColor: "#EFEAE4",
              borderColor: "#EFEAE4",
              gap: 14,
            }}
          >
            <MapDrawing kind="mountain" size={52} />
            <View style={{ flex: 1, gap: 4 }}>
              <Body style={{ fontFamily: F.bold, fontSize: 19 }}>
                Future me
              </Body>
              <Body style={{ fontSize: 13, lineHeight: 19, color: C.muted }}>
                This year, 5 years, 10 years, later in life
              </Body>
            </View>
          </Tile>
        </>
      )}

      {screen === "build" && (
        <>
          <View style={{ gap: 0 }}>
            <ScrollWheel
              priority
              label="Priority"
              items={priorityNames.map((name) => ({ id: name, label: name }))}
              value={priority}
              onChange={(name) => {
                if (name !== priority) {
                  setPriorityChoice(name);
                  resetIdea();
                }
              }}
            />
            <ScrollWheel
              label="Interest"
              items={[
                { id: "", label: "any way" },
                ...activeInterests.map((entry) => ({
                  id: entry.title,
                  label: entry.title,
                })),
              ]}
              value={interest}
              onChange={(name) => {
                if (name !== interest) {
                  setInterestChoice(name);
                  resetIdea();
                }
              }}
            />
            <ScrollWheel
              label="People or place"
              items={[
                { id: "", label: "anywhere" },
                ...places.map((item) => ({
                  id: item.label,
                  label: item.label,
                })),
              ]}
              value={place}
              onChange={(name) => {
                if (name !== place) {
                  setPlaceChoice(name);
                  resetIdea();
                }
              }}
            />
          </View>
          <View
            style={{
              gap: 14,
              borderTopWidth: 1,
              borderColor: C.line,
              paddingTop: 18,
            }}
          >
            <Body style={{ fontSize: 13, color: C.muted }}>
              {"Chloe's idea"}
            </Body>
            <Body
              style={{ fontFamily: F.strong, fontSize: 18, lineHeight: 27 }}
            >
              {mission?.mission_text ||
                "No library idea fits all three choices right now. Try any way, another place, or write your own focus."}
            </Body>
            {!!mission && (
              <Body style={{ color: C.muted, fontSize: 13 }}>
                {mission.minutes} min ·{" "}
                {level === "easy"
                  ? "Easy"
                  : level === "normal"
                    ? "Normal"
                    : "Stretch"}
              </Body>
            )}
            <View style={{ flexDirection: "row", gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Button
                  secondary
                  icon={false}
                  label="Harder"
                  disabled={!nextLevel}
                  onPress={() => {
                    setFamilyId(selection.familyId);
                    setLevel(nextLevel!);
                  }}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Button
                  secondary
                  icon={false}
                  label="↻ Another idea"
                  disabled={!mission}
                  onPress={another}
                />
              </View>
            </View>
            {level !== "easy" && (
              <TextButton
                label="Back to the easy version"
                onPress={() => {
                  setFamilyId(selection.familyId);
                  setLevel("easy");
                }}
              />
            )}
            {!nextLevel && level !== "stretch" && !!mission && (
              <Body style={{ fontSize: 13, color: C.muted }}>
                {selection.unavailableReasons.normal ||
                  selection.unavailableReasons.stretch ||
                  "This is the largest size that fits right now."}
              </Body>
            )}
          </View>
          <Button
            icon={false}
            label="Make it today's focus"
            disabled={!mission}
            onPress={accept}
          />
          <Button
            secondary
            icon={false}
            label={
              reminder
                ? "Added to the top of Today"
                : "Remind me of this action"
            }
            disabled={!mission || !!reminder}
            loading={action.busy}
            onPress={saveReminder}
          />
          {!mission && (
            <TextButton
              label="Write my own focus"
              onPress={() => router.push("/")}
            />
          )}
        </>
      )}

      {screen === "growing" && (
        <>
          {growing ? (
            <>
              <ScrollWheel
                priority
                label="Your interests"
                items={interests.map((entry) => ({
                  id: entry.id,
                  label: entry.title,
                }))}
                value={growing.id}
                onChange={setGrowingChoice}
              />
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 10,
                }}
              >
                <View style={{ gap: 7 }}>
                  <View style={{ flexDirection: "row", gap: 5 }}>
                    {[0, 1, 2, 3].map((index) => (
                      <View
                        key={index}
                        style={{
                          width: 7 + index * 2,
                          height: 7 + index * 2,
                          borderRadius: 10,
                          alignSelf: "flex-end",
                          backgroundColor:
                            index <=
                            [
                              "Want to try",
                              "From time to time",
                              "Into it",
                              "All in",
                            ].indexOf(growingStage)
                              ? C.gold
                              : C.line,
                        }}
                      />
                    ))}
                  </View>
                  <Body style={{ fontSize: 13, color: C.muted }}>
                    {growingStage}
                  </Body>
                </View>
                <TextButton
                  label={
                    growingStage === "On pause"
                      ? "Bring it back"
                      : "Next step →"
                  }
                  color={C.gold}
                  onPress={() =>
                    growingStage === "On pause"
                      ? openSelected(growing)
                      : startBuild(growing)
                  }
                />
              </View>
              <TextButton
                label="Change this interest's stage"
                onPress={() => openSelected(growing)}
              />
            </>
          ) : (
            <>
              <Title>What would you love to try?</Title>
              <Body>Your interests will grow here as you explore.</Body>
            </>
          )}
          <Button
            secondary
            icon={false}
            label="+ Add an interest"
            onPress={() => router.push("/explore")}
          />
        </>
      )}
      <Notice text={notice} />
      <Notice text={action.error || extra.error} tone="error" />

      <Sheet
        open={panel === "priorities"}
        onClose={() => setPanel(null)}
        title="Who I'm becoming"
      >
        {(["Working on", "Important to me", "Let go"] as const).map((state) => {
          const entries = data.entries.filter(
            (entry) =>
              entry.kind === "value" && valueState(data, entry) === state,
          );
          return entries.length ? (
            <View key={state} style={{ gap: 8 }}>
              <Body style={{ color: C.muted, fontSize: 13 }}>{state}</Body>
              <View style={s.wrap}>
                {entries.map((entry) => (
                  <Chip
                    key={entry.id}
                    label={`iwillbe.${entry.title}`}
                    onPress={() => openSelected(entry)}
                  />
                ))}
              </View>
            </View>
          ) : null;
        })}
        <Button
          secondary
          icon={false}
          label="+ Add a priority"
          onPress={() => {
            setPanel(null);
            setName("");
            setAddingPriority(true);
          }}
        />
      </Sheet>
      <Sheet
        open={panel === "people"}
        onClose={() => setPanel(null)}
        title="Who I show up for"
      >
        {people.length ? (
          people.map((item) => (
            <View key={item.id} style={s.card}>
              <Body style={{ fontFamily: F.strong }}>{item.label}</Body>
            </View>
          ))
        ) : (
          <Body>
            You can start with yourself, or someone who matters to you.
          </Body>
        )}
        <Field
          label="Someone or somewhere to show up for"
          placeholder="with my sister"
          value={name}
          onChangeText={setName}
          maxLength={80}
        />
        <Button
          icon={false}
          label="Add"
          disabled={!name.trim()}
          loading={action.busy}
          onPress={() =>
            action.run(async () => {
              await extra.addPlace(name.trim());
              setName("");
            })
          }
        />
        <Notice text={action.error} tone="error" />
      </Sheet>
      <Sheet
        open={addingPriority}
        onClose={() => setAddingPriority(false)}
        title="Who do you want to be?"
      >
        <Field
          label="A priority"
          value={name}
          onChangeText={setName}
          maxLength={80}
          autoCapitalize="none"
        />
        <Button
          icon={false}
          label="Add to my map"
          disabled={!name.trim()}
          loading={action.busy}
          onPress={() =>
            action.run(async () => {
              const title = norm(name);
              const old = data.entries.find(
                (entry) =>
                  entry.kind === "value" && norm(entry.title) === title,
              );
              const entry =
                old ||
                (await putEntry(
                  entryInput("value", title, { state: "working_on" }),
                ));
              setAddingPriority(false);
              openSelected(entry);
            })
          }
        />
        <Notice text={action.error} tone="error" />
      </Sheet>
      <Sheet
        open={!!selected}
        onClose={() => {
          setSelected(null);
          setAllIn(false);
        }}
        title={selected ? `iwillbe.${selected.title}` : "My map"}
      >
        {selected && (
          <>
            <Body style={{ color: C.muted }}>
              {selected.kind === "interest"
                ? interestState(data, selected)
                : valueState(data, selected)}
            </Body>
            <Button
              icon={false}
              label="Build an action"
              onPress={() => startBuild(selected)}
            />
            <Body style={{ fontFamily: F.strong }}>Move to</Body>
            <View style={s.wrap}>
              {(selected.kind === "interest"
                ? STAGES
                : ["Working on", "Important to me", "Let go"]
              ).map((stage, index) => (
                <Chip
                  key={stage}
                  label={stage}
                  selected={
                    (selected.kind === "interest"
                      ? interestState(data, selected)
                      : valueState(data, selected)) === stage
                  }
                  onPress={() =>
                    stage === "All in"
                      ? setAllIn(true)
                      : changeState(
                          selected.kind === "interest"
                            ? STAGE_VALUES[index]
                            : ["working_on", "important", "let_go"][index],
                        )
                  }
                />
              ))}
            </View>
            {allIn && (
              <View style={[s.card, { backgroundColor: C.soft }]}>
                <Body>
                  Is this something you truly want to go all in on, or is it
                  just interesting right now?
                </Body>
                <Button
                  icon={false}
                  label="All in"
                  onPress={() => changeState("all_in")}
                />
                <TextButton
                  label="Just interesting for now"
                  onPress={() => changeState("into_it")}
                />
              </View>
            )}
            <TextButton label="Keep it" onPress={() => setSelected(null)} />
            <TextButton
              label="Remove"
              onPress={() =>
                action.run(async () => {
                  await removeEntry(selected.id, selected.revision);
                  setSelected(null);
                })
              }
            />
            <Notice text={action.error} tone="error" />
          </>
        )}
      </Sheet>
    </Page>
  );
}

export default withAccount(MyMap);
