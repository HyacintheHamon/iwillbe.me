import React, { useEffect, useRef, useState } from "react";
import { View, Text, Pressable, TextInput } from "react-native";
import { router } from "expo-router";
import { Landing } from "../src/landing";
import { usePractice } from "../src/practice";
import { useToday } from "../src/use-today";
import { useRound2 } from "../src/round2-store";
import { useAction } from "../src/use-action";
import { draftKey, useDraft } from "../src/drafts";
import { returningToPractice } from "../src/journey";
import { shiftDay } from "../src/domain";
import {
  Body,
  Button,
  C,
  F,
  Field,
  Notice,
  Page,
  TextButton,
  Title,
  s,
} from "../src/ui";
import { ScrollWheel } from "../src/scroll-wheel";
import { useFocusMission } from "../src/use-focus-mission";
import { FocusCard } from "../src/focus-card";
import {
  priorityOptions,
  whereOptions,
  similarInterests,
  pickMission,
  rareMomentAllowed,
  LEARNING_SHELF,
  type Level,
} from "../src/round2";
import { supabase } from "../src/supabase";
export default function Home() {
  const { session } = usePractice();
  return session ? <Today /> : <Landing />;
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
  const priorities = priorityOptions(data);
  const base = whereOptions(data, extra.places);
  const similar = similarInterests(data);
  const { draft, update, ready } = useDraft(
    draftKey(`today.round2.${today}`, session?.user.id),
    {
      text: "",
      plan: "",
      sent: false,
      more: false,
      priority: "",
      where: "anywhere",
      accepted: "",
      dismissed: false,
      learning: false,
    },
  );
  const [level, setLevel] = useState<Level>("easy");
  const [notice, setNotice] = useState("");
  const priority = priorities.includes(draft.priority)
    ? draft.priority
    : priorities[0] || "";
  const options = [
    ...base,
    ...(draft.more
      ? similar.map((l) => ({
          id: `new:${l.similar_interest}`,
          label: l.similar_interest,
          kind: "interest",
          isNew: true,
        }))
      : []),
  ];
  const where = options.find((x) => x.id === draft.where) || options[0];
  const library =
    pickMission(
      data,
      priority,
      where.label,
      where.kind,
      level,
      draft.learning ? "learn" : "do",
      today,
    ) ||
    pickMission(data, priority, where.label, where.kind, level, "do", today);
  const generated = useFocusMission(
    library,
    where.kind === "anywhere" ? priority : where.label,
    level,
    ready && data.profile.onboarded,
  );
  const mission = generated.mission;
  const current = data.intentions.find((i) => i.day === today);
  const check = data.checkIns.find((c) => c.intention_id === current?.id);
  const previousSummary = extra.summaries.find(
    (x) => x.day === shiftDay(today, -1),
  );
  const opener =
    !draft.dismissed &&
    !returningToPractice(data, today) &&
    !previousSummary?.hard_day
      ? previousSummary?.opener_line
      : null;
  const pendingLearning = useRef(false);
  useEffect(() => {
    pendingLearning.current = false;
  }, [today]);
  useEffect(() => {
    if (
      !ready ||
      !extra.ready ||
      pendingLearning.current ||
      draft.learning ||
      !priority ||
      !data.profile.joined_at
    )
      return;
    const age =
      (Date.parse(today) - Date.parse(data.profile.joined_at)) / 86400000;
    const offset = (session?.user.id.charCodeAt(0) || 0) % 3;
    if (
      age < 5 + offset ||
      !rareMomentAllowed(
        extra.moments,
        "learning",
        `morning:${today}`,
        !!previousSummary?.hard_day,
      ) ||
      !pickMission(
        data,
        priority,
        where.label,
        where.kind,
        "easy",
        "learn",
        today,
      )
    )
      return;
    pendingLearning.current = true;
    void extra
      .recordMoment("learning", `morning:${today}`)
      .then((accepted) => {
        if (accepted) update({ learning: true });
      })
      .catch(() => {});
  }, [
    extra,
    update,
    ready,
    extra.ready,
    extra.moments,
    priority,
    draft.learning,
    today,
    data,
    where.label,
    where.kind,
    session?.user.id,
    previousSummary?.hard_day,
  ]);
  if (!ready) return null;
  const reset = (change: Partial<typeof draft>) => {
    update({ ...change, accepted: "" });
    setLevel("easy");
    setNotice("");
  };
  const saveSuggested = () =>
    action.run(async () => {
      if (!mission) return;
      await saveIntention(
        mission.mission_text,
        priority,
        where.kind === "place" ? where.label : "",
        today,
        where.kind === "interest" ? where.label : "",
        {
          source: "suggested",
          mission_id: mission.id,
          mission_step: mission.ladder_step,
          level,
          type: mission.type as "do" | "learn",
          place: where.kind === "place" ? where.label : "",
          when_context: "",
          for_me: where.label === "for myself",
          for_whom:
            where.kind === "place" && where.label !== "for myself"
              ? where.label
              : "",
        },
      );
      update({ accepted: mission.id });
      setNotice("It's your focus for today. I'll ask how it went tonight.");
    });
  const saveTyped = () =>
    action.run(async () => {
      if (!draft.text.trim() || !draft.plan.trim()) return;
      await saveIntention(draft.text, "", "", today, "", {
        source: "typed",
        mission_id: null,
        mission_step: null,
        level: null,
        type: "do",
        when_context: draft.plan,
        place: "",
        someday_item_id: null,
      });
      update({ accepted: "typed", sent: false });
      setNotice(
        "Perfect. That's your focus for today. I'll ask how it went tonight.",
      );
      void supabase.functions
        .invoke("chloe", { body: { action: "round2_tag_focus", day: today } })
        .then((r) => {
          if (!r.error && r.data?.tagged) return refresh();
        })
        .catch(() => {});
    });
  const dayName = new Date(`${today}T12:00:00`).toLocaleDateString("en-US", {
    weekday: "long",
  });
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: data.profile.timezone,
      hour: "2-digit",
      hour12: false,
    }).format(new Date()),
  );
  const book =
    mission?.type === "learn"
      ? LEARNING_SHELF.find(
          (b) =>
            b.priorities.includes(priority) ||
            b.interests.includes(where.label),
        )
      : null;
  return (
    <Page
      header={
        <View
          style={[
            s.row,
            {
              justifyContent: "space-between",
              paddingHorizontal: 16,
              height: 58,
            },
          ]}
        >
          <Text style={{ fontFamily: F.bold, fontSize: 22, color: C.navy }}>
            be<Text style={{ color: C.gold }}>.</Text>me
          </Text>
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
            {dayName} {hour >= 17 ? "evening" : "morning"}
          </Body>
        </View>
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
          {opener && (
            <View
              style={{
                backgroundColor: C.soft,
                padding: 14,
                borderRadius: 14,
                gap: 6,
              }}
            >
              <Body style={{ fontSize: 15 }}>{opener.text}</Body>
              <View style={s.wrap}>
                {opener.kind === "stretch" ? (
                  <>
                    <TextButton
                      label="Try the stretch"
                      onPress={() => {
                        setLevel("stretch");
                        update({ accepted: "", dismissed: true });
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
                        sent: true,
                        dismissed: true,
                        accepted: "",
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
                  label="×"
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
            <Body style={{ fontFamily: F.strong, paddingLeft: 8 }}>I will</Body>
            <TextInput
              accessibilityLabel="My focus"
              placeholder="call Mom tonight"
              placeholderTextColor={C.muted}
              value={draft.text}
              onChangeText={(text) =>
                update({ text, sent: false, accepted: "" })
              }
              maxLength={500}
              style={{
                flex: 1,
                minWidth: 0,
                fontFamily: F.sans,
                fontSize: 16,
                color: C.navy,
                minHeight: 44,
              }}
              onSubmitEditing={() => {
                if (draft.text.trim()) update({ sent: true, accepted: "" });
              }}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Send my focus"
              disabled={!draft.text.trim()}
              onPress={() => update({ sent: true, accepted: "" })}
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
          {draft.sent && draft.accepted !== "typed" && (
            <View
              style={{
                backgroundColor: C.soft,
                padding: 16,
                borderRadius: 14,
                gap: 12,
              }}
            >
              <Body>When and how will it happen today?</Body>
              <Field
                label="My plan"
                placeholder="at bedtime, phone in the kitchen"
                value={draft.plan}
                onChangeText={(plan) => update({ plan })}
                maxLength={500}
              />
              <Button
                label="Save my focus"
                disabled={!draft.plan.trim()}
                loading={action.busy}
                onPress={saveTyped}
              />
            </View>
          )}
          {!!notice && (
            <View
              style={{ backgroundColor: C.navy, padding: 16, borderRadius: 14 }}
            >
              <Body style={{ color: "#FFFFFF" }}>{notice}</Body>
            </View>
          )}
          {current && !notice && (
            <View
              style={{
                backgroundColor: C.soft,
                padding: 14,
                borderRadius: 14,
                gap: 4,
              }}
            >
              <Body style={{ fontFamily: F.strong }}>Your focus for today</Body>
              <Body>{current.action}</Body>
              {!!current.when_context && (
                <Body style={{ fontSize: 14, color: C.muted }}>
                  {current.when_context}
                </Body>
              )}
            </View>
          )}
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
                  if (p !== priority) reset({ priority: p });
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
                  style={{ textAlign: "center", fontSize: 13, color: C.muted }}
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
                      : setNotice(
                          "Add an interest in My map to find something similar.",
                        )
                  }
                />
              )}
              <FocusCard
                mission={mission}
                level={level}
                onLevel={(l) => {
                  setLevel(l);
                  update({ accepted: "" });
                }}
                onAccept={saveSuggested}
                loading={action.busy}
                label={
                  draft.accepted === mission?.id
                    ? "Your focus for today"
                    : "I'll do this"
                }
              />
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
                  }{" "}
                  New to you, so it starts in My map as Want to try.
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
          <TextButton
            label={check ? "Revisit tonight’s reflection" : "Night check-in"}
            onPress={() => router.push("/reflect")}
          />
          <TextButton
            label="Your rhythms"
            onPress={() => router.push("/rhythms")}
          />
        </>
      )}
      <Notice
        text={action.error || extra.error || practiceError}
        tone="error"
      />
    </Page>
  );
}
