import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Image, Platform, View } from "react-native";
import { router } from "expo-router";
import { usePractice } from "../src/practice";
import {
  entryInput,
  entriesOf,
  currentWhy,
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
import { scheduleReminders } from "../src/reminders";
import {
  FIRST_SESSION_STORIES,
  GROWTH_QUESTION,
  WHY_QUESTION,
  MORNING_ANCHOR_QUESTION,
  EVENING_ANCHOR_QUESTION,
  firstSessionStep,
  isUnreadyAnswer,
  pickObservation,
  quickPickState,
  suggestedFirstValue,
  validCheckInTime,
} from "../src/onboarding";

const FOLLOW_UP = "What about it stayed with you?";

export default function Onboarding() {
  const { data, session, putEntry, saveProfile } = usePractice();
  const anchors = entriesOf(data, "preferences").find(
    (e) => e.title === "Check-in anchors",
  );
  const { draft, update, ready, draftError } = useDraft(
    draftKey("discovery", session?.user.id),
    {
      flowVersion: 0,
      step: 0,
      cursor: 0,
      sort: {} as Record<string, string>,
      stories: ["", "", ""],
      followUps: ["", "", ""],
      followUp: false,
      growth: "",
      why: currentWhy(data)?.body || "",
      value: "",
      morningAnchor: anchors?.meta.morning_anchor || "",
      eveningAnchor: anchors?.meta.evening_anchor || "",
      morningTime: data.profile.morning_time,
      eveningTime: data.profile.evening_time,
    },
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [remindersSet, setRemindersSet] = useState(false);
  const latest = useRef(data);
  useEffect(() => {
    latest.current = data;
  }, [data]);
  const savedIds = useRef(new Map<string, string>());
  const inFlight = useRef(false);
  useEffect(() => {
    if (ready && draft.flowVersion !== 2)
      update({
        flowVersion: 2,
        step: firstSessionStep(draft.flowVersion, draft.step),
      });
  }, [ready, draft.flowVersion, draft.step, update]);
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
  const saveEntry = async (input: EntryInput, uniqueBody = false) => {
    const key = `${input.kind}:${input.title}${uniqueBody ? `:${input.body}` : ""}`;
    const prior = latest.current.entries.find(
      (entry) =>
        entry.kind === input.kind &&
        entry.title === input.title &&
        (!uniqueBody || entry.body === input.body),
    );
    const saved = await putEntry({
      ...input,
      id: prior?.id || savedIds.current.get(key),
    });
    savedIds.current.set(key, saved.id);
    latest.current = {
      ...latest.current,
      entries: [
        ...latest.current.entries.filter((entry) => entry.id !== saved.id),
        saved,
      ],
    };
    return saved;
  };
  const leaveOpen = async (question: string) => {
    const prior = entriesOf(latest.current, "question").find(
      (e) => e.title === question,
    );
    if (prior?.state !== "stopped")
      await saveEntry(
        entryInput("question", question, {
          state: "open",
          source: "First session · left open",
          meta: {
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
  const valueSuggestion = suggestedFirstValue(
    entriesOf(data, "story").map((entry) => entry.body),
    chosen.some((p) => draft.sort[p.id] === "curious"),
  );
  const storyIndex = draft.step - 3;
  const storyQuestion = FIRST_SESSION_STORIES[storyIndex];
  const savePicks = () =>
    run(async () => {
      for (const item of chosen) {
        if (
          entriesOf(latest.current, "interest").some(
            (e) => e.title === item.title,
          )
        )
          continue;
        await saveEntry(
          entryInput("interest", item.title, {
            state: quickPickState(draft.sort[item.id])!,
            source:
              draft.sort[item.id] === "love"
                ? "Already love · chosen by you"
                : "Quick picks · curious",
            body: item.description,
            meta: {
              planet:
                item.domain === "Helping"
                  ? "Causes"
                  : item.domain === "People"
                    ? "People"
                    : "Passions",
            },
          }),
        );
      }
      go(2);
    });
  const saveStory = (skip = false) =>
    run(async () => {
      const answer = draft.stories[storyIndex]?.trim() || "";
      if (skip || isUnreadyAnswer(answer)) await leaveOpen(storyQuestion);
      else {
        const detail = draft.followUps[storyIndex]?.trim();
        await saveEntry(
          entryInput("story", storyQuestion, {
            body: `${answer}${detail && !isUnreadyAnswer(detail) ? `\n\n${FOLLOW_UP}\n${detail}` : ""}`,
            source: "First session · in your words",
          }),
        );
        await resolveQuestion(storyQuestion);
        setNotice("");
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
      if (which === "evening" && unanswered)
        await saveProfile({ ...latest.current.profile, onboarded: true });
      update({
        step:
          which === "morning" ? (unanswered ? 11 : 10) : unanswered ? 13 : 12,
      });
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
      go(which === "morning" ? 11 : 13);
    });
  if (!ready || draft.flowVersion !== 2)
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
            else if (draft.step > 0) go(draft.step - 1);
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
          <Image
            source={require("../assets/illustrations/galaxy-night.jpg")}
            style={{ width: "100%", height: 200, borderRadius: 28 }}
          />
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
                  const sort = { ...draft.sort };
                  delete sort[POSSIBILITIES[draft.cursor - 1].id];
                  update({ sort, cursor: draft.cursor - 1 });
                }}
              />
            )}
            {card && (
              <Chip
                label="Skip this card"
                onPress={() => update({ cursor: draft.cursor + 1 })}
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
      {draft.step === 2 && (
        <>
          <Eyebrow>Your first clues</Eyebrow>
          <Title>A little of what draws you in.</Title>
          <Body>{observation}</Body>
          <Body>
            Curious becomes Maybe. What you already love starts as Into it.
          </Body>
          <Button label="A few short stories" onPress={() => go(3)} />
        </>
      )}
      {storyQuestion && (
        <>
          <Eyebrow>Short stories · Who am I?</Eyebrow>
          <Title>{draft.followUp ? FOLLOW_UP : storyQuestion}</Title>
          <Field
            label={draft.followUp ? "A little more" : "Your story"}
            multiline
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
                onPress={() => update({ followUp: true })}
              />
            )}
          <TextButton
            label={
              draft.followUp ? "Keep just my story" : "I don't know yet · skip"
            }
            onPress={() => saveStory(!draft.followUp)}
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
          </View>
          {chosen.slice(0, 5).map((item) => (
            <View key={item.id} style={s.card}>
              <Body>{item.title}</Body>
              <Eyebrow>
                {draft.sort[item.id] === "love" ? "Into it" : "Maybe"}
              </Eyebrow>
            </View>
          ))}
          {entriesOf(data, "interest").some(
            (entry) => entry.title === draft.growth.trim(),
          ) && (
            <View style={s.card}>
              <Body>{draft.growth}</Body>
              <Eyebrow>Maybe · Grow</Eyebrow>
            </View>
          )}
          <Body>{observation}</Body>
          {valueSuggestion && (
            <View style={s.card}>
              <Body>{valueSuggestion} could be a value to try on.</Body>
              <Chip
                label={`Try on ${valueSuggestion.toLowerCase()}`}
                selected={draft.value === valueSuggestion}
                onPress={() =>
                  update({
                    value:
                      draft.value === valueSuggestion ? "" : valueSuggestion,
                  })
                }
              />
            </View>
          )}
          <Button
            label="Find my check-in rhythm"
            loading={busy}
            onPress={saveValue}
          />
          <TextButton
            label="Choose my own value later"
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
              ? "I'll keep this rhythm for you. Notifications are available in the iOS and Android app; this browser won't send a reminder."
              : "This sets when to remind you on this phone. You can turn notifications on after this step."}
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
          {Platform.OS !== "web" && !remindersSet && (
            <Button
              secondary
              label="Turn on my reminders"
              loading={busy}
              onPress={() =>
                run(async () => {
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
