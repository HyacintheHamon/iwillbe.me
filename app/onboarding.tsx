import { withAccount } from "../src/access-gate";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Image, Platform, View } from "react-native";
import { router } from "expo-router";
import * as Crypto from "expo-crypto";
import { usePractice } from "../src/practice";
import { supabase } from "../src/supabase";
import {
  entryInput,
  entriesOf,
  currentWhy,
  interestState,
  type EntryInput,
} from "../src/journey";
import { POSSIBILITIES, SPARK_ART } from "../src/catalog";
import {
  Body,
  Button,
  Chip,
  Eyebrow,
  Field,
  Notice,
  Page,
  TextButton,
  Title,
  TopBar,
  s,
} from "../src/ui";
import { draftKey, useDraft } from "../src/drafts";
import {
  scheduleReminders,
  downloadReminderCalendar,
  phoneTimeZone,
} from "../src/reminders";
import {
  FIRST_SESSION_STORIES,
  GROWTH_QUESTION,
  WHY_QUESTION,
  MORNING_ANCHOR_QUESTION,
  EVENING_ANCHOR_QUESTION,
  firstSessionStep,
  firstSessionQuestionAvailable,
  previousFirstSessionStep,
  isUnreadyAnswer,
  pickObservation,
  quickPickState,
  shouldOfferStoryFollowUp,
  storyBody,
  storyFollowUp,
  suggestedFirstValue,
  validCheckInTime,
} from "../src/onboarding";
import {
  proposalKey,
  storyProposals,
  validatedOnboardingInsights,
  type OnboardingInsights,
  type OnboardingProposal,
} from "../src/onboarding-insights";
import {
  legacyPickOwnership,
  pickKey,
  pickSource,
  quickPickChanges,
  type PickSnapshot,
} from "../src/onboarding-picks";

function Onboarding() {
  const { data, session, putEntry, removeEntry, saveProfile } = usePractice();
  const [sessionSeed] = useState(() => Crypto.randomUUID());
  const anchors = entriesOf(data, "preferences").find(
    (e) => e.title === "Check-in anchors",
  );
  const {
    draft,
    update: storeDraft,
    ready,
    draftError,
  } = useDraft(draftKey("discovery", session?.user.id), {
    flowVersion: 0,
    flowSession: "",
    allocatedIds: {} as Record<string, string>,
    pickSnapshots: {} as Record<string, PickSnapshot>,
    legacyPicks: [] as { card: string; id: string; updated_at: string }[],
    step: 0,
    cursor: 0,
    sort: {} as Record<string, string>,
    stories: ["", "", ""],
    followUps: ["", "", ""],
    followUpQuestions: ["", "", ""],
    keptFollowUps: [false, false, false],
    followUp: false,
    automaticFollowUpOffered: false,
    growth: "",
    why: currentWhy(data)?.body || "",
    value: "",
    morningAnchor: anchors?.meta.morning_anchor || "",
    eveningAnchor: anchors?.meta.evening_anchor || "",
    morningTime: data.profile.morning_time,
    eveningTime: data.profile.evening_time,
    reminderTimesChosen: false,
    insights: { proposals: [], follow_up: null } as OnboardingInsights,
    insightSources: "",
    dismissedProposals: [] as string[],
  });
  const draftRef = useRef(draft);
  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);
  const update = useCallback(
    (change: Partial<typeof draft>) => {
      const next = { ...draftRef.current, ...change };
      draftRef.current = next;
      storeDraft(next);
    },
    [storeDraft],
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [remindersSet, setRemindersSet] = useState(false);
  const [insightsBusy, setInsightsBusy] = useState(false);
  const alive = useRef(true);
  const owner = useRef(session?.user.id);
  useEffect(() => {
    owner.current = session?.user.id;
  }, [session?.user.id]);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const latest = useRef(data);
  useEffect(() => {
    latest.current = data;
  }, [data]);
  const inFlight = useRef(false);
  useEffect(() => {
    if (ready && draft.flowVersion !== 3)
      update({
        flowVersion: 3,
        flowSession: draft.flowSession || sessionSeed,
        step: firstSessionStep(draft.flowVersion, draft.step),
        legacyPicks: legacyPickOwnership({
          cards: POSSIBILITIES,
          choices: draft.sort,
          entries: data.entries,
          onboarded: data.profile.onboarded,
          used: data.intentions,
        }),
      });
  }, [
    ready,
    draft.flowVersion,
    draft.flowSession,
    draft.step,
    draft.sort,
    data,
    sessionSeed,
    update,
  ]);
  const run = async (work: () => Promise<void>) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError("");
    try {
      await work();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not save. Please try again.",
      );
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };
  const allocatedId = (key: string) => {
    const saved = draftRef.current.allocatedIds[key];
    if (saved) return saved;
    const id = Crypto.randomUUID();
    update({ allocatedIds: { ...draftRef.current.allocatedIds, [key]: id } });
    return id;
  };
  const saveEntry = async (input: EntryInput, uniqueBody = false) => {
    const key = `${input.kind}:${input.title}${uniqueBody ? `:${input.body}` : ""}`;
    const prior = latest.current.entries.find((entry) =>
      input.id
        ? entry.id === input.id
        : entry.kind === input.kind &&
          entry.title === input.title &&
          (!uniqueBody || entry.body === input.body),
    );
    const saved = await putEntry({
      ...input,
      id: input.id || prior?.id || allocatedId(`entry:${key}`),
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
  const leaveOpen = async (
    question: string,
    context = "",
    sourceIds: string[] = [],
  ) => {
    const prior = entriesOf(latest.current, "question").find(
      (e) => e.title === question,
    );
    if (prior?.state !== "stopped")
      await saveEntry(
        entryInput("question", question, {
          state: "open",
          source: "First session · left open",
          body: context || prior?.body || "",
          source_ids: sourceIds.length ? sourceIds : prior?.source_ids || [],
          meta: {
            ...prior?.meta,
            last_asked_at: new Date().toISOString(),
            last_asked_session: "first-session",
          },
        }),
      );
    setNotice("Let it sit with you today. We can come back to it.");
  };
  const resolveQuestion = async (question: string) => {
    const prior = entriesOf(latest.current, "question").find(
      (e) => e.title === question,
    );
    if (prior && prior.state !== "answered")
      await putEntry({ ...prior, state: "answered" });
  };
  const go = (step: number) => {
    setNotice("");
    update({ step, followUp: false });
  };
  const card = POSSIBILITIES[draft.cursor];
  const chosen = POSSIBILITIES.filter((p) => quickPickState(draft.sort[p.id]));
  const observation = pickObservation(
    chosen.map((p) => ({ title: p.title, choice: draft.sort[p.id] })),
  );
  const savedStories = FIRST_SESSION_STORIES.map((question) =>
    entriesOf(data, "story").find((entry) => entry.title === question),
  );
  const storyInputs = FIRST_SESSION_STORIES.map((question, index) => ({
    question,
    answer: savedStories[index]?.body || "",
  }));
  const storyFingerprint = JSON.stringify(storyInputs);
  const proposals = [
    ...(draft.insightSources === storyFingerprint
      ? draft.insights.proposals
      : []),
    ...storyProposals(storyInputs),
  ]
    .filter(
      (proposal, index, all) =>
        all.findIndex(
          (item) =>
            item.kind === proposal.kind &&
            item.title.toLowerCase() === proposal.title.toLowerCase(),
        ) === index,
    )
    .slice(0, 4);
  const pendingProposals = proposals.filter(
    (proposal) =>
      !draft.dismissedProposals.includes(proposalKey(proposal)) &&
      !data.entries.some(
        (entry) =>
          entry.kind === proposal.kind &&
          entry.title.toLowerCase() === proposal.title.toLowerCase(),
      ),
  );
  const nextProposal = pendingProposals[0];
  const valueSuggestion = suggestedFirstValue(
    [],
    chosen.some((p) => draft.sort[p.id] === "curious"),
  );
  const fallbackValue =
    !proposals.some((proposal) => proposal.kind === "value") &&
    valueSuggestion &&
    !entriesOf(data, "value").some((entry) => entry.title === valueSuggestion)
      ? valueSuggestion
      : null;
  const storyIndex = draft.step - 3;
  const storyQuestion = FIRST_SESSION_STORIES[storyIndex];
  const followUpQuestion =
    draft.followUpQuestions[storyIndex] ||
    storyFollowUp(storyIndex, draft.stories[storyIndex] || "");
  const savePicks = () =>
    run(async () => {
      for (const legacy of draftRef.current.legacyPicks) {
        const entry = latest.current.entries.find(
          (item) => item.id === legacy.id,
        );
        if (
          !entry ||
          entry.updated_at !== legacy.updated_at ||
          entry.meta.onboarding_session
        )
          continue;
        const saved = await saveEntry({
          ...entry,
          meta: {
            ...entry.meta,
            onboarding_session: draftRef.current.flowSession,
            onboarding_key: pickKey(legacy.card),
          },
        });
        update({
          pickSnapshots: {
            ...draftRef.current.pickSnapshots,
            [legacy.card]: { id: saved.id, updated_at: saved.updated_at },
          },
        });
      }
      update({ legacyPicks: [] });
      const changes = quickPickChanges({
        cards: POSSIBILITIES,
        choices: draftRef.current.sort,
        entries: latest.current.entries,
        session: draftRef.current.flowSession,
        snapshots: draftRef.current.pickSnapshots,
        used: latest.current.intentions,
      });
      for (const change of changes) {
        const item = change.card;
        if (change.operation === "remove") {
          await removeEntry(change.entry!.id);
          latest.current = {
            ...latest.current,
            entries: latest.current.entries.filter(
              (entry) => entry.id !== change.entry!.id,
            ),
          };
          continue;
        }
        const saved = await saveEntry(
          entryInput("interest", item.title, {
            id: change.entry?.id || allocatedId(pickKey(item.id)),
            state: change.state!,
            source: pickSource(change.state!),
            body: item.description,
            meta: {
              onboarding_session: draftRef.current.flowSession,
              onboarding_key: pickKey(item.id),
              planet:
                item.domain === "Helping"
                  ? "Causes"
                  : item.domain === "People"
                    ? "People"
                    : "Passions",
            },
          }),
        );
        update({
          pickSnapshots: {
            ...draftRef.current.pickSnapshots,
            [item.id]: { id: saved.id, updated_at: saved.updated_at },
          },
        });
      }
      go(3);
    });
  const saveStory = (skip = false, dropDetail = false) =>
    run(async () => {
      const answer = draft.stories[storyIndex]?.trim() || "";
      if (skip || isUnreadyAnswer(answer)) await leaveOpen(storyQuestion);
      else {
        const detail = draft.followUps[storyIndex]?.trim() || "";
        const keepDetail =
          !dropDetail && (draft.followUp || draft.keptFollowUps[storyIndex]);
        const saved = await saveEntry(
          entryInput("story", storyQuestion, {
            body: storyBody(answer, detail, followUpQuestion, keepDetail),
            source: "First session · in your words",
          }),
        );
        await resolveQuestion(storyQuestion);
        setNotice("");
        if (draft.followUp) {
          const keptFollowUps = [...draftRef.current.keptFollowUps];
          keptFollowUps[storyIndex] = keepDetail && !isUnreadyAnswer(detail);
          const followUps = [...draftRef.current.followUps];
          if (!keptFollowUps[storyIndex]) {
            followUps[storyIndex] = "";
            await leaveOpen(followUpQuestion, `About: ${answer}`, [saved.id]);
          } else await resolveQuestion(followUpQuestion);
          update({ keptFollowUps, followUps });
        } else if (
          shouldOfferStoryFollowUp(answer, draft.automaticFollowUpOffered)
        ) {
          const followUpQuestions = [...draftRef.current.followUpQuestions];
          followUpQuestions[storyIndex] = storyFollowUp(storyIndex, answer);
          update({
            followUp: true,
            followUpQuestions,
            automaticFollowUpOffered: true,
          });
          return;
        }
      }
      update({ step: draft.step + 1, followUp: false });
    });
  const saveGrowth = (skip = false) =>
    run(async () => {
      if (skip || isUnreadyAnswer(draft.growth))
        await leaveOpen(GROWTH_QUESTION);
      else {
        if (
          !entriesOf(latest.current, "interest").some(
            (e) => e.title.toLowerCase() === draft.growth.trim().toLowerCase(),
          )
        )
          await saveEntry(
            entryInput("interest", draft.growth.trim(), {
              state: "spark",
              source: "Something you want to grow into",
              meta: { planet: "Grow" },
            }),
          );
        await resolveQuestion(GROWTH_QUESTION);
        setNotice("");
      }
      update({ step: 7 });
    });
  const saveWhy = (skip = false) =>
    run(async () => {
      if (skip || isUnreadyAnswer(draft.why)) await leaveOpen(WHY_QUESTION);
      else {
        const body = draft.why.trim();
        if (
          !entriesOf(latest.current, "why").some(
            (e) => e.state === "accepted" && e.body === body,
          )
        )
          await saveEntry(
            entryInput("why", "My first why", {
              body,
              state: "accepted",
              source: "Written and kept by you",
              source_ids: entriesOf(latest.current, "story").map((e) => e.id),
            }),
            true,
          );
        await resolveQuestion(WHY_QUESTION);
        setNotice("");
      }
      update({ step: 8 });
    });
  const keepProposal = (proposal: OnboardingProposal) =>
    run(async () => {
      const valid = validatedOnboardingInsights(
        { proposals: [proposal] },
        storyInputs,
      ).proposals[0];
      if (!valid)
        throw new Error(
          "This clue changed with your story. Please look at it again.",
        );
      const existing = latest.current.entries.find(
        (entry) =>
          entry.kind === valid.kind &&
          entry.title.toLowerCase() === valid.title.toLowerCase(),
      );
      if (!existing) {
        const key = `proposal:${proposalKey(valid)}`;
        await saveEntry(
          entryInput(valid.kind, valid.title, {
            id: allocatedId(key),
            body: valid.body,
            state:
              valid.kind === "interest"
                ? "tried"
                : valid.kind === "value"
                  ? "trying"
                  : "active",
            source: "First session · a clue you chose to keep",
            source_ids: Array.from(
              new Set(
                valid.evidence
                  .map((piece) => savedStories[piece.story_index]?.id)
                  .filter((id): id is string => !!id),
              ),
            ),
            meta: {
              onboarding_session: draftRef.current.flowSession,
              onboarding_key: key,
              ...(valid.kind === "interest"
                ? { planet: "Passions" as const }
                : {}),
            },
          }),
        );
      }
      if (valid.kind === "value") update({ value: valid.title });
      setNotice(
        valid.kind === "person"
          ? "Kept with the people you admire."
          : valid.kind === "strength"
            ? "Kept with your strengths."
            : valid.kind === "value"
              ? "A value to try on."
              : "Kept in your Possibilities.",
      );
    });
  const askForInsights = async () => {
    if (!session || insightsBusy || busy) return;
    const requestOwner = session.user.id;
    const requestSources = storyFingerprint;
    setInsightsBusy(true);
    setError("");
    try {
      const { data: response, error: requestError } =
        await supabase.functions.invoke("chloe", {
          body: {
            action: "onboarding_insights",
            stories: storyInputs,
            picks: chosen.map((pick) => ({
              title: pick.title,
              choice: draft.sort[pick.id],
            })),
            growth: entriesOf(data, "interest").find(
              (entry) =>
                entry.title === draft.growth.trim() &&
                entry.source === "Something you want to grow into",
            )?.title,
          },
        });
      if (requestError) throw requestError;
      if (!alive.current || owner.current !== requestOwner) return;
      const currentStories = FIRST_SESSION_STORIES.map((question) => ({
        question,
        answer:
          entriesOf(latest.current, "story").find(
            (entry) => entry.title === question,
          )?.body || "",
      }));
      if (JSON.stringify(currentStories) !== requestSources) return;
      const insights = validatedOnboardingInsights(response, storyInputs);
      if (
        insights.follow_up &&
        !firstSessionQuestionAvailable(
          latest.current,
          insights.follow_up.question,
        )
      )
        insights.follow_up = null;
      update({ insights, insightSources: requestSources });
      setNotice(
        insights.proposals.length
          ? "Keep only what feels true to you."
          : "Nothing needs a label yet. Your stories are kept.",
      );
    } catch {
      if (alive.current && owner.current === requestOwner)
        setError(
          "Chloe couldn't look just now. Your stories are saved, and you can keep going.",
        );
    } finally {
      if (alive.current && owner.current === requestOwner)
        setInsightsBusy(false);
    }
  };
  const keepFollowUpQuestion = () =>
    run(async () => {
      const followUp = draft.insights.follow_up;
      if (
        !followUp ||
        draft.insightSources !== storyFingerprint ||
        !firstSessionQuestionAvailable(latest.current, followUp.question)
      )
        return;
      await leaveOpen(
        followUp.question,
        `About: ${storyInputs[followUp.story_index].answer}`,
        savedStories[followUp.story_index]
          ? [savedStories[followUp.story_index]!.id]
          : [],
      );
      update({ insights: { ...draftRef.current.insights, follow_up: null } });
    });
  const saveValue = () =>
    run(async () => {
      if (
        draft.value &&
        !entriesOf(latest.current, "value").some((e) => e.title === draft.value)
      )
        await saveEntry(
          entryInput("value", draft.value, {
            state: "trying",
            source: "First session · a value you chose to try on",
          }),
        );
      go(9);
    });
  const saveAnchor = (which: "morning" | "evening", skip = false) =>
    run(async () => {
      const answer =
        which === "morning" ? draft.morningAnchor : draft.eveningAnchor;
      const question =
        which === "morning" ? MORNING_ANCHOR_QUESTION : EVENING_ANCHOR_QUESTION;
      const existing = entriesOf(latest.current, "preferences").find(
        (e) => e.title === "Check-in anchors",
      );
      const unanswered = skip || isUnreadyAnswer(answer);
      if (unanswered) await leaveOpen(question);
      else {
        await saveEntry(
          entryInput("preferences", "Check-in anchors", {
            source: "Your daily rhythm",
            meta: { ...existing?.meta, [`${which}_anchor`]: answer.trim() },
          }),
        );
        await resolveQuestion(question);
        setNotice("");
      }
      if (which === "evening")
        await saveProfile({ ...latest.current.profile, onboarded: true });
      update({ step: which === "morning" ? 11 : 13 });
    });
  const saveTime = (which: "morning" | "evening", skip = false) =>
    run(async () => {
      const time = which === "morning" ? draft.morningTime : draft.eveningTime;
      if (!skip && !validCheckInTime(time))
        throw new Error("Use a time like 08:00 or 20:30.");
      await saveProfile({
        ...latest.current.profile,
        ...(skip ? {} : { [`${which}_time`]: time }),
        ...(which === "evening" ? { onboarded: true } : {}),
      });
      if (!skip) update({ reminderTimesChosen: true });
      go(which === "morning" ? 12 : 13);
    });
  const summaryInterests = entriesOf(data, "interest")
    .filter((entry) => !["ember", "paused", "on_pause"].includes(entry.state))
    .slice(0, 2);
  const confirmedThreads = data.entries.filter(
    (entry) =>
      entry.meta.onboarding_session === draft.flowSession &&
      entry.meta.onboarding_key?.startsWith("proposal:") &&
      entry.kind !== "interest",
  );
  if (!ready || draft.flowVersion !== 3)
    return (
      <ActivityIndicator accessibilityLabel="Restoring your first session" />
    );
  return (
    <Page
      key={draft.step}
      header={
        <TopBar
          title="Find your possibilities"
          onBack={() => {
            if (busy) return;
            if (draft.followUp) update({ followUp: false });
            else if (draft.step > 0) go(previousFirstSessionStep(draft.step));
            else router.replace("/");
          }}
        />
      }
      footer={
        <>
          <Notice text={notice} />
          <Notice text={error || draftError} tone="error" />
        </>
      }
    >
      {draft.step === 0 && (
        <>
          <Body>
            Your reflections stay private, are never sold, and can be deleted
            anytime.
          </Body>
          <Eyebrow>About five minutes · three small steps</Eyebrow>
          <Title>Find your possibilities.</Title>

          <Body>
            Your why will evolve as you live. You don’t need every answer today,
            and you can skip any question.
          </Body>
          <Body>
            Quick picks. A few stories. A first look at who you want to become.
          </Body>
          <Button label="Let's begin" onPress={() => go(1)} />
          <TextButton
            label="Choose one small thing instead"
            onPress={() => router.replace("/ritual")}
          />
        </>
      )}
      {draft.step === 1 && (
        <>
          <Eyebrow>Quick picks · What could I love?</Eyebrow>
          <Body style={{ fontSize: 13 }}>
            Pick what draws you. Continue whenever you have a starting point.
          </Body>
          {card ? (
            <>
              <Image
                source={SPARK_ART[card.image as keyof typeof SPARK_ART]}
                style={{ width: "100%", height: 210, borderRadius: 24 }}
              />
              <Title>{card.title}</Title>
              <Body>{card.description}</Body>
              <Button
                label="Curious"
                disabled={busy}
                onPress={() =>
                  update({
                    sort: { ...draft.sort, [card.id]: "curious" },
                    cursor: draft.cursor + 1,
                  })
                }
              />
              <Button
                secondary
                label="Already love"
                disabled={busy}
                onPress={() =>
                  update({
                    sort: { ...draft.sort, [card.id]: "love" },
                    cursor: draft.cursor + 1,
                  })
                }
              />
              <TextButton
                label="Not for me"
                onPress={() =>
                  !busy &&
                  update({
                    sort: { ...draft.sort, [card.id]: "pass" },
                    cursor: draft.cursor + 1,
                  })
                }
              />
            </>
          ) : (
            <>
              <Title>A few possibilities to begin with.</Title>
              <Body>You can keep discovering as you go.</Body>
            </>
          )}
          <View style={s.wrap}>
            {draft.cursor > 0 && (
              <Chip
                label="Undo last choice"
                onPress={() => {
                  if (busy) return;
                  const sort = { ...draft.sort };
                  delete sort[POSSIBILITIES[draft.cursor - 1].id];
                  update({ sort, cursor: draft.cursor - 1 });
                }}
              />
            )}
            {card && (
              <Chip
                label="Skip this card"
                onPress={() => !busy && update({ cursor: draft.cursor + 1 })}
              />
            )}
          </View>
          <Button
            secondary
            label={card ? "Continue with these" : "Continue"}
            loading={busy}
            onPress={savePicks}
          />
          <Body style={{ fontSize: 13 }}>
            Your place is saved. The full collection is always in Explore.
          </Body>
        </>
      )}
      {storyQuestion && (
        <>
          {storyIndex === 0 && !draft.followUp ? (
            <Body style={{ fontSize: 14 }}>{observation}</Body>
          ) : null}
          <Eyebrow>Short stories · Who am I?</Eyebrow>
          <Title>{draft.followUp ? followUpQuestion : storyQuestion}</Title>
          <Field
            label={draft.followUp ? "A little more" : "Your story"}
            multiline
            editable={!busy}
            placeholder="A few words are enough."
            maxLength={2000}
            value={
              (draft.followUp ? draft.followUps : draft.stories)[storyIndex] ||
              ""
            }
            onChangeText={(text) => {
              const answers = [
                ...(draft.followUp ? draft.followUps : draft.stories),
              ];
              answers[storyIndex] = text;
              update(
                draft.followUp ? { followUps: answers } : { stories: answers },
              );
            }}
          />
          <Button label="Continue" loading={busy} onPress={() => saveStory()} />
          {!draft.followUp &&
            !isUnreadyAnswer(draft.stories[storyIndex] || "") && (
              <TextButton
                label="There's a little more to this"
                onPress={() => {
                  if (busy) return;
                  const followUpQuestions = [...draft.followUpQuestions];
                  followUpQuestions[storyIndex] = storyFollowUp(
                    storyIndex,
                    draft.stories[storyIndex],
                  );
                  update({
                    followUp: true,
                    followUpQuestions,
                    automaticFollowUpOffered: true,
                  });
                }}
              />
            )}
          <TextButton
            label={
              draft.followUp ? "Keep just my story" : "I don't know yet · skip"
            }
            onPress={() => saveStory(!draft.followUp, draft.followUp)}
          />
        </>
      )}
      {draft.step === 6 && (
        <>
          <Eyebrow>Growth and your why · Who do I want to become?</Eyebrow>
          <Title>{GROWTH_QUESTION}</Title>
          <Field
            label="Something to grow into"
            multiline
            value={draft.growth}
            onChangeText={(growth) => update({ growth })}
            maxLength={500}
            placeholder="Something small is welcome."
          />
          <Body>
            We’ll keep it as a Maybe. It doesn’t need to become a plan today.
          </Body>
          <Button
            label="Keep this possibility"
            loading={busy}
            onPress={() => saveGrowth()}
          />
          <TextButton
            label="I don't know yet · skip"
            onPress={() => saveGrowth(true)}
          />
        </>
      )}
      {draft.step === 7 && (
        <>
          <Eyebrow>A living draft</Eyebrow>
          <Title>{WHY_QUESTION}</Title>
          <Field
            label="My why, in my words"
            multiline
            value={draft.why}
            onChangeText={(why) => update({ why })}
            maxLength={2000}
            placeholder="The kind of person I want to be…"
          />
          <Body>
            You can shape this anytime. If the words aren’t here yet, your why
            can be still forming.
          </Body>
          <Button
            label="Keep my first draft"
            loading={busy}
            onPress={() => saveWhy()}
          />
          <TextButton
            label="Still forming · skip"
            onPress={() => saveWhy(true)}
          />
        </>
      )}
      {draft.step === 8 && (
        <>
          <Eyebrow>Your first Possibilities</Eyebrow>
          <Title>A beginning, not a definition.</Title>
          <View style={s.card}>
            <Eyebrow>My why</Eyebrow>
            <Body>{currentWhy(data)?.body || "Still forming"}</Body>
            {!currentWhy(data) && summaryInterests.length ? (
              <Body style={{ fontSize: 13 }}>
                Emerging threads:{" "}
                {summaryInterests.map((entry) => entry.title).join(" · ")}
              </Body>
            ) : null}
          </View>
          {summaryInterests.length ? (
            <View style={s.card}>
              <Eyebrow>A little room to explore</Eyebrow>
              {summaryInterests.map((entry) => (
                <Body key={entry.id}>
                  {entry.title} · {interestState(data, entry)}
                </Body>
              ))}
              <TextButton
                label="See all my Possibilities"
                onPress={() => router.push("/galaxy")}
              />
            </View>
          ) : null}
          {confirmedThreads.length ? (
            <Body style={{ fontSize: 14 }}>
              Kept from your stories:{" "}
              {confirmedThreads.map((entry) => entry.title).join(" · ")}
            </Body>
          ) : null}
          {nextProposal ? (
            <View style={s.card}>
              <Eyebrow>
                {nextProposal.kind === "person"
                  ? "Someone you admire"
                  : nextProposal.kind === "strength"
                    ? "A possible strength"
                    : nextProposal.kind === "value"
                      ? "A value to try on"
                      : "From your stories"}
              </Eyebrow>
              <Title style={{ fontSize: 24, lineHeight: 31 }}>
                {nextProposal.title}
              </Title>
              <Body>{nextProposal.body}</Body>
              <Body style={{ fontSize: 13 }}>
                From “
                {nextProposal.evidence[0].quote.length > 180
                  ? `${nextProposal.evidence[0].quote.slice(0, 177)}…`
                  : nextProposal.evidence[0].quote}
                ”
              </Body>
              <Button
                label={
                  nextProposal.kind === "value"
                    ? `Try on ${nextProposal.title.toLowerCase()}`
                    : nextProposal.kind === "strength"
                      ? "Keep this strength"
                      : nextProposal.kind === "person"
                        ? "Keep this person and why"
                        : "Keep this possibility"
                }
                loading={busy}
                onPress={() => keepProposal(nextProposal)}
              />
              <TextButton
                label="Pass on this clue"
                onPress={() => {
                  if (busy) return;
                  update({
                    dismissedProposals: [
                      ...draftRef.current.dismissedProposals,
                      proposalKey(nextProposal),
                    ],
                  });
                  setNotice("");
                }}
              />
            </View>
          ) : savedStories.some(Boolean) ? (
            <Body style={{ fontSize: 14 }}>
              Your stories stay here, even without a label.
            </Body>
          ) : null}
          {fallbackValue && (
            <View style={s.card}>
              <Body>{fallbackValue} could be a value to try on.</Body>
              <Chip
                label={`Try on ${fallbackValue.toLowerCase()}`}
                selected={draft.value === fallbackValue}
                onPress={() =>
                  update({
                    value: draft.value === fallbackValue ? "" : fallbackValue,
                  })
                }
              />
            </View>
          )}
          {session && savedStories.some(Boolean) ? (
            <>
              <Button
                secondary
                label="Let Chloe look for a thread"
                loading={insightsBusy}
                disabled={busy}
                onPress={() => void askForInsights()}
              />
              <Body style={{ fontSize: 12 }}>
                Chloe uses AI to look at these stories. You choose what to keep.
              </Body>
            </>
          ) : null}
          {draft.insightSources === storyFingerprint &&
          draft.insights.follow_up &&
          firstSessionQuestionAvailable(
            data,
            draft.insights.follow_up.question,
          ) ? (
            <View style={s.card}>
              <Body>{draft.insights.follow_up.question}</Body>
              <Body style={{ fontSize: 13 }}>No need to answer now.</Body>
              <TextButton
                label="Keep this question for later"
                onPress={keepFollowUpQuestion}
              />
            </View>
          ) : null}
          <Button
            label="Find my check-in rhythm"
            loading={busy}
            onPress={saveValue}
          />
          <TextButton
            label="Leave the other clues for later"
            onPress={() => {
              update({ value: "", step: 9 });
              setNotice("");
            }}
          />
        </>
      )}
      {(draft.step === 9 || draft.step === 11) && (
        <>
          <Eyebrow>Your check-in anchors</Eyebrow>
          {draft.step === 9 && (
            <Body>
              So I can give you a heads-up when it’s time for a check-in, let’s
              connect it to something you already do.
            </Body>
          )}
          <Title>
            {draft.step === 9
              ? MORNING_ANCHOR_QUESTION
              : EVENING_ANCHOR_QUESTION}
          </Title>
          <Field
            label={draft.step === 9 ? "My morning anchor" : "My night anchor"}
            value={draft.step === 9 ? draft.morningAnchor : draft.eveningAnchor}
            onChangeText={(text) =>
              update(
                draft.step === 9
                  ? { morningAnchor: text }
                  : { eveningAnchor: text },
              )
            }
            maxLength={500}
            placeholder={
              draft.step === 9
                ? "After my first coffee…"
                : "After brushing my teeth…"
            }
          />
          <Button
            label="Keep this anchor"
            loading={busy}
            onPress={() => saveAnchor(draft.step === 9 ? "morning" : "evening")}
          />
          <TextButton
            label="Leave this for later"
            onPress={() =>
              saveAnchor(draft.step === 9 ? "morning" : "evening", true)
            }
          />
        </>
      )}
      {(draft.step === 10 || draft.step === 12) && (
        <>
          <Eyebrow>{draft.step === 10 ? "Morning" : "Night"} check-in</Eyebrow>
          <Title>About what time is that?</Title>
          <Field
            label="Time · HH:MM"
            value={draft.step === 10 ? draft.morningTime : draft.eveningTime}
            onChangeText={(text) =>
              update(
                draft.step === 10
                  ? { morningTime: text }
                  : { eveningTime: text },
              )
            }
            maxLength={5}
            placeholder={draft.step === 10 ? "08:00" : "20:30"}
          />
          <Body>
            {Platform.OS === "web"
              ? "I'll keep this rhythm for you. Next, you can add the reminders to your calendar, so they work when this page is closed."
              : "Your reminders and check-in days follow this phone’s local time. You can turn notifications on after this step."}
          </Body>
          <Button
            label="Keep this time"
            loading={busy}
            onPress={() => saveTime(draft.step === 10 ? "morning" : "evening")}
          />
          <TextButton
            label="Skip the time for now"
            onPress={() =>
              saveTime(draft.step === 10 ? "morning" : "evening", true)
            }
          />
        </>
      )}
      {draft.step === 13 && (
        <>
          <Eyebrow>One small thing, out in your life</Eyebrow>
          <Title>What will you do with it?</Title>
          <Body>Choose a small “I will” for today or tomorrow.</Body>
          <Body>
            Tonight I’ll ask how it went, and each time I’ll know you a bit
            better.
          </Body>
          <Button
            label="Choose my first I will"
            onPress={() =>
              router.replace({
                pathname: "/ritual",
                params: { ...(draft.value ? { value: draft.value } : {}) },
              })
            }
          />
          <TextButton
            label={
              draft.reminderTimesChosen
                ? "Adjust my reminder times"
                : "Set reminder times · optional"
            }
            onPress={() => go(10)}
          />
          {draft.reminderTimesChosen ? (
            <Body style={{ fontSize: 13 }}>
              Morning {data.profile.morning_time} · Night{" "}
              {data.profile.evening_time} · {data.profile.timezone}
            </Body>
          ) : null}
          {Platform.OS === "web" && draft.reminderTimesChosen ? (
            <>
              <Button
                secondary
                label="Add reminders to my calendar"
                onPress={() =>
                  run(async () => {
                    downloadReminderCalendar(
                      data.profile.morning_time,
                      data.profile.evening_time,
                      data.profile.timezone,
                    );
                    setNotice(
                      "Open the downloaded file in your calendar and accept the reminders. Enable calendar notifications to receive them.",
                    );
                  })
                }
              />
              <Body style={{ fontSize: 13 }}>
                Only generic reminders go into your calendar. Your stories stay
                here. You can change or stop the reminders in your calendar.
              </Body>
            </>
          ) : null}
          {Platform.OS !== "web" &&
            draft.reminderTimesChosen &&
            !remindersSet && (
              <Button
                secondary
                label="Turn on my reminders"
                loading={busy}
                onPress={() =>
                  run(async () => {
                    await saveProfile({
                      ...data.profile,
                      timezone: phoneTimeZone(),
                    });
                    await scheduleReminders(
                      data.profile.morning_time,
                      data.profile.evening_time,
                      data,
                    );
                    setRemindersSet(true);
                    setNotice("Your check-in reminders are set on this phone.");
                  })
                }
              />
            )}
          <TextButton
            label="See my Possibilities"
            onPress={() => router.replace("/galaxy")}
          />
          {!session && (
            <TextButton
              label="Save across devices · optional"
              onPress={() =>
                router.push({
                  pathname: "/account",
                  params: { returnTo: "/ritual", reason: "save" },
                })
              }
            />
          )}
        </>
      )}
    </Page>
  );
}

export default withAccount(Onboarding);
