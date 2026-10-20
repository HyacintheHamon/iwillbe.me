import React, { useState } from "react";
import { Image, View } from "react-native";
import { router } from "expo-router";
import { usePractice } from "../src/practice";
import {
  entryInput,
  entriesOf,
  STORIES,
  REVIEW_QUESTIONS,
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
export default function Onboarding() {
  const { data, session, putEntry, saveProfile } = usePractice();
  const { draft, update, ready } = useDraft(
    draftKey("discovery", session?.user.id),
    {
      step: 0,
      cursor: 0,
      sort: {} as Record<string, string>,
      stories: ["", "", ""],
      why: "",
      scores: [null, null, null] as (number | null)[],
    },
  );
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const card = POSSIBILITIES[draft.cursor];
  const choose = (choice: string) =>
    update({
      sort: { ...draft.sort, [card.id]: choice },
      cursor: draft.cursor + 1,
    });
  const finish = async () => {
    setBusy(true);
    setError("");
    try {
      for (const item of POSSIBILITIES) {
        const choice = draft.sort[item.id];
        if (!choice || choice === "pass") continue;
        const prior = entriesOf(data, "interest").find(
          (e) => e.title === item.title,
        );
        if (!prior)
          await putEntry(
            entryInput("interest", item.title, {
              state: choice === "love" ? "love" : "spark",
              source:
                choice === "love"
                  ? "Already loved · self-reported"
                  : "Spark Sort · curious",
              body: item.description,
            }),
          );
      }
      for (let n = 0; n < 3; n++)
        if (draft.stories[n].trim())
          await putEntry(
            entryInput("story", STORIES[n], {
              id: entriesOf(data, "story").find((e) => e.title === STORIES[n])
                ?.id,
              body: draft.stories[n],
            }),
          );
      if (
        draft.why.trim() &&
        !entriesOf(data, "why").some((e) => e.body === draft.why.trim())
      )
        await putEntry(
          entryInput("why", "My first why", {
            body: draft.why.trim(),
            state: "accepted",
            source: "Written by you",
          }),
        );
      if (draft.scores.some((v) => v !== null))
        await putEntry(
          entryInput("review", "Starting point", {
            id: entriesOf(data, "review").find(
              (e) => e.meta.period === "baseline",
            )?.id,
            state: "done",
            meta: { period: "baseline", answers: draft.scores, version: 1 },
          }),
        );
      await saveProfile({ ...data.profile, onboarded: true });
      update({ step: 4 });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  if (!ready) return null;
  return (
    <Page
      header={
        <TopBar
          title="Find your sparks"
          onBack={() =>
            draft.step > 0
              ? update({ step: draft.step - 1 })
              : router.replace("/")
          }
        />
      }
      footer={<Notice text={error} tone="error" />}
    >
      {draft.step === 0 ? (
        <>
          <Eyebrow>A little curiosity. A little more you.</Eyebrow>
          <Title>What might light you up?</Title>
          <Image
            source={require("../assets/illustrations/galaxy-night.jpg")}
            style={{ width: "100%", height: 210, borderRadius: 28 }}
          />
          <Body>
            Start with a few possibilities. There are no right answers, and no
            account needed.
          </Body>
          <Button label="Find my sparks" onPress={() => update({ step: 1 })} />
          <TextButton
            label="Choose an intention instead"
            onPress={() => router.replace("/ritual")}
          />
        </>
      ) : null}
      {draft.step === 1 ? (
        <>
          <Eyebrow>Spark sort · {Math.min(draft.cursor + 1, 30)} of 30</Eyebrow>
          {card ? (
            <>
              <Image
                source={SPARK_ART[card.image as keyof typeof SPARK_ART]}
                style={{ width: "100%", height: 210, borderRadius: 24 }}
              />
              <Title>{card.title}</Title>
              <Body>{card.description}</Body>
              <Button label="I’m curious" onPress={() => choose("curious")} />
              <Button
                secondary
                label="I already love this"
                onPress={() => choose("love")}
              />
              <TextButton label="Not for me" onPress={() => choose("pass")} />
            </>
          ) : (
            <>
              <Title>Some sparks to begin with.</Title>
              <Body>You can discover more as you go.</Body>
            </>
          )}
          <View style={s.wrap}>
            {draft.cursor > 0 ? (
              <Chip
                label="Undo last choice"
                onPress={() => {
                  const sort = { ...draft.sort };
                  delete sort[POSSIBILITIES[draft.cursor - 1].id];
                  update({ cursor: draft.cursor - 1, sort });
                }}
              />
            ) : null}
            {card ? (
              <Chip
                label="Skip this card"
                onPress={() => update({ cursor: draft.cursor + 1 })}
              />
            ) : null}
          </View>
          <TextButton
            label={
              draft.cursor >= 12
                ? "Continue with my sparks"
                : "Continue for now"
            }
            onPress={() => update({ step: 2 })}
          />
          <Body style={{ fontSize: 13 }}>
            Your place is saved. You can always return to the full collection in
            Explore.
          </Body>
        </>
      ) : null}
      {draft.step === 2 ? (
        <>
          <Eyebrow>Three stories · all optional</Eyebrow>
          <Title>You already have clues.</Title>
          <Body>
            Write a few words, or leave these for another day. Your stories stay
            private.
          </Body>
          {STORIES.map((question, n) => (
            <Field
              key={question}
              label={question}
              multiline
              value={draft.stories[n]}
              maxLength={2000}
              onChangeText={(text) => {
                const stories = [...draft.stories];
                stories[n] = text;
                update({ stories });
              }}
            />
          ))}
          <Field
            label="A first why, in your words · optional"
            placeholder="I want to make room for…"
            multiline
            value={draft.why}
            onChangeText={(why) => update({ why })}
            maxLength={2000}
          />
          <Body>
            A why can still be forming. You can change it as you learn.
          </Body>
          <Button label="Continue" onPress={() => update({ step: 3 })} />
        </>
      ) : null}
      {draft.step === 3 ? (
        <>
          <Eyebrow>A private starting point · optional</Eyebrow>
          <Title>How has this month felt?</Title>
          <Body>
            These are for you. No target, no public score. Skip any question.
          </Body>
          {REVIEW_QUESTIONS.map((q, n) => (
            <View key={q} style={{ gap: 12 }}>
              <Body>{q}</Body>
              <View style={s.wrap}>
                {Array.from({ length: 11 }, (_, v) => (
                  <Chip
                    key={v}
                    label={String(v)}
                    selected={draft.scores[n] === v}
                    onPress={() => {
                      const scores = [...draft.scores];
                      scores[n] = scores[n] === v ? null : v;
                      update({ scores });
                    }}
                  />
                ))}
              </View>
              <Body style={{ fontSize: 12 }}>
                0 · Not at all 10 · Very much
              </Body>
            </View>
          ))}
          <Button label="See my galaxy" onPress={finish} loading={busy} />
        </>
      ) : null}
      {draft.step === 4 ? (
        <>
          <Eyebrow>Your starting galaxy</Eyebrow>
          <Title>A beginning, not a definition.</Title>
          <Body>
            {Object.values(draft.sort).filter((v) => v !== "pass").length}{" "}
            possibilities you chose. The ones you already love are marked as
            your own experience; the rest are sparks to try.
          </Body>
          <Button
            label="Explore my galaxy"
            onPress={() => router.replace("/galaxy")}
          />
          <Button
            secondary
            label="Choose my first intention"
            onPress={() => router.replace("/ritual")}
          />
          {!session ? (
            <TextButton
              label="Save across devices · optional"
              onPress={() =>
                router.push({
                  pathname: "/account",
                  params: { returnTo: "/galaxy", reason: "save" },
                })
              }
            />
          ) : null}
        </>
      ) : null}
    </Page>
  );
}
