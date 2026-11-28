import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { LightbulbIcon } from "phosphor-react-native/src/icons/Lightbulb";
import { LightningIcon } from "phosphor-react-native/src/icons/Lightning";
import { MinusIcon } from "phosphor-react-native/src/icons/Minus";
import { BatteryLowIcon } from "phosphor-react-native/src/icons/BatteryLow";
import { NightSummary } from "../src/night-summary";
import { NightThought } from "../src/night-thought";
import { nightCompletionMarker } from "../src/night-completion";
import { NightFollowupCard } from "../src/night-followup";
import {
  followupInput,
  nightFollowup,
  onboardingSchedule,
} from "../src/onboarding-followups";
import { supportLevel } from "../supabase/functions/_shared/safety";
import { withAccount } from "../src/access-gate";
import { supabase } from "../src/supabase";
import { usePractice } from "../src/practice";
import { useToday } from "../src/use-today";
import { useAction } from "../src/use-action";
import { useSavedMissionFamily } from "../src/private-missions";
import { shiftDay, type Intention, type Outcome } from "../src/domain";
import { draftKey, useDraft } from "../src/drafts";
import {
  entryInput,
  entriesOf,
  type Energy,
  type Entry,
  type ValueChoice,
} from "../src/journey";
import { isHardDay } from "../src/round2";
import { PRIORITY_WORDS, priorityName } from "../src/priorities";
import {
  OBSTACLES,
  focusKey,
  focusSentence,
  inferredInterest,
  obstacleEvent,
  obstaclePlan,
  priorityReviewDue,
  shouldAskObstacle,
  type ObstacleReason,
} from "../src/round4-flow";
import {
  Body,
  Button,
  C,
  Chip,
  F,
  Field,
  Notice,
  Page,
  TextButton,
  Title,
  TopBar,
  s,
} from "../src/ui";

function Reflect() {
  const { data } = usePractice();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const today = useToday();
  const intention = data.intentions.find((item) =>
    id ? item.id === id : item.day === today,
  );
  useEffect(() => {
    void supabase.functions.invoke("chloe", {
      body: { action: "start_checkin", session_id: `night-${today}` },
    });
  }, [today]);
  if (intention && intention.day > today)
    return (
      <Page header={<TopBar title="Night" />}>
        <Title>A little early.</Title>
        <Body>
          Leave this one with tomorrow. There’s room for a thought from today.
        </Body>
        <Button
          label="Tonight's check-in"
          onPress={() => router.replace("/reflect")}
        />
      </Page>
    );
  return (
    <NightForm
      key={intention ? `${intention.id}:${focusKey(intention)}` : today}
      intention={intention}
      today={today}
    />
  );
}

function NightForm({
  intention,
  today,
}: {
  intention?: Intention;
  today: string;
}) {
  const { data, session, checkIn, putEntry } = usePractice();
  const savedMission = useSavedMissionFamily(intention?.mission_id);
  const prior = data.checkIns.find(
    (check) => check.intention_id === intention?.id,
  );
  const priorEvent = data.entries.find(
    (entry) =>
      entry.kind === "event" &&
      entry.title === "Night obstacle" &&
      entry.meta.intention_id === intention?.id &&
      !!intention &&
      entry.meta.focus_key === focusKey(intention) &&
      entry.meta.focus_day === today,
  );
  const { draft, update, clear, ready, draftError } = useDraft(
    draftKey(
      `night.round4.${intention ? `${intention.id}:${focusKey(intention)}` : today}`,
      session?.user.id,
    ),
    {
      outcome: prior?.outcome as Outcome | undefined,
      energy: prior?.energy || (null as Energy | null),
      note: prior?.reflection || "",
      revision: prior?.revision || 0,
      obstacleReason: priorEvent?.meta.obstacle_reason as
        ObstacleReason | undefined,
      obstacleChoice: priorEvent?.meta.obstacle_choice as
        "keep" | "release" | undefined,
      valueChoice: prior?.value_choice || (null as ValueChoice | null),
      replacement: "",
      replacing: false,
      addInterest: false,
    },
  );
  const action = useAction();
  const [done, setDone] = useState(false);
  const [skipped, setSkipped] = useState(false);
  const [mapQuestionAlreadyShown, setMapQuestionAlreadyShown] = useState(false);
  const [markerError, setMarkerError] = useState("");
  const [tomorrowChoice, setTomorrowChoice] = useState<
    "keep" | "morning" | null
  >(null);
  const marker = useRef<Entry | undefined>(priorEvent);
  const markerPending = useRef<Promise<Entry> | null>(null);
  const markerKey = useRef("");
  const savedCheck = useRef("");
  const quietNight = isHardDay(draft.note) || supportLevel(draft.note) > 0;
  const growthAllowed = !quietNight && intention?.day === today && !skipped;
  const followup = nightFollowup(data, today, intention, draft.note);
  const completedDay = onboardingSchedule(data)?.meta.completed_day;
  const inFirstTwoWeeks =
    !!completedDay &&
    Date.parse(today) - Date.parse(completedDay) < 14 * 86400000;
  const followupNight =
    !!followup ||
    data.entries.some(
      (entry) =>
        entry.kind === "preferences" &&
        entry.title === "Onboarding follow-up" &&
        entry.meta.asked_day === today &&
        !entry.meta.followup_key?.startsWith("sunday:"),
    );
  const obstacleEligible =
    !!intention &&
    growthAllowed &&
    !followupNight &&
    shouldAskObstacle(data, intention, draft.outcome, today, draft.note);
  const showObstacle = obstacleEligible && !done;
  // A reservation prevents a new question. An obstacle already saved for this
  // exact focus still owns its smaller step, including after leaving and returning.
  const keepObstaclePlan =
    growthAllowed && !!priorEvent && !!draft.outcome && draft.outcome !== "yes";
  const plan =
    (obstacleEligible || keepObstaclePlan) && intention && draft.obstacleReason
      ? obstaclePlan(
          data,
          intention,
          draft.obstacleReason,
          draft.note,
          today,
          savedMission.rows,
        )
      : null;
  const released =
    draft.obstacleReason === "motivation" && draft.obstacleChoice === "release";
  const reviewPriority =
    !!intention &&
    growthAllowed &&
    !followupNight &&
    draft.outcome !== "not_yet" &&
    priorityReviewDue(data, intention);
  const newInterest =
    growthAllowed &&
    !followupNight &&
    intention &&
    draft.outcome &&
    draft.outcome !== "not_yet"
      ? inferredInterest(data, intention)
      : "";

  // Remember that the question was shown, even if its optional answer is left
  // blank. Tomorrow's gate uses local dates and a stable mission-family key.
  useEffect(() => {
    if (!ready || !showObstacle || !intention) return;
    const key = `${intention.id}:${focusKey(intention)}:${today}`;
    if (markerKey.current === key || marker.current) return;
    markerKey.current = key;
    const request = putEntry(obstacleEvent(data, intention, today));
    markerPending.current = request;
    void request
      .then((saved) => {
        marker.current = saved;
        setMarkerError("");
      })
      .catch(() => {
        markerKey.current = "";
        setMarkerError(
          "Your answer is safe here. Please try saving again before leaving.",
        );
      })
      .finally(() => {
        markerPending.current = null;
      });
  }, [ready, showObstacle, intention, today, data, putEntry]);

  const save = () =>
    action.run(async () => {
      if (!draft.outcome) return;
      // Saving the fifth Keep it can make a promotion eligible immediately.
      // Defer that new question when this check-in already asked a map question.
      setMapQuestionAlreadyShown(
        showObstacle || reviewPriority || !!newInterest,
      );
      if (intention) {
        const input = {
          intention_id: intention.id,
          revision: savedCheck.current
            ? prior?.revision || draft.revision
            : draft.revision,
          outcome: draft.outcome,
          reflection: draft.note.trim(),
          energy: draft.energy,
          value_choice: reviewPriority
            ? draft.valueChoice
            : prior?.value_choice || null,
        };
        const signature = JSON.stringify([
          input.outcome,
          input.reflection,
          input.energy,
          input.value_choice,
        ]);
        if (savedCheck.current !== signature) {
          await checkIn(input);
          savedCheck.current = signature;
        }
      } else {
        const previous = data.entries.find(
          (entry) =>
            entry.kind === "story" &&
            entry.meta.period === `night:${today}` &&
            entry.title === "Tonight's reflection",
        );
        await putEntry(
          entryInput("story", "Tonight's reflection", {
            ...previous,
            body: draft.note.trim(),
            source: "Night check-in",
            meta: {
              ...previous?.meta,
              period: `night:${today}`,
              night_outcome: draft.outcome,
              night_energy: draft.energy,
            },
          }),
        );
      }
      if (intention && showObstacle) {
        if (markerPending.current) await markerPending.current;
        const base = marker.current || obstacleEvent(data, intention, today);
        const idea = released ? "" : plan?.text || "";
        marker.current = await putEntry({
          ...base,
          body:
            OBSTACLES.find((item) => item.id === draft.obstacleReason)?.label ||
            "",
          meta: {
            ...base.meta,
            obstacle_reason: draft.obstacleReason,
            obstacle_choice: draft.obstacleChoice,
            suggested_action: idea,
            mission_id: plan?.mission?.id,
          },
        });
        if (idea && plan) {
          const existing = data.entries.find(
            (entry) =>
              entry.title === "Action reminder" &&
              entry.meta.intention_id === intention.id &&
              entry.meta.created_from === "night_obstacle",
          );
          await putEntry(
            entryInput("preferences", "Action reminder", {
              ...existing,
              body: idea,
              source: "A smaller step from tonight",
              meta: {
                reminder_day: shiftDay(today, 1),
                mission_id: plan.mission?.id,
                mission_snapshot: plan.mission,
                priority: plan.mission?.priorities.includes(
                  priorityName(intention.value),
                )
                  ? intention.value
                  : plan.mission?.priorities[0] || intention.value,
                interest: plan.mission?.interests.includes(
                  intention.interest || "",
                )
                  ? intention.interest
                  : "",
                place: plan.mission?.places.includes(intention.place || "")
                  ? intention.place
                  : "",
                level: "easy",
                status: "open",
                created_from: "night_obstacle",
                intention_id: intention.id,
                focus_key: focusKey(intention),
                focus_day: today,
              },
            }),
          );
        }
        if (released && intention.mission_id)
          await putEntry(
            entryInput("event", "Mission feedback", {
              state: "let_go",
              source: "Let go at night",
              source_ids: [intention.mission_id],
              meta: {
                mission_id: intention.mission_id,
                priority: intention.value,
              },
            }),
          );
      }
      if (intention && reviewPriority && draft.valueChoice) {
        if (draft.replacing && draft.replacement) {
          const existing = data.entries.find(
            (entry) =>
              entry.kind === "value" &&
              priorityName(entry.title) === priorityName(draft.replacement),
          );
          await putEntry(
            entryInput("value", draft.replacement, {
              ...existing,
              state: "working_on",
              source: "Chosen in a night reflection",
            }),
          );
        }
      }
      if (draft.addInterest && newInterest && intention)
        await putEntry(
          entryInput("interest", newInterest, {
            state: "want_to_try",
            source: "Added by you after tonight's focus",
            source_ids: [intention.id],
          }),
        );
      if (draft.outcome === "yes" && intention)
        for (const entry of entriesOf(data, "backlog").filter(
          (item) =>
            ["open", "active"].includes(item.state) &&
            item.meta.commitment_day === intention.day,
        ))
          await putEntry({ ...entry, state: "done" });
      if (showObstacle || reviewPriority || newInterest)
        await putEntry(
          followupInput(
            data,
            `night-map:${today}`,
            "Tonight's map question",
            today,
            "answered",
          ),
        );
      if (supportLevel(draft.note) < 2)
        await putEntry(nightCompletionMarker(data, intention?.day || today));
      await clear();
      setDone(true);
    });
  const skip = () =>
    action.run(async () => {
      await clear();
      setSkipped(true);
      setDone(true);
    });

  const saveTomorrow = (choice: "keep" | "morning") =>
    action.run(async () => {
      if (!intention || !growthAllowed) return;
      const tomorrow = shiftDay(today, 1);
      const existing = data.entries.find(
        (entry) =>
          entry.kind === "preferences" &&
          entry.title === "Tomorrow focus" &&
          entry.meta.reminder_day === tomorrow,
      );
      const smallerStep = !!plan?.text && !released;
      const chosenMission = smallerStep ? plan?.mission : savedMission.mission;
      const chosenText = smallerStep ? plan!.text : intention.action;
      await putEntry(
        entryInput("preferences", "Tomorrow focus", {
          ...existing,
          body: chosenText,
          source: "Your choice at Goodnight",
          meta: {
            reminder_day: tomorrow,
            prefill: choice === "keep",
            status: choice === "keep" ? "open" : "released",
            created_from: "goodnight",
            priority: chosenMission?.priorities.includes(
              priorityName(intention.value),
            )
              ? intention.value
              : chosenMission?.priorities[0] || intention.value,
            interest: chosenMission
              ? chosenMission.interests.includes(intention.interest || "")
                ? intention.interest
                : ""
              : intention.interest || "",
            place: chosenMission
              ? chosenMission.places.includes(intention.place || "")
                ? intention.place
                : ""
              : intention.place || "",
            mission_id:
              chosenMission?.id ||
              (!smallerStep ? intention.mission_id || undefined : undefined),
            mission_snapshot: chosenMission,
            level: (chosenMission?.level ||
              (!smallerStep ? intention.level || undefined : undefined)) as
              "easy" | "normal" | "stretch" | undefined,
            intention_id: intention.id,
            focus_key: focusKey(intention),
            focus_day: today,
          },
        }),
      );
      setTomorrowChoice(choice);
    });
  if (!ready)
    return <ActivityIndicator accessibilityLabel="Restoring your reflection" />;
  return (
    <Page
      key={done ? "goodnight" : "night"}
      header={<TopBar title={done ? "Goodnight" : "Night"} />}
      contentStyle={{ gap: 22, paddingBottom: 40 }}
    >
      {done ? (
        <>
          <Title>Leave today here.</Title>
          {skipped ? (
            <View style={[s.card, { backgroundColor: C.soft }]}>
              <Body>That&apos;s enough for tonight.</Body>
            </View>
          ) : (
            <NightSummary
              reflection={draft.note}
              allowDiscovery={
                !inFirstTwoWeeks && !followupNight && !mapQuestionAlreadyShown
              }
            />
          )}
          {!!plan?.text && !released && !skipped && (
            <View style={[s.card, { gap: 10 }]}>
              <Body style={{ color: C.gold, fontFamily: F.strong }}>
                A smaller step for tomorrow
              </Body>
              <Body>{plan.text}</Body>
              <Body style={{ color: C.muted, fontSize: 13 }}>
                An idea for the morning. You can choose something else.
              </Body>
            </View>
          )}
          {intention && growthAllowed && !released && !skipped && (
            <View style={[s.card, { gap: 14, borderRadius: 24 }]}>
              <Body style={{ fontFamily: F.bold, fontSize: 19 }}>
                Same focus tomorrow?
              </Body>
              <Button
                secondary
                label={
                  tomorrowChoice === "keep"
                    ? "Ready for tomorrow morning"
                    : "Yes, keep it"
                }
                loading={action.busy}
                onPress={() => void saveTomorrow("keep")}
              />
              <TextButton
                label={
                  tomorrowChoice === "morning"
                    ? "You can choose in the morning"
                    : "I'll choose in the morning"
                }
                disabled={action.busy}
                onPress={() => void saveTomorrow("morning")}
              />
            </View>
          )}
          {!skipped &&
            !quietNight &&
            !mapQuestionAlreadyShown &&
            (!intention || intention.day === today) &&
            !showObstacle &&
            !newInterest && (
              <NightFollowupCard
                day={today}
                focus={intention}
                reflection={draft.note}
              />
            )}
          <NightThought reflection={skipped ? "" : draft.note} />
          <Notice text={action.error} tone="error" />
          <Button label="Goodnight" onPress={() => router.replace("/")} />
        </>
      ) : (
        <>
          {intention ? (
            <View style={{ gap: 6 }}>
              <Body style={{ color: C.muted, fontSize: 14 }}>
                {focusSentence(intention)}
              </Body>
              {!!intention.when_context && (
                <Body style={{ color: C.muted, fontSize: 13 }}>
                  {[intention.when_context, intention.place]
                    .filter(Boolean)
                    .join(" · ")}
                </Body>
              )}
            </View>
          ) : (
            <Body style={{ color: C.muted }}>
              You can check in with today, even without a morning focus.
            </Body>
          )}
          <View style={{ gap: 12 }}>
            <Title>Did you show up?</Title>
            <View style={s.wrap}>
              {(
                [
                  { id: "yes", label: "I did" },
                  { id: "partly", label: "A little" },
                  { id: "not_yet", label: "Not this time" },
                ] as const
              ).map((outcome) => (
                <Chip
                  key={outcome.id}
                  label={outcome.label}
                  selected={draft.outcome === outcome.id}
                  onPress={() =>
                    update({
                      outcome: outcome.id,
                      ...(outcome.id === "yes"
                        ? {
                            obstacleReason: undefined,
                            obstacleChoice: undefined,
                          }
                        : {}),
                    })
                  }
                />
              ))}
            </View>
          </View>
          <View style={{ gap: 12 }}>
            <Body style={{ fontFamily: F.bold, fontSize: 20 }}>
              How did it feel?
            </Body>
            <View style={{ gap: 8, flexDirection: "row" }}>
              {(
                [
                  { id: "lit", label: "Gave me energy", Icon: LightningIcon },
                  { id: "neutral", label: "Neutral", Icon: MinusIcon },
                  { id: "drained", label: "Drained me", Icon: BatteryLowIcon },
                ] as const
              ).map((energy) => (
                <Pressable
                  key={energy.id}
                  accessibilityRole="button"
                  accessibilityLabel={energy.label}
                  accessibilityState={{ selected: draft.energy === energy.id }}
                  style={{
                    flex: 1,
                    minHeight: 96,
                    borderRadius: 20,
                    borderWidth: draft.energy === energy.id ? 2 : 1,
                    borderColor: draft.energy === energy.id ? C.gold : C.line,
                    backgroundColor:
                      draft.energy === energy.id ? C.soft : C.white,
                    padding: 10,
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 10,
                  }}
                  onPress={() =>
                    update({
                      energy: draft.energy === energy.id ? null : energy.id,
                    })
                  }
                >
                  <energy.Icon
                    size={24}
                    color={draft.energy === energy.id ? C.gold : C.ink}
                  />
                  <Body
                    style={{
                      fontSize: 14,
                      lineHeight: 19,
                      textAlign: "center",
                    }}
                  >
                    {energy.label}
                  </Body>
                </Pressable>
              ))}
            </View>
          </View>
          <View style={{ gap: 12 }}>
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
            >
              <LightbulbIcon size={22} color={C.gold} />
              <Body style={{ fontFamily: F.strong, fontSize: 16 }}>
                Anything worth noting?
              </Body>
              <Body style={{ color: C.muted, fontSize: 13 }}>Optional</Body>
            </View>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
              {["proud of", "interesting", "made me laugh", "learned"].map(
                (prompt) => (
                  <Pressable
                    key={prompt}
                    accessibilityRole="button"
                    accessibilityLabel={prompt}
                    style={{
                      minHeight: 44,
                      paddingHorizontal: 8,
                      justifyContent: "center",
                      borderRadius: 20,
                      backgroundColor: "#ECE7E0",
                    }}
                    onPress={() =>
                      update({
                        note: draft.note
                          ? `${draft.note}\n${prompt}: `
                          : `${prompt}: `,
                      })
                    }
                  >
                    <Body style={{ fontSize: 13 }}>{prompt}</Body>
                  </Pressable>
                ),
              )}
            </View>
            <Field
              accessibilityLabel="My note"
              placeholder="A moment, a thought, anything."
              multiline
              style={{ minHeight: 72, backgroundColor: C.white }}
              value={draft.note}
              maxLength={2000}
              onChangeText={(note) => update({ note })}
            />
          </View>
          {showObstacle && (
            <View
              style={[
                s.card,
                { backgroundColor: C.soft, gap: 14, borderRadius: 24 },
              ]}
            >
              <Body style={{ fontFamily: F.strong }}>
                {Math.floor(Date.parse(today) / 86400000) % 2
                  ? "No worries if today went sideways. What got in the way?"
                  : "That one didn't happen today. Want to look at what made it tricky?"}
              </Body>
              <View style={s.wrap}>
                {OBSTACLES.map((obstacle) => (
                  <Chip
                    key={obstacle.id}
                    label={obstacle.label}
                    selected={draft.obstacleReason === obstacle.id}
                    onPress={() =>
                      update({
                        obstacleReason: obstacle.id,
                        obstacleChoice: undefined,
                      })
                    }
                  />
                ))}
              </View>
              {plan ? (
                <>
                  <Body>{plan.reply}</Body>
                  {plan.stuck && <Body>{plan.stuckLine}</Body>}
                  {!!plan.text && (
                    <Body style={{ fontFamily: F.strong }}>{plan.text}</Body>
                  )}
                  {draft.obstacleReason === "motivation" && (
                    <View style={s.wrap}>
                      <Chip
                        label="Keep it"
                        selected={draft.obstacleChoice === "keep"}
                        onPress={() => update({ obstacleChoice: "keep" })}
                      />
                      <Chip
                        label="Let it go"
                        selected={draft.obstacleChoice === "release"}
                        onPress={() => update({ obstacleChoice: "release" })}
                      />
                    </View>
                  )}
                </>
              ) : null}
            </View>
          )}
          {!!newInterest && (
            <View style={[s.card, { gap: 10 }]}>
              <Body>{`Want to add ${newInterest} to My map?`}</Body>
              <View style={s.wrap}>
                <Chip
                  label="Yes, add it"
                  selected={draft.addInterest}
                  onPress={() => update({ addInterest: true })}
                />
                <Chip
                  label="Not now"
                  selected={!draft.addInterest}
                  onPress={() => update({ addInterest: false })}
                />
              </View>
            </View>
          )}
          {reviewPriority && intention ? (
            <View style={[s.card, { gap: 12 }]}>
              <Body
                style={{ fontFamily: F.strong }}
              >{`Do you choose ${priorityName(intention.value)} again?`}</Body>
              <View style={s.wrap}>
                {(
                  [
                    { value: "yes", label: "Keep it" },
                    { value: "not_sure", label: "Still deciding" },
                    { value: "not_mine", label: "Let it go" },
                  ] as const
                ).map((item) => (
                  <Chip
                    key={item.value}
                    label={item.label}
                    selected={
                      draft.valueChoice === item.value && !draft.replacing
                    }
                    onPress={() =>
                      update({
                        valueChoice: item.value,
                        replacing: false,
                        replacement: "",
                      })
                    }
                  />
                ))}
              </View>
              <TextButton
                label="Another priority matters more"
                onPress={() =>
                  update({ replacing: true, valueChoice: "not_mine" })
                }
              />
              {draft.replacing && (
                <View style={s.wrap}>
                  {PRIORITY_WORDS.filter(
                    (priority) =>
                      priority.name !== priorityName(intention.value),
                  ).map((priority) => (
                    <Chip
                      key={priority.name}
                      label={priority.name}
                      selected={draft.replacement === priority.name}
                      onPress={() => update({ replacement: priority.name })}
                    />
                  ))}
                </View>
              )}
            </View>
          ) : null}
          <Notice
            text={action.error || draftError || markerError}
            tone="error"
          />
          <Button
            label="Done"
            loading={action.busy}
            disabled={
              !draft.outcome ||
              (reviewPriority && draft.replacing && !draft.replacement)
            }
            onPress={save}
          />
          <TextButton
            label="Skip tonight"
            disabled={action.busy}
            onPress={skip}
          />
        </>
      )}
    </Page>
  );
}

export default withAccount(Reflect);
