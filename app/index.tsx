import React, { useEffect, useRef, useState } from "react";
import { View, Text, TextInput, Pressable } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Landing } from "../src/landing";
import { usePractice } from "../src/practice";
import { useToday, useLocalNow } from "../src/use-today";
import { useRound2 } from "../src/round2-store";
import { useAction } from "../src/use-action";
import { draftKey, useDraft } from "../src/drafts";
import { entryInput, rhythmDue } from "../src/journey";
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
import { KidsAgesPrompt, shouldAskKidsAges } from "../src/round3-preferences";
import {
  MISSIONS,
  LEVELS,
  selectMission,
  missionFamilyId,
  missionUnavailableReason,
  rareMomentAllowed,
} from "../src/round2";
import {
  localHour,
  planChoices,
  pendingFromMission,
  type PendingFocus,
} from "../src/today-flow";
import {
  focusSentence,
  pendingFromEntry,
  todayIdeas,
  tomorrowPrefill,
  type TodayIdea,
} from "../src/round4-flow";
import { useFocusMission } from "../src/use-focus-mission";
import { contextForMission, distinctEasyMission } from "../src/focus-variants";
import {
  useSavedMissionFamily,
  requestAlternativeMissionFamily,
} from "../src/private-missions";
import { missionLocalMoment } from "../src/mission-selection";
import { supabase } from "../src/supabase";
import { FirstTodayIntro } from "../src/first-today-intro";
import { onboardingSchedule } from "../src/onboarding-followups";
import { missionFeedbackEntry } from "../src/mission-feedback";

export default function Home() {
  const { session } = usePractice();
  return session ? <Today /> : <Landing />;
}

function IdeaCard({
  idea,
  onPick,
  onRelease,
}: {
  idea: TodayIdea;
  onPick: (idea: TodayIdea) => void;
  onRelease: (idea: TodayIdea) => void;
}) {
  const { data, session, putEntry } = usePractice();
  const day = useToday();
  const generatedSeen = useRef("");
  const generated = useFocusMission(
    undefined,
    idea.suggestedInterest || "",
    "easy",
    !!idea.suggestedInterest,
    { where: idea.suggestedInterest, kind: "interest" },
  );
  useEffect(() => {
    if (!idea.suggestedInterest || !generated.mission || !session?.user.id)
      return;
    const observation = missionFeedbackEntry(
      generated.mission,
      "shown",
      day,
      "today",
      session.user.id,
    );
    if (
      generatedSeen.current === observation.id ||
      data.entries.some((entry) => entry.id === observation.id)
    )
      return;
    generatedSeen.current = observation.id!;
    void putEntry(observation).catch(() => {
      generatedSeen.current = "";
    });
  }, [
    idea.suggestedInterest,
    generated.mission,
    session?.user.id,
    day,
    data.entries,
    putEntry,
  ]);
  const resolved =
    idea.suggestedInterest && generated.mission
      ? {
          ...idea,
          text: generated.mission.mission_text,
          minutes: generated.mission.minutes,
          pending: pendingFromMission(generated.mission, {
            interest: idea.suggestedInterest,
          }),
        }
      : idea;
  const loading = !!idea.suggestedInterest && !generated.mission;
  return (
    <View
      style={[
        s.card,
        {
          padding: 18,
          borderRadius: 22,
          gap: 6,
          backgroundColor: idea.kind === "reminder" ? C.soft : C.white,
        },
      ]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Use idea: ${resolved.text}`}
        accessibilityState={{ disabled: loading }}
        disabled={loading}
        onPress={() => onPick(resolved)}
        style={{ gap: 8, minHeight: 72 }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
          <View
            style={{
              width: 7,
              height: 7,
              borderRadius: 4,
              backgroundColor: idea.kind === "interest" ? C.ink : C.gold,
            }}
          />
          <Body
            style={{ color: C.muted, fontSize: 13, lineHeight: 19, flex: 1 }}
          >
            {idea.label} · {idea.stage}
          </Body>
        </View>
        <Body style={{ fontFamily: F.strong, fontSize: 17, lineHeight: 25 }}>
          {resolved.text}
        </Body>
        <Body style={{ color: C.muted, fontSize: 13 }}>
          {resolved.minutes
            ? `${resolved.minutes} min`
            : loading
              ? "Chloe is finding a first step…"
              : "At your own pace"}
        </Body>
      </Pressable>
      {loading && generated.error ? (
        <>
          <Notice text={generated.error} />
          <TextButton label="Retry this idea" onPress={generated.retry} />
        </>
      ) : null}
      {(idea.kind === "reminder" || idea.kind === "meaning_to") &&
      idea.entryId ? (
        <TextButton label="Let it go" onPress={() => onRelease(idea)} />
      ) : null}
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
  const now = useLocalNow();
  const extra = useRound2();
  const action = useAction();
  const params = useLocalSearchParams<{
    missionId?: string;
    missionText?: string;
    priority?: string;
    interest?: string;
    place?: string;
    somedayId?: string;
    focusText?: string;
    focusSource?: string;
  }>();
  const { draft, update, ready, draftError } = useDraft(
    draftKey(`today.round4.${today}`, session?.user.id),
    {
      text: "",
      plan: "",
      visible: 3,
      editing: false,
      selected: null as PendingFocus | null,
      pending: null as PendingFocus | null,
      sourceEntryId: "",
      prefilledId: "",
      learning: false,
    },
  );
  const [notice, setNotice] = useState("");
  const [routeError, setRouteError] = useState("");
  const handled = useRef("");
  const owner = useRef(session?.user.id);
  useEffect(() => {
    owner.current = session?.user.id;
  }, [session?.user.id]);
  const hour = localHour(data.profile.timezone, now);
  const evening = hour >= 17;
  const current = data.intentions.find((i) => i.day === today);
  const savedFamily = useSavedMissionFamily(current?.mission_id);
  const check = data.checkIns.find((c) => c.intention_id === current?.id);
  const choosing = (!current || draft.editing) && !draft.pending;
  const previous = extra.summaries.find(
    (summary) => summary.day === shiftDay(today, -1),
  );
  const [ideaSnapshot, setIdeaSnapshot] = useState<{
    key: string;
    items: TodayIdea[];
  }>({ key: "", items: [] });
  const ideaKey = JSON.stringify([
    session?.user.id,
    today,
    draft.learning,
    extra.ready,
    extra.places.map((place) => [place.id, place.label]),
    data.entries
      .filter(
        (entry) =>
          ["value", "interest", "backlog"].includes(entry.kind) ||
          ["Action reminder", "Tomorrow focus", "Kids ages"].includes(
            entry.title,
          ),
      )
      .map((entry) => [entry.id, entry.updated_at, entry.state]),
    data.checkIns.map((check) => [
      check.intention_id,
      check.revision,
      check.energy,
    ]),
  ]);
  if (ready && extra.ready && ideaSnapshot.key !== ideaKey) {
    // Impressions are saved immediately but must not replace a card while it
    // is being read. A changed day or map produces the next eligible snapshot.
    setIdeaSnapshot({
      key: ideaKey,
      items: todayIdeas(
        data,
        extra.places,
        today,
        now,
        previous,
        draft.learning,
      ),
    });
  }
  const ideas = ideaSnapshot.items;
  const observed = useRef(new Set<string>());
  useEffect(() => {
    if (!choosing || !ready || !session?.user.id) return;
    const ownerId = session.user.id;
    for (const idea of ideas.slice(0, draft.visible)) {
      const mission =
        MISSIONS.find((item) => item.id === idea.pending.missionId) ||
        idea.pending.missionSnapshot;
      if (!mission) continue;
      const observation = missionFeedbackEntry(
        mission,
        "shown",
        today,
        "today",
        ownerId,
      );
      if (
        observed.current.has(observation.id!) ||
        data.entries.some((entry) => entry.id === observation.id)
      )
        continue;
      observed.current.add(observation.id!);
      void putEntry(observation).catch(() =>
        observed.current.delete(observation.id!),
      );
    }
  }, [
    choosing,
    ready,
    session?.user.id,
    ideas,
    draft.visible,
    today,
    data.entries,
    putEntry,
  ]);
  const prefill = tomorrowPrefill(data, today);
  const due = rhythmDue(data, now);

  useEffect(() => {
    if (
      ready &&
      prefill &&
      !current &&
      !draft.text &&
      !draft.pending &&
      draft.prefilledId !== prefill.id
    ) {
      update({
        text: prefill.body,
        selected: pendingFromEntry(prefill),
        sourceEntryId: prefill.id,
        prefilledId: prefill.id,
      });
    }
  }, [
    ready,
    prefill,
    current,
    draft.text,
    draft.pending,
    draft.prefilledId,
    update,
  ]);

  const learningAttempt = useRef("");
  useEffect(() => {
    if (
      !ready ||
      !extra.ready ||
      !choosing ||
      draft.learning ||
      learningAttempt.current === today ||
      !data.profile.joined_at
    )
      return;
    const age =
      (Date.parse(today) - Date.parse(data.profile.joined_at)) / 86400000;
    if (
      age < 6 ||
      !rareMomentAllowed(
        extra.moments,
        "learning",
        `morning:${today}`,
        !!previous?.hard_day,
      )
    )
      return;
    learningAttempt.current = today;
    void extra
      .recordMoment("learning", `morning:${today}`)
      .then((accepted) => {
        if (accepted) update({ learning: true });
      })
      .catch(() => {});
  }, [
    ready,
    extra,
    choosing,
    draft.learning,
    today,
    data.profile.joined_at,
    previous?.hard_day,
    update,
  ]);

  useEffect(() => {
    if (
      !ready ||
      !data.profile.onboarded ||
      (!params.missionId && !params.focusText)
    )
      return;
    const key = JSON.stringify(params);
    if (handled.current === key) return;
    handled.current = key;
    const requestOwner = session?.user.id;
    const load = async () => {
      let pending: PendingFocus;
      if (params.missionId) {
        let mission = MISSIONS.find((item) => item.id === params.missionId);
        if (!mission) {
          const response = await supabase
            .from("missions")
            .select("*")
            .eq("id", params.missionId)
            .maybeSingle();
          if (response.error || !response.data)
            throw new Error(
              "That step could not load. Please choose it again from My map.",
            );
          mission = response.data;
        }
        if (!mission) return;
        const reason = missionUnavailableReason(mission, data, new Date());
        if (reason) throw new Error(reason + " Choose a step that fits now.");
        pending = pendingFromMission(mission, {
          text: (params.missionText || mission.mission_text).slice(0, 500),
          priority: params.priority || "",
          interest: params.interest || "",
          place: params.place || "",
          somedayId: params.somedayId || null,
        });
      } else {
        pending = {
          text: (params.focusText || "").trim().slice(0, 500),
          source: params.focusSource === "suggested" ? "suggested" : "typed",
          priority: params.priority || "",
          interest: params.interest || "",
          place: params.place || "",
          missionId: null,
          missionStep: null,
          level: null,
          type: "do",
          somedayId: null,
        };
      }
      if (owner.current !== requestOwner) return;
      update({ pending, plan: "", editing: true, sourceEntryId: "" });
      setRouteError("");
      setNotice("");
      router.setParams({
        missionId: undefined,
        missionText: undefined,
        priority: undefined,
        interest: undefined,
        place: undefined,
        somedayId: undefined,
        focusText: undefined,
        focusSource: undefined,
      });
    };
    void load().catch((error) => {
      if (owner.current === requestOwner)
        setRouteError((error as Error).message);
    });
  }, [ready, data, params, session?.user.id, update]);

  const pick = (idea: TodayIdea) => {
    const mission =
      MISSIONS.find((item) => item.id === idea.pending.missionId) ||
      idea.pending.missionSnapshot;
    if (mission && session?.user.id) {
      const observation = missionFeedbackEntry(
        mission,
        "picked",
        today,
        "today",
        session.user.id,
      );
      if (!data.entries.some((entry) => entry.id === observation.id))
        void putEntry(observation).catch(() => {});
    }
    const text =
      idea.pending.source === "suggested"
        ? idea.text
            .replace(/^I will\s+/i, "")
            .replace(/^[A-Z](?!\b)/, (letter) => letter.toLowerCase())
        : idea.text;
    update({
      text,
      selected: { ...idea.pending, text },
      sourceEntryId: idea.entryId || "",
    });
    setNotice("");
  };
  const release = (idea: TodayIdea) =>
    action.run(async () => {
      const entry = data.entries.find((e) => e.id === idea.entryId);
      if (entry)
        await putEntry({
          ...entry,
          state: "released",
          meta: { ...entry.meta, status: "released" },
        });
      const mission =
        MISSIONS.find((item) => item.id === idea.pending.missionId) ||
        idea.pending.missionSnapshot;
      if (mission && session?.user.id)
        await putEntry(
          missionFeedbackEntry(
            mission,
            "passed",
            today,
            "today",
            session.user.id,
          ),
        );
    });
  const setFocus = () => {
    if (!draft.text.trim()) return;
    update({
      pending: draft.selected
        ? { ...draft.selected, text: draft.text.trim() }
        : {
            text: draft.text.trim(),
            source: "typed",
            priority: "",
            interest: "",
            place: "",
            missionId: null,
            missionStep: null,
            level: null,
            type: "do",
            somedayId: null,
          },
      plan: "",
    });
    setNotice("");
  };
  const savePlannedFocus = (plan: string) =>
    action.run(async () => {
      const pending = draft.pending;
      if (!pending || !plan.trim()) return;
      if (pending.missionId) {
        let candidate =
          MISSIONS.find((mission) => mission.id === pending.missionId) ||
          pending.missionSnapshot;
        if (!candidate) {
          const response = await supabase
            .from("missions")
            .select("*")
            .eq("id", pending.missionId)
            .maybeSingle();
          if (response.error || !response.data)
            throw new Error(
              "That step could not be checked. Please choose it again.",
            );
          candidate = response.data;
        }
        const reason =
          candidate && missionUnavailableReason(candidate, data, new Date());
        if (reason) throw new Error(reason + " Choose a step that fits now.");
      }
      await saveIntention(
        pending.text,
        pending.priority,
        pending.place,
        today,
        pending.interest,
        {
          source: pending.source,
          mission_id: pending.missionId,
          mission_step: pending.missionStep,
          level: pending.level,
          type: pending.type,
          place: pending.place,
          when_context: plan.trim(),
          someday_item_id: pending.somedayId,
          for_me: pending.place === "for myself",
          for_whom: pending.place.startsWith("with ") ? pending.place : "",
        },
      );
      const entry = data.entries.find(
        (item) => item.id === draft.sourceEntryId,
      );
      if (entry)
        await putEntry({
          ...entry,
          meta: { ...entry.meta, status: "used", commitment_day: today },
        });
      update({
        pending: null,
        text: "",
        selected: null,
        plan: "",
        editing: false,
        sourceEntryId: "",
      });
      setNotice(
        !data.intentions.length && onboardingSchedule(data)
          ? "Tonight I'll ask how it went, and each time I'll know you a bit better."
          : "",
      );
      if (pending.source === "typed")
        void supabase.functions
          .invoke("chloe", { body: { action: "round2_tag_focus", day: today } })
          .then((reply) => {
            if (!reply.error && reply.data?.tagged) return refresh();
          })
          .catch(() => {});
    });

  const currentMission = savedFamily.mission;
  const currentMissionContext =
    currentMission && current
      ? contextForMission(currentMission, {
          priority: current.value,
          interest: current.interest || "",
          place: current.place || "",
        })
      : {
          priority: current?.value || "",
          interest: current?.interest || "",
          place: current?.place || "",
        };
  const currentFamily =
    currentMission && current
      ? selectMission(data, {
          ...currentMissionContext,
          where: "anywhere",
          kind: "anywhere",
          familyId: missionFamilyId(currentMission),
          day: today,
          now,
          type: current.type || "do",
          pool: savedFamily.rows,
        })
      : null;
  const nextLevel = LEVELS.find(
    (level) =>
      LEVELS.indexOf(level) > LEVELS.indexOf(current?.level || "easy") &&
      currentFamily?.availableLevels.includes(level),
  );
  const harder = () =>
    action.run(async () => {
      const mission = nextLevel && currentFamily?.variants[nextLevel];
      if (!current || !mission || check) return;
      const context = contextForMission(mission, currentMissionContext);
      await saveIntention(
        mission.mission_text,
        context.priority,
        context.place,
        today,
        context.interest,
        {
          revision: current.revision,
          mission_id: mission.id,
          mission_step: mission.ladder_step,
          level: nextLevel,
          type: mission.type as "do" | "learn",
          source: "suggested",
          place: context.place,
          for_whom: context.place.startsWith("with ") ? context.place : "",
          for_me: context.place === "for myself",
          when_context: current.when_context,
          someday_item_id: current.someday_item_id,
        },
      );
      setNotice("");
    });
  const another = () =>
    action.run(async () => {
      if (!current || check) return;
      const requestOwner = session?.user.id;
      if (!requestOwner) return;
      const privateFocus =
        !!current.mission_id &&
        !MISSIONS.some((mission) => mission.id === current.mission_id);
      if (privateFocus && !currentMission)
        throw new Error(
          savedFamily.error ||
            "Your saved idea is still loading. Try again in a moment.",
        );
      const familyId = currentMission
        ? missionFamilyId(currentMission)
        : current.mission_id
          ? missionFamilyId(current.mission_id)
          : undefined;
      let candidates = [] as typeof MISSIONS;
      if (privateFocus && currentMission) {
        const interest = currentMissionContext.interest;
        const place = currentMissionContext.place;
        candidates = await requestAlternativeMissionFamily({
          ownerId: requestOwner,
          tag:
            interest || currentMission.ladder || currentMissionContext.priority,
          priority: currentMissionContext.priority,
          where: interest || place || "anywhere",
          kind: interest ? "interest" : place ? "place" : "anywhere",
          step: currentMission.ladder_step,
          excludedMissionIds: [
            ...savedFamily.rows.map((mission) => mission.id),
            ...data.entries
              .filter(
                (entry) =>
                  entry.kind === "event" &&
                  entry.meta.outcome === "passed" &&
                  Number.isFinite(Date.parse(entry.created_at)) &&
                  missionLocalMoment(data, new Date(entry.created_at)).day ===
                    today,
              )
              .flatMap((entry) => [
                ...entry.source_ids,
                ...(entry.meta.mission_id ? [entry.meta.mission_id] : []),
              ]),
          ],
        });
      } else {
        const baseOptions = {
          priority: currentMissionContext.priority,
          level: "easy" as const,
          type: current.type || "do",
          day: today,
          now: new Date(),
          excludedFamilyIds: familyId ? [familyId] : [],
        };
        const exact = selectMission(data, {
          ...baseOptions,
          interest: currentMissionContext.interest,
          place: currentMissionContext.place,
          where: "anywhere",
          kind: "anywhere",
        });
        const relaxed = exact.mission
          ? exact
          : selectMission(data, {
              ...baseOptions,
              where:
                currentMissionContext.interest ||
                currentMissionContext.place ||
                "anywhere",
              kind: currentMissionContext.interest
                ? "interest"
                : currentMissionContext.place
                  ? "place"
                  : "anywhere",
            });
        candidates = [
          ...(relaxed.mission ? [relaxed.mission] : []),
          ...ideas.flatMap((idea) =>
            idea.pending.missionSnapshot ? [idea.pending.missionSnapshot] : [],
          ),
        ];
      }
      if (owner.current !== requestOwner) return;
      const mission = distinctEasyMission(
        candidates,
        currentMission,
        current.mission_id,
        data,
        new Date(),
      );
      if (!mission) {
        if (privateFocus)
          throw new Error(
            "A different easy idea could not load. Please try again, or choose your own focus.",
          );
        update({
          editing: true,
          text: "",
          selected: null,
          pending: null,
          plan: "",
          sourceEntryId: "",
        });
        return;
      }
      if (current.mission_id)
        await putEntry(
          entryInput("event", "Mission feedback", {
            state: "passed",
            source: "Another idea on Today",
            source_ids: [current.mission_id],
            meta: {
              mission_id: current.mission_id,
              priority: current.value,
              outcome: "passed",
            },
          }),
        );
      if (owner.current !== requestOwner) return;
      update({
        pending: pendingFromMission(
          mission,
          contextForMission(mission, currentMissionContext),
        ),
        plan: "",
        editing: true,
        sourceEntryId: "",
      });
      setNotice("");
    });
  const context = `${draft.pending?.text || ""} ${draft.pending?.place || ""}`;
  if (!ready) return null;
  return (
    <Page
      header={<BrandHeader />}
      contentStyle={{ gap: 20, paddingTop: 8, paddingBottom: 32 }}
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
          <FirstTodayIntro />
          {(evening || !current || draft.editing || draft.pending) && (
            <Title style={{ fontSize: 32, lineHeight: 38 }}>
              {evening ? (
                <>
                  How did <Text style={{ color: C.gold }}>today</Text> go?
                </>
              ) : (
                <>
                  Who will you be <Text style={{ color: C.gold }}>today</Text>,
                  and for whom?
                </>
              )}
            </Title>
          )}
          {current && !draft.editing && !draft.pending ? (
            <>
              <View
                testID="today-focus-card"
                style={[
                  s.card,
                  {
                    backgroundColor: evening ? C.white : C.gold,
                    borderColor: evening ? C.line : C.gold,
                    borderRadius: 24,
                    padding: 24,
                    gap: 14,
                  },
                ]}
              >
                <Body
                  style={{ fontSize: 13, color: evening ? C.muted : "#FDEEE4" }}
                >
                  Your focus for today
                </Body>
                {!!current.value && (
                  <Body
                    style={{
                      fontFamily: F.bold,
                      fontSize: 28,
                      lineHeight: 34,
                      color: evening ? C.gold : C.white,
                    }}
                  >{`iwillbe.${current.value}`}</Body>
                )}
                <Body
                  style={{
                    fontFamily: F.strong,
                    fontSize: 20,
                    lineHeight: 29,
                    color: evening ? C.ink : C.white,
                  }}
                >
                  {focusSentence(current)}
                </Body>
                <View style={s.wrap}>
                  {[current.when_context, current.place || current.for_whom]
                    .filter(Boolean)
                    .map((tag) => (
                      <View
                        key={tag}
                        style={{
                          paddingHorizontal: 12,
                          paddingVertical: 6,
                          borderRadius: 20,
                          backgroundColor: evening ? C.paper : "#FFFFFF24",
                        }}
                      >
                        <Body
                          style={{
                            color: evening ? C.muted : C.white,
                            fontSize: 13,
                          }}
                        >
                          {tag}
                        </Body>
                      </View>
                    ))}
                </View>
              </View>
              {evening ? (
                <Button
                  label="Close the day with Chloe"
                  onPress={() => router.push("/reflect")}
                />
              ) : (
                <>
                  {!check && (
                    <View style={{ flexDirection: "row", gap: 10 }}>
                      <View style={{ flex: 1 }}>
                        <Button
                          secondary
                          label="Harder"
                          disabled={!nextLevel || action.busy}
                          onPress={harder}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Button
                          secondary
                          label="↻ Another idea"
                          disabled={action.busy || savedFamily.loading}
                          onPress={another}
                        />
                      </View>
                    </View>
                  )}
                  <Body
                    style={{
                      textAlign: "center",
                      color: C.muted,
                      fontSize: 13,
                    }}
                  >
                    Chloe checks in tonight. That&apos;s all for now.
                  </Body>
                </>
              )}
              <TextButton
                label="Change focus"
                onPress={() => {
                  update({ editing: true, text: "", selected: null });
                  setNotice("");
                }}
              />
              {!!savedFamily.error && (
                <TextButton
                  label="Retry saved idea"
                  onPress={savedFamily.retry}
                />
              )}
            </>
          ) : null}
          {draft.pending ? (
            <View
              style={[
                s.card,
                { backgroundColor: C.soft, borderRadius: 24, gap: 16 },
              ]}
            >
              <Body style={{ fontFamily: F.strong }}>{draft.pending.text}</Body>
              {shouldAskKidsAges(data, context) ? (
                <KidsAgesPrompt context={context} />
              ) : (
                <>
                  <Body style={{ fontFamily: F.strong }}>
                    When will you do it?
                  </Body>
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
          ) : null}
          {choosing ? (
            <>
              <View
                style={[s.card, { borderRadius: 24, padding: 18, gap: 12 }]}
              >
                <Body
                  style={{
                    color: C.gold,
                    fontFamily: F.bold,
                    fontSize: 28,
                    lineHeight: 36,
                  }}
                >
                  I will
                </Body>
                <TextInput
                  accessibilityLabel="My focus"
                  placeholder="(your words)"
                  placeholderTextColor={C.muted}
                  autoCapitalize="none"
                  autoCorrect={false}
                  value={draft.text}
                  onChangeText={(text) =>
                    update({ text, selected: null, sourceEntryId: "" })
                  }
                  maxLength={500}
                  returnKeyType="done"
                  onSubmitEditing={setFocus}
                  style={{
                    color: C.ink,
                    fontFamily: F.sans,
                    fontSize: 18,
                    minHeight: 44,
                    width: "100%",
                    paddingVertical: 8,
                    borderBottomWidth: 1,
                    borderColor: C.line,
                  }}
                />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Set my focus"
                  accessibilityState={{ disabled: !draft.text.trim() }}
                  disabled={!draft.text.trim()}
                  onPress={setFocus}
                  style={{
                    minHeight: 48,
                    borderRadius: 30,
                    backgroundColor: draft.text.trim() ? C.gold : "#E6E0D8",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Body
                    style={{
                      fontFamily: F.strong,
                      color: draft.text.trim() ? C.white : C.muted,
                    }}
                  >
                    Set my focus
                  </Body>
                </Pressable>
                <Body
                  style={{ color: C.muted, textAlign: "center", fontSize: 13 }}
                >
                  Or tap an idea below
                </Body>
              </View>
              <Body style={{ fontFamily: F.bold, fontSize: 18 }}>
                Ideas from My map
              </Body>
              {ideas.slice(0, draft.visible).map((idea) => (
                <IdeaCard
                  key={idea.id}
                  idea={idea}
                  onPick={pick}
                  onRelease={release}
                />
              ))}
              {draft.visible < ideas.length ? (
                <TextButton
                  label="More ideas"
                  color={C.gold}
                  onPress={() => update({ visible: draft.visible + 2 })}
                />
              ) : (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Not seeing it? Build your own in My map"
                  onPress={() =>
                    router.push({ pathname: "/galaxy", params: { build: "1" } })
                  }
                  style={[
                    s.card,
                    {
                      borderStyle: "dashed",
                      borderColor: C.gold,
                      borderRadius: 22,
                      backgroundColor: "transparent",
                      padding: 20,
                    },
                  ]}
                >
                  <Body
                    style={{
                      textAlign: "center",
                      color: C.gold,
                      fontFamily: F.strong,
                    }}
                  >
                    Not seeing it? Build your own in My map →
                  </Body>
                </Pressable>
              )}
            </>
          ) : null}
          {evening && (!current || draft.editing) && !draft.pending ? (
            <Button
              label="Close the day with Chloe"
              onPress={() => router.push("/reflect")}
            />
          ) : null}
          {!!notice && <Notice text={notice} />}
          {due ? (
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
          ) : null}
        </>
      )}
      <Notice
        text={
          action.error ||
          routeError ||
          draftError ||
          extra.error ||
          practiceError ||
          savedFamily.error
        }
        tone="error"
      />
    </Page>
  );
}
