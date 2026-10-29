import { withAccount } from "../src/access-gate";
import React, { useState } from "react";
import { View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { usePractice } from "../src/practice";
import {
  currentWhy,
  currentVision,
  entriesOf,
  entryInput,
  nextWhyQuestion,
} from "../src/journey";
import {
  featuredWhyEvidence,
  sourceLabels,
  whyEvidence,
} from "../src/guidance";
import { useToday } from "../src/use-today";
import { dayLabel, shiftDay } from "../src/domain";
import { useAction } from "../src/use-action";
import { draftKey, useDraft } from "../src/drafts";
import { isUnreadyAnswer } from "../src/onboarding";
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

type Step = "evidence" | "question" | "draft" | "test" | "future";
function Why() {
  const { data, session, putEntry } = usePractice();
  const { revisit } = useLocalSearchParams<{ revisit?: string }>();
  const today = useToday();
  const revisiting = revisit === "true";
  const current = currentWhy(data);
  const [question] = useState(() => nextWhyQuestion(data, today));
  const priorThought = entriesOf(data, "story").find(
    (e) => e.meta.period === `why-thought:${today}` && e.title === question,
  );
  const { draft, update, clear, ready, draftError } = useDraft(
    draftKey(revisiting ? `why.revisit.${today}` : "why", session?.user.id),
    {
      text: current?.body || "",
      sources: current?.source_ids || ([] as string[]),
      step: "evidence" as Step,
      thought: "",
      thoughtId: priorThought?.id || "",
      thoughtRevision: priorThought?.revision ?? 0,
      horizon: "year" as "year" | "life",
      decision: "",
    },
  );
  const action = useAction();
  const [finished, setFinished] = useState(false),
    [archive, setArchive] = useState(false),
    [moreClues, setMoreClues] = useState(false);
  const clues = whyEvidence(data, today, revisiting);
  const featured = featuredWhyEvidence(clues);
  const shown = moreClues ? clues : featured;
  const versions = entriesOf(data, "why").sort((a, b) =>
    b.created_at.localeCompare(a.created_at),
  );
  const proposal = versions.find((v) => v.state === "proposed");
  const finish = async () => {
    if (revisiting) {
      const prior = entriesOf(data, "review").find(
        (e) => e.meta.period === `why:${today}`,
      );
      await putEntry(
        entryInput("review", "Why revisit", {
          id: prior?.id,
          state: "done",
          body: draft.thought.trim(),
          source_ids: draft.sources,
          meta: {
            period: `why:${today}`,
            why_revisited_at: new Date().toISOString(),
          },
        }),
      );
    }
    await clear();
    setFinished(true);
  };
  const nextAfterWhy = async (decision: string) => {
    if (revisiting) update({ step: "future", horizon: "year", decision });
    else await finish();
  };
  const keep = () =>
    action.run(async () => {
      if (isUnreadyAnswer(draft.text)) return;
      if (
        draft.text.trim() !== current?.body ||
        draft.sources.length !== current?.source_ids.length ||
        draft.sources.some((id) => !current?.source_ids.includes(id))
      )
        await putEntry(
          entryInput("why", "My why", {
            body: draft.text.trim(),
            state: "accepted",
            source: "Written and accepted by you",
            source_ids: draft.sources,
            meta: {
              version:
                versions.filter((v) => v.state === "accepted").length + 1,
            },
          }),
        );
      await nextAfterWhy("accepted");
    });
  const keepCurrent = () => action.run(() => nextAfterWhy("kept"));
  const saveThought = (skip = false) =>
    action.run(async () => {
      if (skip || isUnreadyAnswer(draft.thought)) {
        if (question) {
          const previous = entriesOf(data, "question").find(
            (e) => e.title === question,
          );
          if (previous?.state !== "stopped")
            await putEntry(
              entryInput("question", question, {
                id: previous?.id,
                state: "open",
                source: "A why question left to sit",
                meta: {
                  ...previous?.meta,
                  next_day: shiftDay(today, 2),
                  last_asked_at: new Date().toISOString(),
                  last_asked_session: `why:${today}`,
                },
              }),
            );
        }
      } else {
        const previous = entriesOf(data, "story").find(
          (e) =>
            e.meta.period === `why-thought:${today}` && e.title === question,
        );
        const story = await putEntry(
          entryInput("story", question || "A thought about my why", {
            id: draft.thoughtId || previous?.id,
            revision: draft.thoughtRevision,
            body: draft.thought.trim(),
            source: "A why reflection · in your words",
            meta: { period: `why-thought:${today}` },
          }),
        );
        update({ thoughtId: story.id, thoughtRevision: story.revision ?? 0 });
        const open = entriesOf(data, "question").find(
          (e) => e.title === question && e.state !== "stopped",
        );
        if (open)
          await putEntry({
            ...open,
            state: "answered",
            body: draft.thought.trim(),
          });
        update({
          sources: Array.from(new Set([...draft.sources, story.id])),
          thoughtId: story.id,
          thoughtRevision: story.revision ?? 0,
          step: "draft",
        });
        return;
      }
      update({ step: "draft" });
    });
  const advanceFuture = (reaffirm: boolean) =>
    action.run(async () => {
      const picture = currentVision(data, draft.horizon);
      if (reaffirm && picture)
        await putEntry(
          entryInput("vision", picture.title, {
            body: picture.body,
            source: "Reaffirmed at your why revisit",
            source_ids: picture.source_ids,
            meta: { ...picture.meta, version: (picture.meta.version || 1) + 1 },
          }),
        );
      if (!reaffirm) {
        const title =
          draft.horizon === "year"
            ? "One year out: is this still the life you want?"
            : "Later in life: does this picture still feel like you?";
        const previous = entriesOf(data, "question").find(
          (e) => e.title === title,
        );
        if (previous?.state !== "stopped")
          await putEntry(
            entryInput("question", title, {
              id: previous?.id,
              state: "open",
              source: "A future picture left to sit",
              meta: {
                next_day: shiftDay(today, 7),
                last_asked_at: new Date().toISOString(),
                last_asked_session: `why:${today}`,
              },
            }),
          );
      }
      if (draft.horizon === "year") update({ horizon: "life" });
      else await finish();
    });
  const askChloe = () => {
    const pieces = sourceLabels(data, draft.sources)
      .slice(0, 4)
      .map((text) => `“${text.length > 160 ? `${text.slice(0, 160)}…` : text}”`)
      .join("; ");
    router.push({
      pathname: "/chloe",
      params: {
        mode: "why",
        question: `Help me shape a why from the clues I chose${pieces ? `: ${pieces}` : "."}${draft.thought.trim() ? ` My thought today: ${draft.thought.trim().slice(0, 900)}${draft.thought.trim().length > 900 ? "…" : ""}` : ""} Offer a draft only if these pieces support it, and let me change it.`,
      },
    });
  };
  if (finished)
    return (
      <Page header={<TopBar title="My why" />}>
        <Eyebrow>A living draft</Eyebrow>
        <Title>Take this back into your life.</Title>
        <Body>
          Your why and earlier versions are here when you need them. Let your
          next small choice give it life.
        </Body>
        <Button label="Done for now" onPress={() => router.replace("/")} />
      </Page>
    );
  return (
    <Page
      header={
        <TopBar
          title="My why"
          onBack={() => {
            const previous: Partial<Record<Step, Step>> = {
              question: "evidence",
              draft: "question",
              test: "draft",
              future: "draft",
            };
            if (previous[draft.step]) update({ step: previous[draft.step]! });
            else if (router.canGoBack()) router.back();
            else router.replace("/galaxy");
          }}
        />
      }
    >
      <Eyebrow>
        {revisiting ? "Why revisit · about fifteen minutes" : "A living draft"}
      </Eyebrow>
      {!ready ? (
        <Body>Bringing your draft back…</Body>
      ) : (
        <>
          {draft.step === "evidence" ? (
            <>
              <Title>
                {current
                  ? "What your days are showing."
                  : "Your why can still be forming."}
              </Title>
              <Body>
                {revisiting
                  ? "A few moments from these past three months. Notice what still feels alive."
                  : "Start with something real. No perfect sentence required."}
              </Body>
              {current ? (
                <View style={s.card}>
                  <Eyebrow>Your current why</Eyebrow>
                  <Body>{current.body}</Body>
                </View>
              ) : null}
              {shown.map((clue) => (
                <View key={clue.id} style={s.card}>
                  <Eyebrow>
                    {clue.kind === "energy"
                      ? "What lit you up"
                      : clue.kind === "people"
                        ? "Who you showed up for"
                        : clue.kind === "value"
                          ? "A value you chose"
                          : "In your words"}
                  </Eyebrow>
                  <Body>{clue.title}</Body>
                  <Body>{clue.body}</Body>
                  <Body style={{ fontSize: 12 }}>{dayLabel(clue.day)}</Body>
                  <Chip
                    label={
                      draft.sources.includes(clue.id)
                        ? "Included as a clue"
                        : "Use as a clue"
                    }
                    selected={draft.sources.includes(clue.id)}
                    onPress={() =>
                      update({
                        sources: draft.sources.includes(clue.id)
                          ? draft.sources.filter((id) => id !== clue.id)
                          : [...draft.sources, clue.id],
                      })
                    }
                  />
                </View>
              ))}
              {!shown.length ? (
                <Body>
                  There’s no need to make a pattern out of thin air. A thought
                  from today is enough.
                </Body>
              ) : null}
              {clues.length > featured.length ? (
                <TextButton
                  label={
                    moreClues ? "Return to a few clues" : "Look at more moments"
                  }
                  onPress={() => setMoreClues(!moreClues)}
                />
              ) : null}
              <Button
                label="Make a little room"
                onPress={() =>
                  update({ step: question ? "question" : "draft" })
                }
              />
              <TextButton
                label={
                  current ? "Keep my current why" : "Let my why keep forming"
                }
                onPress={keepCurrent}
              />
            </>
          ) : draft.step === "question" ? (
            <>
              <Title>
                {question || "A thought about the person you’re becoming."}
              </Title>
              <Field
                label="One thought is enough"
                multiline
                value={draft.thought}
                onChangeText={(thought) => update({ thought })}
                maxLength={3000}
              />
              <Button
                label="Keep this thought"
                disabled={!draft.thought.trim()}
                loading={action.busy}
                onPress={() => saveThought()}
              />
              <TextButton
                label="I don’t know yet"
                onPress={() => saveThought(true)}
              />
            </>
          ) : draft.step === "draft" ? (
            <>
              <Title>Does this sound like you, or would you change it?</Title>
              <Body>
                Your words can stay unfinished. Keep what helps you choose how
                to live.
              </Body>
              {proposal ? (
                <View style={s.card}>
                  <Eyebrow>A possible why · yours to shape</Eyebrow>
                  <Body>{proposal.body}</Body>
                  <Body style={{ fontSize: 13 }}>
                    From{" "}
                    {sourceLabels(data, proposal.source_ids).join(" · ") ||
                      "the experiences you chose to share"}
                    .
                  </Body>
                  <TextButton
                    label="Use these words in my draft"
                    onPress={() =>
                      update({
                        text: proposal.body,
                        sources: proposal.source_ids,
                      })
                    }
                  />
                </View>
              ) : null}
              <Field
                label="In my words"
                multiline
                placeholder="I want to be someone who…"
                value={draft.text}
                onChangeText={(text) => update({ text })}
                maxLength={2000}
              />
              {draft.thought.trim() ? (
                <TextButton
                  label="Start with the thought I just kept"
                  onPress={() => update({ text: draft.thought.trim() })}
                />
              ) : null}
              <TextButton label="Shape a draft with Chloe" onPress={askChloe} />
              <Button
                label="Keep this version"
                disabled={isUnreadyAnswer(draft.text)}
                onPress={() => update({ step: "test" })}
              />
              <TextButton
                label={
                  current ? "Keep my current why" : "Let my why keep forming"
                }
                onPress={keepCurrent}
              />
            </>
          ) : draft.step === "test" ? (
            <>
              <Title>Would this help you choose between two options?</Title>
              <View style={s.card}>
                <Body>{draft.text}</Body>
              </View>
              {draft.sources.length ? (
                <Body style={{ fontSize: 13 }}>
                  The clues you chose:{" "}
                  {sourceLabels(data, draft.sources).join(" · ")}.
                </Body>
              ) : null}
              <Button
                label="Yes, use this why"
                loading={action.busy}
                onPress={keep}
              />
              <TextButton
                label="Shape it a little more"
                onPress={() => update({ step: "draft" })}
              />
              <TextButton
                label={current ? "Keep my current why" : "Let it keep forming"}
                onPress={keepCurrent}
              />
            </>
          ) : (
            <>
              <Eyebrow>
                {draft.horizon === "year" ? "One year out" : "Later in life"}
              </Eyebrow>
              <Title>
                {draft.horizon === "year"
                  ? "Is this still the life you want?"
                  : "Does this picture still feel like you?"}
              </Title>
              <View style={s.card}>
                <Body>
                  {currentVision(data, draft.horizon)?.body ||
                    "Still forming. You can give this picture a little room when you’re ready."}
                </Body>
              </View>
              {currentVision(data, draft.horizon) ? (
                <Button
                  label="Still true"
                  loading={action.busy}
                  onPress={() => advanceFuture(true)}
                />
              ) : null}
              <TextButton
                label={
                  currentVision(data, draft.horizon)
                    ? "Tweak this picture"
                    : "Picture this future"
                }
                onPress={() =>
                  router.push({
                    pathname: "/telescope",
                    params: { horizon: draft.horizon },
                  })
                }
              />
              <TextButton
                label="Let this sit for now"
                onPress={() => advanceFuture(false)}
              />
            </>
          )}
          <Notice text={action.error || draftError} tone="error" />
          {draft.step === "evidence" || draft.step === "draft" ? (
            <>
              <TextButton
                label={archive ? "Close earlier versions" : "Earlier versions"}
                onPress={() => setArchive(!archive)}
              />
              {archive &&
                versions
                  .filter((v) => v.state === "accepted")
                  .map((v) => (
                    <View key={v.id} style={s.card}>
                      <Body>{v.body}</Body>
                      <Body style={{ fontSize: 12 }}>
                        {new Date(v.created_at).toLocaleDateString()} ·{" "}
                        {v.source}
                      </Body>
                      <TextButton
                        label="Start from these words"
                        onPress={() =>
                          update({
                            text: v.body,
                            sources: v.source_ids,
                            step: "draft",
                          })
                        }
                      />
                    </View>
                  ))}
            </>
          ) : null}
        </>
      )}
    </Page>
  );
}

export default withAccount(Why);
