import React, { useCallback, useEffect, useRef } from "react";
import { View } from "react-native";
import { usePractice } from "./practice";
import { useAction } from "./use-action";
import { useDraft, draftKey } from "./drafts";
import { entryInput, REVIEW_QUESTIONS, type EntryInput } from "./journey";
import { PRIORITY_WORDS, priorityName } from "./priorities";
import { strengthMatches } from "./round2";
import { supabase } from "./supabase";
import {
  Body,
  Button,
  Chip,
  Field,
  Notice,
  Page,
  TextButton,
  Title,
  TopBar,
  s,
} from "./ui";
import {
  CHILDHOOD_QUESTION,
  STRENGTH_QUESTION,
  HELP_QUESTION,
  GROWTH_QUESTION,
  followupInput,
  openFollowupInput,
  completedFollowupRecord,
  sundayOnboardingCompletion,
  SUNDAY_ONBOARDING_STEPS,
} from "./onboarding-followups";

/** The first two Sunday reviews replace their usual why question. */
export function SundayOnboarding({
  phase,
  day,
  onDone,
}: {
  phase: 1 | 2;
  day: string;
  onDone: () => void;
}) {
  const { data, session, putEntry, saveProfile } = usePractice();
  const action = useAction();
  const latest = useRef(data);
  useEffect(() => {
    latest.current = data;
  }, [data]);
  const steps = SUNDAY_ONBOARDING_STEPS[phase];
  const { draft, update, clear, ready, draftError } = useDraft(
    draftKey(`onboarding.sunday.${phase}`, session?.user.id),
    {
      cursor: 0,
      baselineIndex: 0,
      answers: [null, null, null] as (number | null)[],
      text: "",
      proposing: false,
      priorities: [] as string[],
      interests: [] as string[],
      selectedPriorities: [] as string[],
      selectedInterests: [] as string[],
      customInterest: "",
    },
  );
  const kind = steps[draft.cursor];
  const question =
    kind === "childhood"
      ? CHILDHOOD_QUESTION
      : kind === "strengths"
        ? STRENGTH_QUESTION
        : kind === "help"
          ? HELP_QUESTION
          : GROWTH_QUESTION;
  const key = `sunday:${phase}:${kind}`;
  const finish = useCallback(async () => {
    const current = latest.current;
    if (!completedFollowupRecord(current, `sunday:${phase}`))
      await putEntry(
        followupInput(
          current,
          `sunday:${phase}`,
          `Sunday ${phase} discovery`,
          sundayOnboardingCompletion(current, phase)?.meta.asked_day || day,
          "answered",
        ),
      );
    await clear();
    onDone();
  }, [clear, day, onDone, phase, putEntry]);
  const persist = async (input: EntryInput) => {
    const old = latest.current.entries.find(
      (entry) => entry.kind === input.kind && entry.title === input.title,
    );
    const saved = await putEntry({
      ...input,
      id: old?.id || input.id,
      revision: old?.revision,
    });
    latest.current = {
      ...latest.current,
      entries: [
        ...latest.current.entries.filter((entry) => entry.id !== saved.id),
        saved,
      ],
    };
    return saved;
  };
  const advance = async (skipped = false) => {
    const currentData = latest.current;
    if (skipped)
      await putEntry(
        openFollowupInput(
          currentData,
          { key, kind: "interest", question },
          day,
        ),
      );
    await putEntry(
      followupInput(
        currentData,
        key,
        question,
        day,
        skipped ? "skipped" : "answered",
      ),
    );
    if (draft.cursor >= steps.length - 1) {
      await finish();
    } else
      update({
        cursor: draft.cursor + 1,
        text: "",
        proposing: false,
        priorities: [],
        interests: [],
        selectedPriorities: [],
        selectedInterests: [],
        customInterest: "",
      });
  };
  const baseline = (skip = false) =>
    action.run(async () => {
      const answers = draft.answers.map((answer, index) =>
        skip && index === draft.baselineIndex ? null : answer,
      );
      if (skip)
        await putEntry(
          openFollowupInput(
            latest.current,
            {
              key: `sunday:1:baseline:${draft.baselineIndex}`,
              kind: "interest",
              question: REVIEW_QUESTIONS[draft.baselineIndex],
            },
            day,
          ),
        );
      if (draft.baselineIndex < 2) {
        update({ answers, baselineIndex: draft.baselineIndex + 1 });
        return;
      }
      const profile = await saveProfile({
        ...latest.current.profile,
        baseline_answers: answers,
      });
      latest.current = { ...latest.current, profile };
      await putEntry(
        followupInput(
          latest.current,
          "sunday:1:baseline",
          "A starting point",
          day,
          "answered",
        ),
      );
      update({ cursor: draft.cursor + 1, answers, text: "" });
    });
  const propose = () =>
    action.run(async () => {
      if (!draft.text.trim()) return;
      await persist(
        entryInput("story", question, {
          body: draft.text.trim(),
          source: "Sunday · in your words",
          meta: { period: `onboarding:${phase}:${kind}` },
        }),
      );
      const exact = priorityName(
        draft.text
          .replace(/^(being more |being |more |be )+/gi, "")
          .replace(/[.!?]+$/, ""),
      );
      let priorities =
        kind === "growth" && PRIORITY_WORDS.some((word) => word.name === exact)
          ? [exact]
          : [];
      let interests: string[] = [];
      if (!priorities.length) {
        const result = await supabase.functions.invoke("chloe", {
          body: {
            action: "round2_onboarding",
            kind:
              kind === "help"
                ? "strengths"
                : kind === "childhood"
                  ? "kid"
                  : kind,
            text: draft.text,
          },
        });
        if (result.error || result.data?.error) {
          priorities = ["strengths", "help"].includes(kind)
            ? strengthMatches(
                draft.text,
                PRIORITY_WORDS.map((word) => word.name),
              )
            : [];
          if (!priorities.length)
            throw new Error(
              "Your words are saved. Chloe couldn't suggest a match. Try again, or keep just your words.",
            );
        } else {
          priorities = (result.data?.priorities || [])
            .filter((name: string) =>
              PRIORITY_WORDS.some((word) => word.name === name),
            )
            .slice(0, 4);
          interests = (result.data?.interests || [])
            .filter(
              (name: unknown) =>
                typeof name === "string" &&
                name.trim().length > 0 &&
                name.length <= 80,
            )
            .slice(0, 2);
        }
      }
      // Existing choices retain their stage; only new, explicitly confirmed words
      // are added as Working on / Want to try.
      priorities = priorities.filter(
        (name) =>
          !latest.current.entries.some(
            (entry) =>
              entry.kind === "value" &&
              priorityName(entry.title) === name &&
              entry.state !== "let_go",
          ),
      );
      interests = interests.filter(
        (name) =>
          !latest.current.entries.some(
            (entry) =>
              entry.kind === "interest" &&
              entry.title.toLowerCase() === name.toLowerCase(),
          ),
      );
      update({
        proposing: true,
        priorities,
        interests,
        selectedPriorities: [],
        selectedInterests: interests,
      });
    });
  const keep = () =>
    action.run(async () => {
      for (const name of draft.selectedPriorities)
        await persist(
          entryInput("value", name, {
            state: "working_on",
            body: draft.text,
            source: "Sunday · confirmed by you",
          }),
        );
      for (const name of new Set(
        [...draft.selectedInterests, draft.customInterest.trim()].filter(
          Boolean,
        ),
      )) {
        if (
          latest.current.entries.some(
            (entry) =>
              entry.kind === "interest" &&
              entry.title.toLowerCase() === name.toLowerCase(),
          )
        )
          continue;
        await persist(
          entryInput("interest", name, {
            state: "want_to_try",
            body: draft.text,
            source: "Sunday · chosen by you",
          }),
        );
      }
      await advance();
    });

  // Saved markers win over a stale local cursor, including the baseline. If a
  // crash happened between the final answer and the phase marker, finish that
  // write without asking any answered question again.
  useEffect(() => {
    if (!ready || action.busy || action.error) return;
    if (sundayOnboardingCompletion(data, phase)) {
      void action.run(finish);
      return;
    }
    const next = steps.findIndex(
      (step) => !completedFollowupRecord(data, `sunday:${phase}:${step}`),
    );
    if (next >= 0 && next !== draft.cursor)
      update({
        cursor: next,
        text: "",
        proposing: false,
        priorities: [],
        interests: [],
        selectedPriorities: [],
        selectedInterests: [],
        customInterest: "",
      });
  }, [ready, action, data, draft.cursor, steps, phase, finish, update]);
  if (!ready) return null;
  if (sundayOnboardingCompletion(data, phase))
    return (
      <Page header={<TopBar title="Sunday review" />}>
        <Title>Your answers are saved.</Title>
        <Button
          label="Continue"
          loading={action.busy}
          onPress={() => action.run(finish)}
        />
        <Notice text={action.error || draftError} tone="error" />
      </Page>
    );
  return (
    <Page header={<TopBar title="Sunday review" />}>
      {kind === "baseline" ? (
        <>
          <Title>A starting point</Title>
          <Body>{REVIEW_QUESTIONS[draft.baselineIndex]}</Body>
          <View style={s.wrap}>
            {Array.from({ length: 11 }, (_, n) => (
              <Chip
                key={n}
                label={String(n)}
                selected={draft.answers[draft.baselineIndex] === n}
                disabled={action.busy}
                onPress={() =>
                  update({
                    answers: draft.answers.map((value, index) =>
                      index === draft.baselineIndex ? n : value,
                    ),
                  })
                }
              />
            ))}
          </View>
          <Button
            label="Next"
            disabled={draft.answers[draft.baselineIndex] === null}
            loading={action.busy}
            onPress={() => baseline()}
          />
          <TextButton
            label="Skip for now"
            disabled={action.busy}
            onPress={() => baseline(true)}
          />
        </>
      ) : draft.proposing ? (
        <>
          <Title>What would you like to keep?</Title>
          {draft.priorities.length > 0 && (
            <>
              <Body>
                Do any of these fit? Choose the ones you want to work on.
              </Body>
              <View style={s.wrap}>
                {draft.priorities.map((name) => (
                  <Chip
                    key={name}
                    label={name}
                    selected={draft.selectedPriorities.includes(name)}
                    onPress={() =>
                      update({
                        selectedPriorities: draft.selectedPriorities.includes(
                          name,
                        )
                          ? draft.selectedPriorities.filter(
                              (word) => word !== name,
                            )
                          : [...draft.selectedPriorities, name],
                      })
                    }
                  />
                ))}
              </View>
            </>
          )}
          {draft.interests.length > 0 && (
            <View style={s.wrap}>
              {draft.interests.map((name) => (
                <Chip
                  key={name}
                  label={name}
                  selected={draft.selectedInterests.includes(name)}
                  onPress={() =>
                    update({
                      selectedInterests: draft.selectedInterests.includes(name)
                        ? draft.selectedInterests.filter(
                            (word) => word !== name,
                          )
                        : [...draft.selectedInterests, name],
                    })
                  }
                />
              ))}
            </View>
          )}
          {["childhood", "growth"].includes(kind) &&
            !draft.priorities.length && (
              <Field
                label="An interest in your words"
                placeholder="e.g. drawing"
                value={draft.customInterest}
                onChangeText={(customInterest) => update({ customInterest })}
                maxLength={80}
              />
            )}
          {!draft.priorities.length && !draft.interests.length && (
            <Body>Your story is saved in your words.</Body>
          )}
          <Button
            label="Keep selected"
            disabled={
              !draft.selectedPriorities.length &&
              !draft.selectedInterests.length &&
              !draft.customInterest.trim()
            }
            loading={action.busy}
            onPress={keep}
          />
          <TextButton
            label="Keep just my words"
            disabled={action.busy}
            onPress={() => action.run(() => advance())}
          />
        </>
      ) : (
        <>
          <Title>A little more of your map</Title>
          <Body>{question}</Body>
          <Field
            label="In your words"
            multiline
            value={draft.text}
            onChangeText={(text) => update({ text })}
            maxLength={2000}
          />
          <Button
            label="Next"
            disabled={!draft.text.trim()}
            loading={action.busy}
            onPress={propose}
          />
          {action.error && !!draft.text.trim() && (
            <TextButton
              label="Keep just my words"
              disabled={action.busy}
              onPress={() => action.run(() => advance())}
            />
          )}
          <TextButton
            label="Skip for now"
            disabled={action.busy}
            onPress={() => action.run(() => advance(true))}
          />
        </>
      )}
      <Notice text={action.error || draftError} tone="error" />
    </Page>
  );
}
