import React, { useCallback, useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { withAccount } from "../src/access-gate";
import { usePractice } from "../src/practice";
import { useRound2 } from "../src/round2-store";
import { useToday } from "../src/use-today";
import { useAction } from "../src/use-action";
import {
  entryInput,
  interestState,
  weekPeriod,
  REVIEW_QUESTIONS,
} from "../src/journey";
import {
  livedFocuses,
  seasonalSunday,
  priorityOptions,
  isHardDay,
  pickMission,
  type MomentType,
} from "../src/round2";
import {
  Body,
  Button,
  Chip,
  C,
  Field,
  Notice,
  Page,
  TextButton,
  Title,
  TopBar,
  s,
} from "../src/ui";
import { supabase } from "../src/supabase";
import { recordScreenVisit } from "../src/usage";
import { InterestDiscovery } from "../src/interest-discovery";
import { SundayOnboarding } from "../src/sunday-onboarding";
import {
  isShortOnboardingSunday,
  sundayOnboardingPhase,
} from "../src/onboarding-followups";
type Review = {
  intro: string;
  pattern: string;
  reflection: string;
  moment: MomentType | null;
  question?: string;
  target_id?: string;
};
function ReviewRhythm({ mode }: { mode: "weekly" | "monthly" }) {
  const { data, session, putEntry } = usePractice();
  const extra = useRound2();
  const today = useToday();
  const action = useAction();
  const [onboardingPhase] = useState(() =>
    mode === "weekly" ? sundayOnboardingPhase(data, today) : null,
  );
  const [onboardingDone, setOnboardingDone] = useState(false);
  const shortSunday = mode === "weekly" && isShortOnboardingSunday(data, today);
  const [step, setStep] = useState(() =>
      shortSunday && !onboardingPhase ? 5 : 0,
    ),
    [review, setReview] = useState<Review | null>(null),
    [note, setNote] = useState(""),
    [focus, setFocus] = useState(""),
    [keep, setKeep] = useState(""),
    [explore, setExplore] = useState(""),
    [answers, setAnswers] = useState<(number | null)[]>([null, null, null]),
    [comparison, setComparison] = useState(false),
    [backlog, setBacklog] = useState(""),
    [showTools, setShowTools] = useState(false),
    [reviewError, setReviewError] = useState("");
  const live = useRef({ data, owner: session?.user.id });
  useEffect(() => {
    live.current = { data, owner: session?.user.id };
  }, [data, session?.user.id]);
  useFocusEffect(
    useCallback(() => {
      if (mode === "weekly")
        recordScreenVisit(
          live.current.data,
          live.current.owner,
          "sunday_review",
        );
    }, [mode]),
  );
  const season = seasonalSunday(today);
  const lived = livedFocuses(data, today);
  const priorities = priorityOptions(data);
  const period =
    mode === "weekly" ? weekPeriod(today) : `moon:${today.slice(0, 7)}`;
  const hard = extra.summaries[0]?.hard_day || isHardDay(note);
  const moment = hard ? null : review?.moment;
  const target = data.entries.find((e) => e.id === review?.target_id);
  const firstStep = target
    ? pickMission(
        data,
        priorities[0] || "",
        target.title,
        "interest",
        "easy",
        "do",
        today,
      )
    : undefined;
  useEffect(() => {
    let active = true;
    if (mode === "weekly" && !shortSunday)
      void supabase.functions
        .invoke("chloe", { body: { action: "round2_review", day: today } })
        .then((r) => {
          if (!active) return;
          if (r.error || r.data?.error)
            setReviewError(
              "Chloe’s reflection could not load. Your saved actions are still here.",
            );
          else setReview(r.data);
        });
    return () => {
      active = false;
    };
  }, [mode, today, shortSunday]);
  const done = () =>
    action.run(async () => {
      const old = data.entries.find(
        (e) => e.kind === "review" && e.meta.period === period,
      );
      await putEntry(
        entryInput(
          "review",
          mode === "weekly" ? "Sunday review" : "Monthly check-in",
          {
            id: old?.id,
            revision: old?.revision,
            body: note,
            state: "done",
            meta: { period, answers: mode === "monthly" ? answers : undefined },
          },
        ),
      );
      if (focus) {
        const oldFocus = data.entries.find(
          (e) => e.kind === "preferences" && e.title === "Weekly priority",
        );
        await putEntry(
          entryInput("preferences", "Weekly priority", {
            id: oldFocus?.id,
            revision: oldFocus?.revision,
            body: focus,
            meta: { period },
          }),
        );
      }
      setStep(6);
    });
  const saveReflection = () =>
    action.run(async () => {
      if (note.trim())
        await putEntry(
          entryInput(
            "story",
            review?.reflection || "What was the best part of your week?",
            { body: note, source: "Sunday · your words", meta: { period } },
          ),
        );
      setStep(moment === "narrowing" ? 3 : 4);
    });
  const annual =
    !!data.profile.joined_at &&
    today.slice(5, 7) === data.profile.joined_at.slice(5, 7) &&
    Number(today.slice(0, 4)) > Number(data.profile.joined_at.slice(0, 4));
  if (onboardingPhase && !onboardingDone)
    return (
      <SundayOnboarding
        phase={onboardingPhase}
        day={today}
        onDone={() => {
          setOnboardingDone(true);
          setStep(5);
        }}
      />
    );
  return (
    <Page
      header={
        <TopBar
          title={mode === "weekly" ? "Sunday review" : "Monthly check-in"}
        />
      }
      contentStyle={{ gap: 18 }}
    >
      {step === 6 ? (
        <>
          <Title>
            {mode === "weekly"
              ? "Your week is set."
              : "A little more direction."}
          </Title>
          {focus && (
            <Body>This week I’ll lean toward {focus} in your mornings.</Body>
          )}
          <Button label="Back to Today" onPress={() => router.replace("/")} />
        </>
      ) : mode === "weekly" ? (
        <>
          {step === 0 && (
            <>
              <Title>What I’ve planted</Title>
              <Body>
                {season ? "This season" : "This week"}, in your own words and
                actions.
              </Body>
              {lived.length ? (
                lived.map((i) => (
                  <View
                    key={i.id}
                    style={{
                      gap: 5,
                      paddingVertical: 10,
                      borderBottomWidth: 1,
                      borderColor: C.line,
                    }}
                  >
                    <Body style={{ fontSize: 13, color: C.muted }}>
                      {new Date(`${i.day}T12:00:00`).toLocaleDateString(
                        "en-US",
                        {
                          weekday: "long",
                          ...(season ? { month: "short", day: "numeric" } : {}),
                        },
                      )}
                      {i.value ? ` · ${i.value}` : ""}
                      {i.place || i.person ? ` · ${i.place || i.person}` : ""}
                    </Body>
                    <Body>{i.action}</Body>
                  </View>
                ))
              ) : (
                <Body>
                  Your lived steps will appear here after a night check-in.
                </Body>
              )}
              {review?.intro && <Body>{review.intro}</Body>}
              <Notice text={reviewError} />
              <Button
                label="Next"
                onPress={() => setStep(review?.pattern ? 1 : 2)}
              />
            </>
          )}
          {step === 1 && (
            <>
              <Title>One thing I noticed</Title>
              <Body>{review?.pattern}</Body>
              <Button
                label="Yes, that's me"
                onPress={() =>
                  action.run(async () => {
                    await putEntry(
                      entryInput(
                        "story",
                        review?.pattern || "A pattern from Sunday",
                        {
                          body: "Yes, that’s me",
                          source: "Confirmed Sunday pattern",
                          meta: { period },
                        },
                      ),
                    );
                    setStep(2);
                  })
                }
              />
              <TextButton label="Not really" onPress={() => setStep(2)} />
            </>
          )}
          {step === 2 && (
            <>
              <Title>A moment to reflect</Title>
              <Body>
                {review?.reflection || "What was the best part of your week?"}
              </Body>
              <Field
                multiline
                label="In your words"
                value={note}
                onChangeText={setNote}
                maxLength={2000}
              />
              {moment === "people_question" && !!note.trim() && (
                <>
                  <TextButton
                    label="Add to my places"
                    onPress={() =>
                      action.run(async () => {
                        await extra.addPlace(`with ${note.trim()}`);
                        setStep(4);
                      })
                    }
                  />
                  <TextButton
                    label="Add to things I want to do"
                    onPress={() =>
                      action.run(async () => {
                        await putEntry(
                          entryInput(
                            "backlog",
                            `Spend time with ${note.trim()}`,
                            { state: "open", source: "Sunday · chosen by you" },
                          ),
                        );
                        setStep(4);
                      })
                    }
                  />
                </>
              )}
              <Button
                label={moment === "people_question" ? "Just noting it" : "Next"}
                onPress={saveReflection}
              />
              <TextButton
                label="Skip"
                onPress={() => setStep(moment === "narrowing" ? 3 : 4)}
              />
            </>
          )}
          {step === 3 && moment === "narrowing" && (
            <>
              <Title>What lights you up?</Title>
              <Body>
                If you could only keep one of these, which would it be?
              </Body>
              <View style={s.wrap}>
                {data.entries
                  .filter(
                    (e) =>
                      e.kind === "interest" &&
                      interestState(data, e) === "Into it",
                  )
                  .map((e) => (
                    <Chip
                      key={e.id}
                      label={e.title}
                      selected={keep === e.id}
                      onPress={() => setKeep(e.id)}
                    />
                  ))}
              </View>
              <Button
                label="Move them back"
                disabled={!keep}
                onPress={() =>
                  action.run(async () => {
                    for (const e of data.entries.filter(
                      (e) =>
                        e.kind === "interest" &&
                        interestState(data, e) === "Into it" &&
                        e.id !== keep,
                    ))
                      await putEntry({ ...e, state: "from_time_to_time" });
                    setStep(4);
                  })
                }
              />
              <TextButton
                label="Keep them as they are"
                onPress={() => setStep(4)}
              />
            </>
          )}
          {(step === 4 || (step === 3 && moment !== "narrowing")) && (
            <>
              <Title>Something new to explore</Title>
              <InterestDiscovery onAdded={setExplore} />
              {(moment === "worst_case" || moment === "cost_of_waiting") && (
                <View style={s.card}>
                  <Body>{target?.title}</Body>
                  <Body>{review?.question}</Body>
                  <Field
                    label="What comes to mind?"
                    value={note}
                    onChangeText={setNote}
                    maxLength={1500}
                  />
                  <Body>
                    {firstStep?.mission_text ||
                      `Take five minutes to find one practical first step toward ${target?.title || "this"}.`}
                  </Body>
                  {!!firstStep?.first_step && (
                    <Body>{firstStep.first_step}</Body>
                  )}
                  <Button
                    label="This week"
                    onPress={() => {
                      const item = data.entries.find(
                        (e) => e.id === review?.target_id,
                      );
                      if (item) setExplore(item.title);
                      setStep(5);
                    }}
                  />
                  <TextButton label="Later" onPress={() => setStep(5)} />
                  <TextButton
                    label="Let it go"
                    onPress={() =>
                      action.run(async () => {
                        const item = data.entries.find(
                          (e) => e.id === review?.target_id,
                        );
                        if (item)
                          await putEntry({
                            ...item,
                            state:
                              item.kind === "interest"
                                ? "on_pause"
                                : "released",
                          });
                        setStep(5);
                      })
                    }
                  />
                </View>
              )}
              <Button label="Plan the week" onPress={() => setStep(5)} />
            </>
          )}
          {step === 5 && (
            <>
              <Title>Plan the week</Title>
              {explore && <Body>You chose to explore {explore}.</Body>}
              <Body>Which priority will you lean into?</Body>
              <View style={s.wrap}>
                {priorities.map((p) => (
                  <Chip
                    key={p}
                    label={p}
                    selected={focus === p}
                    onPress={() => setFocus(p)}
                  />
                ))}
              </View>
              <Button label="Set my week" onPress={done} />
            </>
          )}
        </>
      ) : (
        <>
          {step < 3 ? (
            <>
              <Title>A moment to check in</Title>
              <Body>{REVIEW_QUESTIONS[step]}</Body>
              <View style={s.wrap}>
                {Array.from({ length: 11 }, (_, n) => (
                  <Chip
                    key={n}
                    label={String(n)}
                    selected={answers[step] === n}
                    onPress={() =>
                      setAnswers((a) => a.map((v, i) => (i === step ? n : v)))
                    }
                  />
                ))}
              </View>
              <Button label="Next" onPress={() => setStep(step + 1)} />
              <TextButton label="Skip" onPress={() => setStep(step + 1)} />
            </>
          ) : (
            <>
              <Title>Is this still the life you want?</Title>
              <Body>Here’s what’s on your This year list.</Body>
              {extra.someday.some(
                (item) =>
                  item.horizon === "this_year" && item.status !== "let_go",
              ) ? (
                extra.someday
                  .filter(
                    (item) =>
                      item.horizon === "this_year" && item.status !== "let_go",
                  )
                  .map((item) => (
                    <View key={item.id} style={s.card}>
                      <Body>
                        {item.status === "lived" ? "✓ " : ""}
                        {item.text}
                      </Body>
                    </View>
                  ))
              ) : (
                <Body>
                  Your This year list is still taking shape. You can add
                  something or leave room for later.
                </Body>
              )}
              <View style={s.wrap}>
                <TextButton label="Still true" onPress={done} />
                <TextButton
                  label="Tweak it"
                  onPress={() => router.push("/telescope")}
                />
                <TextButton
                  label="Something's changed"
                  onPress={() => router.push("/telescope")}
                />
              </View>
              <TextButton
                label="Show how things have changed"
                onPress={() => setComparison(!comparison)}
              />
              {comparison && (
                <Body>
                  {answers
                    .map((v, i) => {
                      const before = data.profile.baseline_answers?.[i];
                      return v === null || before == null
                        ? ""
                        : v > before
                          ? [
                              "Your days feel more like your own.",
                              "Your days feel more worthwhile.",
                              "You feel more connected.",
                            ][i]
                          : v < before
                            ? [
                                "Your days feel less like your own right now.",
                                "Your days feel less worthwhile right now.",
                                "You feel less connected right now.",
                              ][i]
                            : [
                                "Your sense of direction feels steady.",
                                "Your sense of purpose feels steady.",
                                "Your connection with others feels steady.",
                              ][i];
                    })
                    .filter(Boolean)
                    .join(" ") ||
                    "Answer these questions and the starting-point questions to see a change in words."}
                </Body>
              )}
              {annual && (
                <View style={s.card}>
                  <Body>
                    What would you like to be, do, have, see or share next?
                  </Body>
                  <TextButton
                    label="Refresh my someday list"
                    onPress={() => router.push("/telescope")}
                  />
                </View>
              )}
              <Button label="Finish check-in" onPress={done} />
            </>
          )}
        </>
      )}
      <TextButton
        label="Things I want to do and questions to come back to"
        onPress={() => setShowTools(!showTools)}
      />
      {showTools && (
        <View style={s.card}>
          <Field
            label="Something I want to do"
            value={backlog}
            onChangeText={setBacklog}
            maxLength={300}
          />
          <Button
            secondary
            label="Keep for later"
            disabled={!backlog.trim()}
            onPress={() =>
              action.run(async () => {
                await putEntry(
                  entryInput("backlog", backlog.trim(), { state: "open" }),
                );
                setBacklog("");
              })
            }
          />
          {data.entries
            .filter(
              (e) =>
                ["backlog", "question"].includes(e.kind) &&
                !["done", "released", "stopped", "answered"].includes(e.state),
            )
            .map((e) => (
              <View key={e.id}>
                <Body>{e.title}</Body>
                <TextButton
                  label={`Let go: ${e.title}`}
                  onPress={() =>
                    action.run(async () => {
                      await putEntry({
                        ...e,
                        state: e.kind === "question" ? "stopped" : "released",
                      });
                    })
                  }
                />
              </View>
            ))}
        </View>
      )}
      <Notice text={action.error || extra.error} tone="error" />
    </Page>
  );
}
function Rhythms() {
  const params = useLocalSearchParams<{ mode?: string }>();
  const mode = params.mode === "monthly" ? "monthly" : "weekly";
  return <ReviewRhythm key={mode} mode={mode} />;
}
export default withAccount(Rhythms);
