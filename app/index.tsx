import React, { useEffect, useRef, useState } from "react";
import { AppState, View, Text, Pressable, TextInput } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Landing } from "../src/landing";
import { usePractice } from "../src/practice";
import { useToday } from "../src/use-today";
import { useRound2 } from "../src/round2-store";
import { useAction } from "../src/use-action";
import { draftKey, useDraft } from "../src/drafts";
import { entryInput, returningToPractice, rhythmDue } from "../src/journey";
import { shiftDay } from "../src/domain";
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
  s,
} from "../src/ui";
import { BrandHeader } from "../src/brand-header";
import { ScrollWheel } from "../src/scroll-wheel";
import { useFocusMission } from "../src/use-focus-mission";
import { FocusCard } from "../src/focus-card";
import { KidsAgesPrompt, shouldAskKidsAges } from "../src/round3-preferences";
import {
  priorityOptions,
  whereOptions,
  similarInterests,
  selectMission,
  rareMomentAllowed,
  missionUnavailableReason,
  MISSIONS,
  LEARNING_SHELF,
  type Level,
} from "../src/round2";
import {
  FIRST_TODAY_OPENER,
  localHour,
  planChoices,
  pendingFromMission,
  type PendingFocus,
} from "../src/today-flow";
import { supabase } from "../src/supabase";

export default function Home() {
  const { session } = usePractice();
  return session ? <Today /> : <Landing />;
}

function ChloeLine({
  children,
  inverse = false,
}: {
  children: React.ReactNode;
  inverse?: boolean;
}) {
  return (
    <View style={{ gap: 5 }}>
      <Body
        style={{
          color: inverse ? "#FED7AA" : C.gold,
          fontFamily: F.strong,
          fontSize: 12,
        }}
      >
        Chloe
      </Body>
      <Body style={inverse ? { color: "#FFFFFF" } : undefined}>{children}</Body>
    </View>
  );
}

function Today() {
  const {
    data,
    session,
    saveIntention,
    putEntry,
    refresh,
    error: practiceError,
  } = usePractice();
  const today = useToday();
  const extra = useRound2();
  const action = useAction();
  const params = useLocalSearchParams<{
    missionId?: string;
    missionText?: string;
    priority?: string;
    interest?: string;
    place?: string;
    somedayId?: string;
    missionLevel?: string;
    missionType?: string;
    missionStep?: string;
    focusText?: string;
    focusSource?: string;
  }>();
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const tick = () => setNow(new Date());
    const timer = setInterval(tick, 60_000);
    const resume = AppState.addEventListener("change", (state) => {
      if (state === "active") tick();
    });
    return () => {
      clearInterval(timer);
      resume.remove();
    };
  }, []);
  const hour = localHour(data.profile.timezone, now);
  const evening = hour >= 17;
  const priorities = priorityOptions(data);
  const base = whereOptions(data, extra.places);
  const similar = similarInterests(data);
  const { draft, update, ready, draftError } = useDraft(
    draftKey("today.round3." + today, session?.user.id),
    {
      text: "",
      plan: "",
      more: false,
      priority: "",
      where: "anywhere",
      editing: false,
      dismissed: false,
      learning: false,
      familyId: "",
      pending: null as PendingFocus | null,
    },
  );
  const [level, setLevel] = useState<Level>("easy");
  const [notice, setNotice] = useState("");
  const [selectionNotice, setSelectionNotice] = useState("");
  const [routeError, setRouteError] = useState("");
  const [showIntro, setShowIntro] = useState(false);
  const introOwner = useRef<string | null>(null);
  const priority = priorities.includes(draft.priority)
    ? draft.priority
    : priorities[0] || "";
  const options = [
    ...base,
    ...(draft.more
      ? similar.map((l) => ({
          id: "new:" + l.similar_interest,
          label: l.similar_interest,
          kind: "interest",
          isNew: true,
        }))
      : []),
  ];
  const requestedWhere =
    options.find((x) => x.id === draft.where) || options[0];
  const selection = selectMission(data, {
    priority,
    where: requestedWhere.label,
    kind: requestedWhere.kind,
    level,
    type: draft.learning ? "learn" : "do",
    day: today,
    now,
    familyId: draft.familyId || undefined,
  });
  const where = selection.whereCleared ? options[0] : requestedWhere;
  const fitNotice = selection.whereCleared
    ? "No step fits " +
      priority +
      " with " +
      requestedWhere.label +
      " right now. Here is an idea for " +
      priority +
      "."
    : selectionNotice;
  const current = data.intentions.find((i) => i.day === today);
  const check = data.checkIns.find((c) => c.intention_id === current?.id);
  const choosing = (!current || draft.editing) && !draft.pending;
  const generated = useFocusMission(
    selection.mission,
    priority,
    level,
    ready &&
      extra.ready &&
      data.profile.onboarded &&
      choosing &&
      where.kind === "anywhere" &&
      !selection.familyId,
    { priority, where: where.label, kind: where.kind },
  );
  const mission = selection.mission || generated.mission;
  const availableLevels = selection.familyId
    ? selection.availableLevels
    : generated.availableLevels;
  const previousSummary = extra.summaries.find(
    (x) => x.day === shiftDay(today, -1),
  );
  const opener =
    !draft.dismissed &&
    !returningToPractice(data, today) &&
    !previousSummary?.hard_day
      ? previousSummary?.opener_line
      : null;
  const due = rhythmDue(data, now);
  const pendingLearning = useRef(false);
  const routeHandled = useRef("");
  const routeLive = useRef(true);
  useEffect(
    () => () => {
      routeLive.current = false;
    },
    [],
  );
  useEffect(() => {
    pendingLearning.current = false;
  }, [today]);

  useEffect(() => {
    if (
      !ready ||
      !data.profile.onboarded ||
      !session?.user.id ||
      introOwner.current === session.user.id
    )
      return;
    introOwner.current = session.user.id;
    const introduction = data.entries.find(
      (e) => e.kind === "preferences" && e.title === "Chloe introduction",
    );
    if (introduction?.meta.intro_shown) return;
    void putEntry(
      entryInput("preferences", "Chloe introduction", {
        id: introduction?.id,
        revision: introduction?.revision,
        meta: { ...introduction?.meta, intro_shown: true },
        source: "First Today introduction",
      }),
    )
      .then(() => setShowIntro(true))
      .catch(() => setShowIntro(true));
  }, [ready, data, session?.user.id, putEntry]);

  useEffect(() => {
    if (
      !ready ||
      !data.profile.onboarded ||
      (!params.missionId && !params.focusText)
    )
      return;
    const key = [
      params.missionId,
      params.missionText,
      params.somedayId,
      params.focusText,
    ].join(":");
    if (routeHandled.current === key) return;
    routeHandled.current = key;
    const load = async () => {
      if (params.focusText) {
        update({
          pending: {
            text: params.focusText.trim().slice(0, 500),
            source: params.focusSource === "suggested" ? "suggested" : "typed",
            missionId: null,
            missionStep: null,
            level: null,
            type: "do",
            priority: params.priority || "",
            interest: params.interest || "",
            place: params.place || "",
            somedayId: null,
          },
          plan: "",
          editing: true,
          dismissed: true,
        });
        setNotice("");
        router.setParams({
          focusText: undefined,
          focusSource: undefined,
          priority: undefined,
          interest: undefined,
          place: undefined,
        });
        return;
      }
      let candidate = MISSIONS.find((m) => m.id === params.missionId);
      if (!candidate) {
        const result = await supabase
          .from("missions")
          .select("*")
          .eq("id", params.missionId!)
          .maybeSingle();
        if (result.error || !result.data)
          throw new Error(
            "That step could not load. Please choose it again from My map.",
          );
        candidate = result.data;
      }
      if (!routeLive.current || !candidate) return;
      const unavailable = missionUnavailableReason(candidate, data, new Date());
      if (unavailable)
        throw new Error(unavailable + " Choose a step that fits now.");
      update({
        pending: pendingFromMission(candidate, {
          text: (params.missionText || candidate.mission_text).slice(0, 500),
          priority: params.priority || "",
          interest: params.interest || "",
          place: params.place || "",
          somedayId: params.somedayId || null,
        }),
        plan: "",
        editing: true,
        dismissed: true,
      });
      setNotice("");
      router.setParams({
        missionId: undefined,
        missionText: undefined,
        priority: undefined,
        interest: undefined,
        place: undefined,
        somedayId: undefined,
        missionLevel: undefined,
        missionType: undefined,
        missionStep: undefined,
      });
    };
    void load().catch((e) => {
      if (routeLive.current) setRouteError((e as Error).message);
    });
  }, [ready, data, params, update]);

  useEffect(() => {
    if (
      !ready ||
      !extra.ready ||
      !choosing ||
      pendingLearning.current ||
      draft.learning ||
      !priority ||
      !data.profile.joined_at
    )
      return;
    const age =
      (Date.parse(today) - Date.parse(data.profile.joined_at)) / 86400000;
    const offset = (session?.user.id.charCodeAt(0) || 0) % 3;
    const learn = selectMission(data, {
      priority,
      where: where.label,
      kind: where.kind,
      type: "learn",
      day: today,
      now,
    });
    if (
      age < 5 + offset ||
      !rareMomentAllowed(
        extra.moments,
        "learning",
        "morning:" + today,
        !!previousSummary?.hard_day,
      ) ||
      !learn.mission
    )
      return;
    pendingLearning.current = true;
    void extra
      .recordMoment("learning", "morning:" + today)
      .then((accepted) => {
        if (accepted) {
          update({ learning: true, familyId: "" });
          setLevel("easy");
        }
      })
      .catch(() => {});
  }, [
    ready,
    extra,
    choosing,
    draft.learning,
    priority,
    data,
    today,
    now,
    where.label,
    where.kind,
    session?.user.id,
    previousSummary?.hard_day,
    update,
  ]);

  if (!ready) return null;
  const reset = (change: Partial<typeof draft>) => {
    const nextWhere =
      options.find((item) => item.id === (change.where || where.id)) ||
      options[0];
    const nextPriority = change.priority || priority;
    const nextSelection = selectMission(data, {
      priority: nextPriority,
      where: nextWhere.label,
      kind: nextWhere.kind,
      now,
      day: today,
      type: (change.learning ?? draft.learning) ? "learn" : "do",
    });
    update({
      ...change,
      where: nextSelection.whereCleared ? "anywhere" : nextWhere.id,
      familyId: "",
    });
    setLevel("easy");
    setNotice("");
    setSelectionNotice(
      nextSelection.whereCleared
        ? "No step fits " +
            nextPriority +
            " with " +
            nextWhere.label +
            " right now. Here is an idea for " +
            nextPriority +
            "."
        : "",
    );
  };
  const pickSuggested = () => {
    if (!mission) return;
    update({
      pending: pendingFromMission(mission, {
        priority,
        place: where.kind === "place" ? where.label : "",
        interest: where.kind === "interest" ? where.label : "",
      }),
      plan: "",
    });
    setNotice("");
  };
  const sendTyped = () => {
    if (!draft.text.trim()) return;
    update({
      pending: {
        text: draft.text.trim(),
        source: "typed",
        missionId: null,
        missionStep: null,
        level: null,
        type: "do",
        priority: "",
        interest: "",
        place: "",
        somedayId: null,
      },
      plan: "",
    });
    setNotice("");
  };
  const savePlannedFocus = (plan: string) =>
    action.run(async () => {
      const focus = draft.pending;
      if (!focus || !plan.trim()) return;
      if (focus.missionId) {
        let candidate =
          MISSIONS.find((item) => item.id === focus.missionId) ||
          focus.missionSnapshot;
        if (!candidate) {
          const response = await supabase
            .from("missions")
            .select("*")
            .eq("id", focus.missionId)
            .maybeSingle();
          if (response.error || !response.data)
            throw new Error(
              "That step could not be checked. Please choose it again.",
            );
          candidate = response.data;
        }
        const unavailable =
          candidate && missionUnavailableReason(candidate, data, new Date());
        if (unavailable) {
          update({ pending: null, editing: true, familyId: "" });
          throw new Error(unavailable + " Choose a step that fits now.");
        }
      }
      await saveIntention(
        focus.text,
        focus.priority,
        focus.place,
        today,
        focus.interest,
        {
          source: focus.source,
          mission_id: focus.missionId,
          mission_step: focus.missionStep,
          level: focus.level,
          type: focus.type,
          place: focus.place,
          when_context: plan.trim(),
          someday_item_id: focus.somedayId,
          for_me: focus.place === "for myself",
          for_whom: focus.place.startsWith("with ") ? focus.place : "",
        },
      );
      update({ pending: null, text: "", plan: "", editing: false });
      setShowIntro(false);
      setNotice(
        "Perfect. That's your focus for today. I'll ask how it went tonight.",
      );
      if (focus.source === "typed") {
        void supabase.functions
          .invoke("chloe", { body: { action: "round2_tag_focus", day: today } })
          .then((r) => {
            if (!r.error && r.data?.tagged) return refresh();
          })
          .catch(() => {});
      }
    });
  const anotherIdea = () =>
    action.run(async () => {
      if (!mission) return;
      await putEntry(
        entryInput("event", "Mission feedback", {
          state: "passed",
          source_ids: [mission.id],
          source: "Another idea on Today",
          meta: {
            mission_id: mission.id,
            priority,
            theme: selection.theme,
            outcome: "passed",
          },
        }),
      );
      reset({ familyId: "" });
    });
  const pendingContext = draft.pending
    ? draft.pending.text + " " + draft.pending.place
    : "";
  const needsKids = !!draft.pending && shouldAskKidsAges(data, pendingContext);
  const dayName = new Date(today + "T12:00:00").toLocaleDateString("en-US", {
    weekday: "long",
  });
  const book =
    mission?.type === "learn"
      ? LEARNING_SHELF.find(
          (b) =>
            b.priorities.includes(priority) ||
            b.interests.includes(where.label),
        )
      : null;
  const nightButton = evening ? (
    <Button
      label="Check in with Chloe"
      onPress={() => router.push("/reflect")}
    />
  ) : (
    <TextButton
      label={check ? "Revisit tonight’s reflection" : "Check in with Chloe"}
      onPress={() => router.push("/reflect")}
    />
  );

  return (
    <Page
      header={
        <BrandHeader
          right={
            <Body
              style={{
                fontSize: 12,
                color: C.muted,
                backgroundColor: "#F1ECE6",
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 20,
              }}
            >
              {dayName} {evening ? "evening" : "morning"}
            </Body>
          }
        />
      }
      contentStyle={{ gap: 16, paddingTop: 8 }}
    >
      {!data.profile.onboarded ? (
        <>
          <Title>Let’s find who you want to be.</Title>
          <Body>
            Start with what matters to you, the things you love and the people
            you show up for.
          </Body>
          <Button
            label="Start your map"
            onPress={() => router.push("/onboarding")}
          />
        </>
      ) : (
        <>
          <Title>
            Who will you be <Text style={{ color: C.gold }}>today</Text>, and
            for whom?
          </Title>
          {showIntro && !current && !draft.pending && (
            <View
              style={{ backgroundColor: C.soft, padding: 14, borderRadius: 14 }}
            >
              <ChloeLine>{FIRST_TODAY_OPENER}</ChloeLine>
            </View>
          )}
          {current && !draft.editing && !draft.pending && (
            <>
              <View
                style={{
                  backgroundColor: C.soft,
                  padding: 18,
                  borderRadius: 16,
                  gap: 8,
                }}
              >
                <Body style={{ fontFamily: F.strong }}>
                  Your focus for today
                </Body>
                <Body style={{ fontSize: 20, lineHeight: 28 }}>
                  {current.action}
                </Body>
                {!!current.when_context && (
                  <Body style={{ color: C.muted }}>{current.when_context}</Body>
                )}
                <TextButton
                  label="Change focus"
                  color={C.gold}
                  onPress={() => {
                    reset({ editing: true, pending: null });
                    setNotice("");
                  }}
                />
              </View>
              {nightButton}
            </>
          )}
          {evening &&
            (!current || draft.editing || draft.pending) &&
            nightButton}
          {!!notice && (
            <View
              style={{ backgroundColor: C.navy, padding: 16, borderRadius: 14 }}
            >
              <ChloeLine inverse>{notice}</ChloeLine>
            </View>
          )}
          {draft.pending && (
            <View
              style={{
                backgroundColor: C.soft,
                padding: 18,
                borderRadius: 16,
                gap: 14,
              }}
            >
              <Body style={{ fontFamily: F.strong }}>{draft.pending.text}</Body>
              {needsKids ? (
                <KidsAgesPrompt context={pendingContext} />
              ) : (
                <>
                  <ChloeLine>When will you do it?</ChloeLine>
                  <View style={s.wrap}>
                    {planChoices(hour).map((plan) => (
                      <Chip
                        key={plan}
                        label={plan}
                        disabled={action.busy}
                        onPress={() => void savePlannedFocus(plan)}
                      />
                    ))}
                  </View>
                  <Field
                    label="My own time"
                    placeholder="when I get home"
                    value={draft.plan}
                    onChangeText={(plan) => update({ plan })}
                    maxLength={500}
                    onSubmitEditing={() => {
                      if (draft.plan.trim()) void savePlannedFocus(draft.plan);
                    }}
                  />
                  {!!draft.plan.trim() && (
                    <Button
                      label="Save my focus"
                      loading={action.busy}
                      onPress={() => void savePlannedFocus(draft.plan)}
                    />
                  )}
                </>
              )}
              <TextButton
                label="Choose something else"
                onPress={() =>
                  update({ pending: null, plan: "", editing: true })
                }
              />
            </View>
          )}
          {choosing && (
            <>
              {opener && (
                <View
                  style={{
                    backgroundColor: C.soft,
                    padding: 14,
                    borderRadius: 14,
                    gap: 6,
                  }}
                >
                  <ChloeLine>{opener.text}</ChloeLine>
                  <View style={s.wrap}>
                    {opener.kind === "stretch" ? (
                      <>
                        <TextButton
                          label="Try the stretch"
                          onPress={() => {
                            setLevel("stretch");
                            update({
                              familyId: selection.familyId || "",
                              dismissed: true,
                            });
                          }}
                        />
                        <TextButton
                          label="Keep it easy"
                          onPress={() => {
                            setLevel("easy");
                            update({ dismissed: true });
                          }}
                        />
                      </>
                    ) : (
                      <TextButton
                        label="Today"
                        onPress={() =>
                          update({
                            text: opener.focus_text || "",
                            pending: {
                              text: opener.focus_text || "",
                              source: "typed",
                              missionId: null,
                              missionStep: null,
                              level: null,
                              type: "do",
                              priority: "",
                              interest: "",
                              place: "",
                              somedayId: null,
                            },
                            dismissed: true,
                          })
                        }
                      />
                    )}
                    {opener.kind === "meaning_to" && (
                      <TextButton
                        label="Let it go"
                        onPress={() =>
                          action.run(async () => {
                            const item = data.entries.find(
                              (e) => e.id === opener.item_id,
                            );
                            if (item)
                              await putEntry({ ...item, state: "released" });
                            update({ dismissed: true });
                          })
                        }
                      />
                    )}
                    <TextButton
                      label="Not today"
                      onPress={() => update({ dismissed: true })}
                    />
                  </View>
                </View>
              )}
              <View
                style={{
                  backgroundColor: C.white,
                  borderWidth: 1.5,
                  borderColor: C.navy,
                  borderRadius: 14,
                  padding: 8,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <Body style={{ fontFamily: F.strong, paddingLeft: 8 }}>
                  I will
                </Body>
                <TextInput
                  accessibilityLabel="My focus"
                  placeholder="do my hardest task first when I get to work"
                  placeholderTextColor={C.muted}
                  value={draft.text}
                  onChangeText={(text) => update({ text })}
                  maxLength={500}
                  multiline
                  style={{
                    flex: 1,
                    minWidth: 0,
                    fontFamily: F.sans,
                    fontSize: 16,
                    color: C.navy,
                    minHeight: 56,
                    paddingVertical: 8,
                  }}
                  onSubmitEditing={sendTyped}
                />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Send my focus"
                  disabled={!draft.text.trim()}
                  onPress={sendTyped}
                  style={{
                    backgroundColor: C.gold,
                    borderRadius: 10,
                    width: 44,
                    height: 44,
                    justifyContent: "center",
                    alignItems: "center",
                    opacity: draft.text.trim() ? 1 : 0.5,
                  }}
                >
                  <Body style={{ color: "#FFFFFF", fontSize: 22 }}>↑</Body>
                </Pressable>
              </View>
              <View style={[s.row, { gap: 10 }]}>
                <View style={{ flex: 1, height: 1, backgroundColor: C.line }} />
                <Body style={{ fontSize: 13, color: C.muted }}>
                  Not sure? Scroll for ideas
                </Body>
                <View style={{ flex: 1, height: 1, backgroundColor: C.line }} />
              </View>
              {priorities.length ? (
                <>
                  <ScrollWheel
                    label="Priority"
                    priority
                    items={priorities.map((p) => ({ id: p, label: p }))}
                    value={priority}
                    onChange={(p) => {
                      if (p !== priority)
                        reset({ priority: p, learning: false });
                    }}
                  />
                  <ScrollWheel
                    label="Where and how"
                    items={options}
                    value={where.id}
                    onChange={(id) => {
                      if (id !== where.id) reset({ where: id });
                    }}
                  />
                  {draft.more ? (
                    <Body
                      style={{
                        textAlign: "center",
                        fontSize: 13,
                        color: C.muted,
                      }}
                    >
                      Added interests similar to yours
                    </Body>
                  ) : (
                    <TextButton
                      label="+ More interests"
                      color={C.gold}
                      onPress={() =>
                        similar.length
                          ? update({ more: true })
                          : setSelectionNotice(
                              "Add an interest in My map to find something similar.",
                            )
                      }
                    />
                  )}
                  {!!fitNotice && <Notice text={fitNotice} />}
                  <FocusCard
                    mission={mission}
                    level={level}
                    availableLevels={availableLevels}
                    unavailableReasons={
                      selection.familyId
                        ? selection.unavailableReasons
                        : generated.unavailableReasons
                    }
                    onLevel={(next) => {
                      setLevel(next);
                      update({ familyId: selection.familyId || "" });
                    }}
                    onAccept={pickSuggested}
                    loading={action.busy}
                  />
                  {!!mission && (
                    <TextButton label="Another idea" onPress={anotherIdea} />
                  )}
                  {where.id.startsWith("new:") && (
                    <Body style={{ fontSize: 13, color: C.muted }}>
                      Similar to{" "}
                      {
                        similar.find((l) => l.similar_interest === where.label)
                          ?.interest
                      }
                      :{" "}
                      {
                        similar.find((l) => l.similar_interest === where.label)
                          ?.reason
                      }
                    </Body>
                  )}
                  {book && (
                    <Body style={{ fontSize: 14 }}>
                      {book.title} — {book.author}. {book.why_it_fits}
                    </Body>
                  )}
                </>
              ) : (
                <Button
                  secondary
                  label="Choose my priorities"
                  onPress={() => router.push("/onboarding")}
                />
              )}
              {generated.error && (
                <>
                  <Notice text={generated.error} />
                  <TextButton label="Retry ideas" onPress={generated.retry} />
                </>
              )}
            </>
          )}
          {!evening &&
            (!current || draft.editing) &&
            !draft.pending &&
            nightButton}
          {due && (
            <TextButton
              label={
                due.kind === "monthly" ? "Monthly check-in" : "Sunday review"
              }
              onPress={() =>
                router.push({
                  pathname: "/rhythms",
                  params: {
                    mode: due.kind === "monthly" ? "monthly" : "sunday",
                  },
                })
              }
            />
          )}
        </>
      )}
      <Notice
        text={
          action.error ||
          routeError ||
          draftError ||
          extra.error ||
          practiceError
        }
        tone="error"
      />
    </Page>
  );
}
