import React, { useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { usePractice } from "../src/practice";
import {
  VALUES,
  dayLabel,
  shiftDay,
  type Intention,
  type Outcome,
} from "../src/domain";
import { draftKey, useDraft } from "../src/drafts";
import {
  ENERGY_LABELS,
  entriesOf,
  entryInput,
  formatCommitment,
  returningToPractice,
  type Energy,
  type ValueChoice,
} from "../src/journey";
import { useToday } from "../src/use-today";
import {
  Body,
  Button,
  Chip,
  Eyebrow,
  Field,
  Illustration,
  Notice,
  Page,
  TextButton,
  Title,
  TopBar,
  s,
} from "../src/ui";

type Step = "outcome" | "energy" | "value" | "replacement" | "note" | "wrap";

export default function Reflect() {
  const { data } = usePractice();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const today = useToday();
  const intention = data.intentions.find((i) =>
    id ? i.id === id : i.day === today,
  );
  if (!intention) return <QuietNight key={today} today={today} />;
  if (intention.day > today)
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
    <ReflectionForm key={intention.id} intention={intention} today={today} />
  );
}

function QuietNight({ today }: { today: string }) {
  const { data, session, putEntry } = usePractice();
  const [returning] = useState(() => returningToPractice(data, today));
  const questions = [
    "What lit you up?",
    "What caught your interest today?",
    "When did time fly today?",
  ];
  const question = returning
    ? "What's true for you right now?"
    : questions[
        Math.floor(Date.parse(`${today}T12:00:00Z`) / 86400000) %
          questions.length
      ];
  const { draft, update, clear, ready, draftError } = useDraft(
    draftKey(`night.${today}`, session?.user.id),
    { note: "" },
  );
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [done, setDone] = useState(false);
  const save = async (skip = false) => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      if (skip || !draft.note.trim()) {
        const prior = entriesOf(data, "question").find(
          (e) => e.title === question && e.state !== "answered",
        );
        if (prior?.state !== "stopped")
          await putEntry(
            entryInput("question", question, {
              id: prior?.id,
              state: "open",
              source: "Night · saved for later",
              meta: {
                ...prior?.meta,
                next_day: shiftDay(today, 2),
                last_asked_at: new Date().toISOString(),
                last_asked_session: `night:${today}`,
              },
            }),
          );
      } else {
        const prior = entriesOf(data, "story").find(
          (e) => e.title === question && e.meta.period === `night:${today}`,
        );
        await putEntry(
          entryInput("story", question, {
            id: prior?.id,
            body: draft.note.trim(),
            source: "A thought from tonight",
            meta: { period: `night:${today}` },
          }),
        );
      }
      const priorSession = entriesOf(data, "preferences").find(
        (e) => e.title === "Check-in session",
      );
      await putEntry(
        entryInput("preferences", "Check-in session", {
          id: priorSession?.id,
          meta: {
            ...priorSession?.meta,
            last_check_in_at: new Date().toISOString(),
          },
        }),
      );
      await clear();
      setDone(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  if (!ready)
    return <ActivityIndicator accessibilityLabel="Restoring your evening" />;
  return (
    <Page
      header={<TopBar title="Night" />}
      footer={
        !done ? (
          <>
            <Notice text={error || draftError} tone="error" />
            <Button
              label="Keep this thought"
              disabled={!draft.note.trim()}
              loading={busy}
              onPress={() => save()}
            />
            <TextButton label="Skip for now" onPress={() => save(true)} />
          </>
        ) : undefined
      }
    >
      <Eyebrow>About two minutes</Eyebrow>
      <Title>{done ? "That's enough for tonight." : question}</Title>
      {done ? (
        <>
          <Illustration
            source={require("../assets/illustrations/evening-reflection.png")}
            height={180}
          />
          <Body>Leave it here. Enjoy the rest of your evening.</Body>
          <Button
            label="Done for tonight"
            onPress={() => router.replace("/")}
          />
        </>
      ) : (
        <>
          {returning ? (
            <Body>Good to see you. Start wherever you are.</Body>
          ) : null}
          <Field
            label="A THOUGHT FROM TODAY"
            multiline
            placeholder="A sentence is enough."
            value={draft.note}
            onChangeText={(note) => update({ note })}
            maxLength={2000}
          />
        </>
      )}
    </Page>
  );
}

function ReflectionForm({
  intention,
  today,
}: {
  intention: Intention;
  today: string;
}) {
  const { data, session, checkIn, putEntry } = usePractice();
  const prior = data.checkIns.find((c) => c.intention_id === intention.id);
  const interest = entriesOf(data, "interest").find((e) =>
    intention.interest_id
      ? e.id === intention.interest_id
      : e.title === intention.interest,
  );
  const allIn = !!interest && ["craft", "all_in"].includes(interest.state);
  const { draft, update, clear, ready, draftError } = useDraft(
    draftKey(`reflect.${intention.id}`, session?.user.id),
    {
      step: "outcome" as Step,
      outcome: prior?.outcome as Outcome | undefined,
      note: prior?.reflection || "",
      energy: prior?.energy || (null as Energy | null),
      value_choice: prior?.value_choice || (null as ValueChoice | null),
      replacement: "",
      replacing: false,
    },
  );
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [done, setDone] = useState(false),
    [skipped, setSkipped] = useState(false);
  const seed = Math.floor(Date.parse(`${intention.day}T12:00:00Z`) / 86400000);
  const valueQuestions = [
    `Was ${intention.value.toLowerCase()} worth the effort today?`,
    `Is ${intention.value.toLowerCase()} part of how you want to be remembered?`,
    `Do you choose ${intention.value.toLowerCase()} again?`,
  ];
  const noteQuestion =
    draft.outcome === "not_yet"
      ? "What got in the way?"
      : allIn
        ? "What did you practice, and what did you learn?"
        : [
            "What caught your interest today?",
            "What are you proud of today?",
            "What lit you up?",
          ][seed % 3];
  const question =
    draft.step === "outcome"
      ? "Did you show up?"
      : draft.step === "energy"
        ? "Did it light you up, feel neutral, or drain you?"
        : draft.step === "value"
          ? valueQuestions[seed % valueQuestions.length]
          : draft.step === "replacement"
            ? "Which value matters more to you?"
            : draft.step === "note"
              ? noteQuestion
              : "Leave it here for tonight.";
  const afterAnswers = (outcome = draft.outcome): Step =>
    outcome === "not_yet" || allIn ? "note" : "wrap";
  const afterEnergy = (): Step => (intention.value ? "value" : afterAnswers());
  const saveQuestion = async (title: string) => {
    const existing = entriesOf(data, "question").find(
      (e) => e.title === title && e.state !== "answered",
    );
    if (existing?.state === "stopped") return;
    await putEntry(
      entryInput("question", title, {
        id: existing?.id,
        state: "open",
        source: "Night · saved for later",
        body: formatCommitment(intention.action, intention.kind),
        source_ids: [intention.id],
        meta: {
          ...existing?.meta,
          next_day: shiftDay(today, 2),
          last_asked_at: new Date().toISOString(),
          last_asked_session: `night:${today}`,
        },
      }),
    );
  };
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
  const markSession = async () => {
    const existing = entriesOf(data, "preferences").find(
      (e) => e.title === "Check-in session",
    );
    await putEntry(
      entryInput("preferences", "Check-in session", {
        id: existing?.id,
        meta: { ...existing?.meta, last_check_in_at: new Date().toISOString() },
      }),
    );
  };
  const save = () =>
    run(async () => {
      if (!draft.outcome) return;
      if (draft.step === "note" && !draft.note.trim())
        await saveQuestion(noteQuestion);
      await checkIn({
        intention_id: intention.id,
        outcome: draft.outcome,
        reflection: draft.note.trim(),
        energy: draft.outcome === "not_yet" ? null : draft.energy,
        value_choice:
          intention.value && draft.outcome !== "not_yet"
            ? draft.value_choice
            : null,
      });
      if (draft.replacing && draft.replacement.trim()) {
        const title = draft.replacement.trim();
        const value = entriesOf(data, "value").find(
          (e) => e.title.toLowerCase() === title.toLowerCase(),
        );
        await putEntry(
          entryInput("value", title, {
            id: value?.id,
            state: value?.state === "mine" ? "mine" : "trying",
            body: value?.body || "",
            source: `Chosen instead of ${intention.value}`,
            source_ids: Array.from(
              new Set([...(value?.source_ids || []), intention.id]),
            ),
            meta: value?.meta || {},
          }),
        );
      }
      if (draft.outcome === "yes") {
        for (const item of entriesOf(data, "backlog").filter(
          (e) =>
            ["open", "active"].includes(e.state) &&
            e.meta.commitment_day === intention.day,
        ))
          await putEntry({ ...item, state: "done" });
      }
      await markSession();
      await clear();
      setDone(true);
    });
  const skip = () =>
    run(async () => {
      await saveQuestion(question);
      if (draft.step === "outcome") {
        await markSession();
        await clear();
        setSkipped(true);
        setDone(true);
      } else if (draft.step === "energy") {
        update({ energy: null, step: afterEnergy() });
      } else if (draft.step === "value") {
        update({ value_choice: null, replacing: false, step: afterAnswers() });
      } else if (draft.step === "replacement") {
        update({
          replacing: false,
          replacement: "",
          value_choice: "not_mine",
          step: afterAnswers(),
        });
      } else {
        update({ note: "", step: "wrap" });
      }
      setNotice("Let it sit with you. We can come back to it.");
    });
  const chooseOutcome = (outcome: Outcome) => {
    const step: Step =
      outcome === "not_yet"
        ? "note"
        : intention.interest && !allIn
          ? "energy"
          : intention.value
            ? "value"
            : afterAnswers(outcome);
    update({
      outcome,
      step,
      ...(outcome === "not_yet"
        ? {
            energy: null,
            value_choice: null,
            replacing: false,
            replacement: "",
          }
        : {}),
    });
    setNotice("");
  };
  const chooseValue = (value_choice: ValueChoice) => {
    update({
      value_choice,
      replacing: false,
      replacement: "",
      step: afterAnswers(),
    });
    setNotice(value_choice === "not_mine" ? "You can let it go." : "");
  };
  const values = Array.from(
    new Set([
      ...entriesOf(data, "value").map((e) => e.title),
      ...data.profile.values,
      ...VALUES,
    ]),
  ).filter((v) => v.toLowerCase() !== intention.value.toLowerCase());
  const back = () => {
    if (done || draft.step === "outcome") {
      if (router.canGoBack()) router.back();
      else router.replace("/");
      return;
    }
    if (draft.step === "replacement") update({ step: "value" });
    else update({ step: "outcome" });
    setNotice("");
  };

  if (!ready)
    return <ActivityIndicator accessibilityLabel="Restoring your reflection" />;
  return (
    <Page
      header={
        <TopBar title={prior ? "Your reflection" : "Night"} onBack={back} />
      }
      footer={
        !done ? (
          <>
            <Notice text={error || draftError} tone="error" />
            {draft.step === "note" ? (
              <>
                <Button
                  label="Keep this reflection"
                  loading={busy}
                  onPress={save}
                />
                <TextButton label="Skip for now" onPress={skip} />
              </>
            ) : draft.step === "wrap" ? (
              <Button
                label="Keep this reflection"
                loading={busy}
                onPress={save}
              />
            ) : draft.step === "replacement" ? (
              <>
                <Button
                  label="Try this value on"
                  loading={busy}
                  disabled={
                    !draft.replacement.trim() ||
                    draft.replacement.trim().toLowerCase() ===
                      intention.value.toLowerCase()
                  }
                  onPress={() => update({ step: afterAnswers() })}
                />
                <TextButton label="Skip for now" onPress={skip} />
              </>
            ) : (
              <TextButton label="Skip for now" onPress={skip} />
            )}
          </>
        ) : undefined
      }
    >
      <Eyebrow>{dayLabel(intention.day)} · About two minutes</Eyebrow>
      <Title>{done ? "That's enough for tonight." : question}</Title>
      {done ? (
        <>
          <Illustration
            source={require("../assets/illustrations/evening-reflection.png")}
            height={180}
          />
          <Body>
            {skipped
              ? "Let it sit with you. We can come back to it."
              : draft.outcome === "not_yet"
                ? "Useful to know. Leave it here for tonight."
                : "Kept with today. Go enjoy the rest of your evening."}
          </Body>
          <Button
            label="Done for tonight"
            onPress={() => router.replace("/")}
          />
        </>
      ) : (
        <>
          <Notice text={notice} />
          {draft.step === "outcome" ? (
            <>
              <View style={s.card}>
                <Body>
                  {formatCommitment(intention.action, intention.kind)}
                </Body>
                {[
                  intention.when_context,
                  intention.place,
                  intention.with_person ? `With ${intention.with_person}` : "",
                ].some(Boolean) ? (
                  <Body>
                    {[
                      intention.when_context,
                      intention.place,
                      intention.with_person
                        ? `With ${intention.with_person}`
                        : "",
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </Body>
                ) : null}
                {intention.value ? (
                  <Eyebrow>Trying on {intention.value}</Eyebrow>
                ) : null}
              </View>
              <View style={s.wrap}>
                {(
                  [
                    { id: "yes", label: "I did" },
                    { id: "partly", label: "A little" },
                    { id: "not_yet", label: "Not this time" },
                  ] as const
                ).map((o) => (
                  <Chip
                    key={o.id}
                    label={o.label}
                    selected={draft.outcome === o.id}
                    onPress={() => chooseOutcome(o.id)}
                  />
                ))}
              </View>
            </>
          ) : draft.step === "energy" ? (
            <>
              {intention.interest ? (
                <Eyebrow>{intention.interest}</Eyebrow>
              ) : null}
              <View style={s.wrap}>
                {(["lit", "neutral", "drained"] as const).map((energy) => (
                  <Chip
                    key={energy}
                    label={ENERGY_LABELS[energy]}
                    selected={draft.energy === energy}
                    onPress={() => update({ energy, step: afterEnergy() })}
                  />
                ))}
              </View>
            </>
          ) : draft.step === "value" ? (
            <View style={{ gap: 12 }}>
              {(
                [
                  ["yes", "Keep it"],
                  ["not_sure", "Still deciding"],
                  ["not_mine", "Let it go"],
                ] as const
              ).map(([value, label]) => (
                <Button
                  secondary
                  key={value}
                  label={label}
                  onPress={() => chooseValue(value)}
                />
              ))}
              <Button
                secondary
                label="Another value matters more"
                onPress={() =>
                  update({
                    value_choice: "not_mine",
                    replacing: true,
                    step: "replacement",
                  })
                }
              />
            </View>
          ) : draft.step === "replacement" ? (
            <>
              <Field
                label="A VALUE TO TRY ON"
                placeholder="In your own words"
                value={draft.replacement}
                onChangeText={(replacement) => update({ replacement })}
                maxLength={80}
              />
              <View style={s.wrap}>
                {values.map((value) => (
                  <Chip
                    key={value}
                    label={value}
                    selected={draft.replacement === value}
                    onPress={() => update({ replacement: value })}
                  />
                ))}
              </View>
            </>
          ) : draft.step === "note" ? (
            <Field
              label={
                draft.outcome === "not_yet"
                  ? "WHAT GOT IN THE WAY?"
                  : allIn
                    ? "WHAT I PRACTICED AND LEARNED"
                    : "WHAT I NOTICED"
              }
              multiline
              placeholder="A sentence is enough. You can leave this here for now."
              value={draft.note}
              onChangeText={(note) => update({ note })}
              maxLength={2000}
            />
          ) : (
            <>
              <Body>There’s nothing else you need to answer.</Body>
              <TextButton
                label="Add a thought from today"
                onPress={() => update({ step: "note" })}
              />
            </>
          )}
        </>
      )}
    </Page>
  );
}
