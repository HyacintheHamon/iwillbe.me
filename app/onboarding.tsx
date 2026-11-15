import React, { useRef, useEffect } from "react";
import { View, Text } from "react-native";
import { router } from "expo-router";
import { withAccount } from "../src/access-gate";
import { usePractice } from "../src/practice";
import { useRound2 } from "../src/round2-store";
import { useAction } from "../src/use-action";
import { draftKey, useDraft } from "../src/drafts";
import { entryInput, REVIEW_QUESTIONS, type EntryInput } from "../src/journey";
import {
  PRIORITY_WORDS,
  QUICK_PICKS,
  FAITH_TRADITIONS,
  priorityName,
} from "../src/priorities";
import { strengthMatches } from "../src/round2";
import { recordQuickPicks } from "../src/onboarding-catalogue";
import {
  Body,
  Button,
  Chip,
  C,
  F,
  Field,
  Notice,
  Page,
  TextButton,
  Title,
  TopBar,
  s,
} from "../src/ui";
import { supabase } from "../src/supabase";
const WHO = [
  ["my kids", "with my kids"],
  ["my partner", "with my partner"],
  ["my parents", "with my parents"],
  ["friends", "with friends"],
  ["my team", "with my team"],
  ["my community", "in my community"],
  ["myself", "for myself"],
];
const WHERE = ["at home", "at work", "at school", "outdoors", "on the road"];
const PICK_STATE = {
  love: "into_it",
  like: "from_time_to_time",
  open: "want_to_try",
};
function Onboarding() {
  const { data, session, saveProfile, putEntry, removeEntry } = usePractice();
  const extra = useRound2();
  const action = useAction();
  const latest = useRef(data);
  useEffect(() => {
    latest.current = data;
  }, [data]);
  const { draft, update, ready, draftError } = useDraft(
    draftKey("onboarding.round2", session?.user.id),
    {
      step: 0,
      strength: "",
      help: "",
      important: [] as string[],
      working: [] as string[],
      faith: "",
      kid: "",
      cursor: 0,
      picks: {} as Record<string, string>,
      growth: "",
      who: [] as string[],
      where: [] as string[],
      customWho: "",
      customWhere: "",
      morning: "",
      night: "",
      why: "",
      baseline: [null, null, null] as (number | null)[],
      baselineIndex: 0,
    },
  );
  const persist = async (input: EntryInput) => {
    const old = latest.current.entries.find(
      (e) => e.kind === input.kind && e.title === input.title,
    );
    return putEntry({ ...input, id: old?.id, revision: old?.revision });
  };
  const go = (step = draft.step + 1) => update({ step });
  const proposed = PRIORITY_WORDS.find(
    (p) =>
      priorityName(
        draft.growth.replace(/^(being |be |more |being more )+/gi, ""),
      ) === p.name,
  )?.name;
  const saveInterests = async (text: string, kind: "kid" | "growth") => {
    if (!text.trim()) return;
    await persist(
      entryInput(
        "story",
        kind === "kid"
          ? "What did you love doing as a kid?"
          : "Is there something you’d like to get better at?",
        { body: text, source: "Start your map · in your words" },
      ),
    );
    const result = await supabase.functions.invoke("chloe", {
      body: { action: "round2_onboarding", kind, text },
    });
    let names: string[] = result.data?.interests || [];
    if (!names.length)
      names = QUICK_PICKS.filter(
        (p) =>
          text.toLowerCase().includes(p.title) ||
          text.toLowerCase().includes(p.title.split(" ")[0]),
      )
        .map((p) => p.title)
        .slice(0, 2);
    if (!names.length && text.trim().split(/\s+/).length <= 5)
      names = [text.trim().toLowerCase()];
    for (const name of names.slice(0, 2))
      if (
        !latest.current.entries.some(
          (e) => e.kind === "interest" && e.title === name,
        )
      )
        await persist(
          entryInput("interest", name, {
            state: "want_to_try",
            source: "Start your map · chosen by you",
          }),
        );
  };
  const next = () =>
    action.run(async () => {
      if (draft.step === 1 && draft.strength.trim())
        await persist(
          entryInput("story", "What do people often tell you you're good at?", {
            body: draft.strength,
            source: "Start your map · in your words",
          }),
        );
      if (draft.step === 2) {
        if (draft.help.trim())
          await persist(
            entryInput("story", "Who comes to you for help, and with what?", {
              body: draft.help,
              source: "Start your map · in your words",
            }),
          );
        let matches = strengthMatches(
          `${draft.strength} ${draft.help}`,
          PRIORITY_WORDS.map((p) => p.name),
        );
        const response = await supabase.functions.invoke("chloe", {
          body: {
            action: "round2_onboarding",
            kind: "strengths",
            text: `${draft.strength}\n${draft.help}`,
          },
        });
        if (Array.isArray(response.data?.priorities))
          matches = response.data.priorities
            .filter((p: string) => PRIORITY_WORDS.some((w) => w.name === p))
            .slice(0, 4);
        update({
          step: 3,
          important: draft.important.length ? draft.important : matches,
        });
        return;
      }
      if (draft.step === 4) {
        for (const name of draft.important)
          await persist(
            entryInput("value", name, {
              state: draft.working.includes(name) ? "working_on" : "important",
              source: "Chosen in Start your map",
            }),
          );
        go(draft.important.includes("guided by faith") ? 5 : 6);
        return;
      }
      if (draft.step === 5)
        await saveProfile({
          ...latest.current.profile,
          faith_tradition: draft.faith || null,
        });
      if (draft.step === 6) await saveInterests(draft.kid, "kid");
      if (draft.step === 8) {
        if (proposed) {
          if (!draft.important.includes(proposed))
            await persist(
              entryInput("value", proposed, {
                state: "important",
                source: "Getting better · confirmed by you",
              }),
            );
        } else await saveInterests(draft.growth, "growth");
      }
      if (draft.step === 9)
        for (const label of [
          ...draft.who,
          ...(draft.customWho.trim() ? [`with ${draft.customWho.trim()}`] : []),
        ])
          await extra.addPlace(label);
      if (draft.step === 10)
        for (const label of [
          ...draft.where,
          ...(draft.customWhere.trim() ? [draft.customWhere.trim()] : []),
        ])
          await extra.addPlace(label);
      if (draft.step === 11)
        await persist(
          entryInput("preferences", "Check-in anchors", {
            meta: {
              morning_anchor: draft.morning,
              evening_anchor: draft.night,
            },
            source: "Chosen check-in routine",
          }),
        );
      if (draft.step === 12 && draft.why.trim())
        await persist(
          entryInput("why", "My why", {
            body: draft.why,
            state: "accepted",
            source: "Your first draft",
          }),
        );
      if (draft.step === 13) {
        if (draft.baselineIndex < 2) {
          update({ baselineIndex: draft.baselineIndex + 1 });
          return;
        }
        await saveProfile({
          ...latest.current.profile,
          onboarded: true,
          values: draft.important,
          baseline_answers: draft.baseline,
        });
        go(14);
        router.replace("/");
        return;
      }
      go();
    });
  const pick = (choice: "love" | "like" | "open" | "pass") =>
    action.run(async () => {
      const card = QUICK_PICKS[draft.cursor];
      const old = latest.current.entries.find(
        (e) => e.kind === "interest" && e.title === card.title,
      );
      if (choice !== "pass")
        await persist(
          entryInput("interest", card.title, {
            state: PICK_STATE[choice],
            source: "Round 2 quick picks",
          }),
        );
      else if (old?.source === "Round 2 quick picks")
        await removeEntry(old.id, old.revision);
      await recordQuickPicks(
        { [card.id]: choice },
        "round2-onboarding",
        QUICK_PICKS,
      );
      update({
        picks: { ...draft.picks, [card.id]: choice },
        cursor: Math.min(14, draft.cursor + 1),
        step: draft.cursor === 14 ? 8 : 7,
      });
    });
  if (!ready) return null;
  const pinned = draft.step === 3 || draft.step === 4;
  const label =
    draft.step === 3
      ? `${draft.important.length} of 10 chosen`
      : draft.step === 4
        ? `${draft.working.length} of 3 chosen`
        : draft.step === 0
          ? "Start"
          : draft.step === 8 && proposed
            ? "Add this priority"
            : draft.step === 13 && draft.baselineIndex === 2
              ? "Go to Today"
              : "Next";
  const disabled =
    action.busy ||
    (draft.step === 3 && draft.important.length !== 10) ||
    (draft.step === 4 && draft.working.length !== 3);
  const buttons = (
    <>
      <Button
        label={label}
        disabled={disabled}
        loading={action.busy}
        onPress={next}
      />
      {![3, 4, 7].includes(draft.step) && draft.step > 0 && (
        <TextButton
          label="Skip"
          onPress={() => {
            if (draft.step === 2) {
              void next();
            } else if (draft.step === 13) {
              void action.run(async () => {
                await saveProfile({
                  ...latest.current.profile,
                  onboarded: true,
                  values: draft.important,
                  baseline_answers: draft.baseline,
                });
                router.replace("/");
              });
            } else go(draft.step === 5 ? 6 : draft.step + 1);
          }}
        />
      )}
      <Notice text={action.error || draftError} tone="error" />
    </>
  );
  const toggle = (
    key: "important" | "working" | "who" | "where",
    value: string,
    max = 99,
  ) => {
    const arr = draft[key];
    if (arr.includes(value))
      update({
        [key]: arr.filter((v) => v !== value),
        ...(key === "important"
          ? { working: draft.working.filter((v) => v !== value) }
          : {}),
      });
    else if (arr.length < max) update({ [key]: [...arr, value] });
  };
  return (
    <Page
      header={
        <>
          <TopBar
            title="Start your map"
            onBack={() =>
              draft.step ? go(draft.step - 1) : router.replace("/")
            }
          />
          <View style={{ height: 3, backgroundColor: C.line }}>
            <View
              style={{
                height: 3,
                width: `${Math.max(3, (draft.step / 14) * 100)}%`,
                backgroundColor: C.gold,
              }}
            />
          </View>
        </>
      }
      footer={pinned ? buttons : undefined}
      contentStyle={{ gap: 18 }}
    >
      {draft.step === 0 && (
        <>
          <Title>Let’s find who you want to be.</Title>
          <Body>
            Your answers will change over time. You can skip any question except
            the priority picks.
          </Body>
          <Body>
            Small on purpose. A few minutes a day, for about two months, is when
            it starts to stick.
          </Body>
        </>
      )}
      {draft.step === 1 && (
        <>
          <Title>What do people often tell you you’re good at?</Title>
          <Body>Even if it feels easy to you.</Body>
          <Field
            multiline
            label="In your words"
            value={draft.strength}
            onChangeText={(strength) => update({ strength })}
            maxLength={1500}
          />
        </>
      )}
      {draft.step === 2 && (
        <>
          <Title>Who comes to you for help, and with what?</Title>
          <Field
            multiline
            label="In your words"
            value={draft.help}
            onChangeText={(help) => update({ help })}
            maxLength={1500}
          />
        </>
      )}
      {draft.step === 3 && (
        <>
          <Title>Choose 10 that matter to you.</Title>
          <Body>You can change the words already ticked.</Body>
          <View style={s.wrap}>
            {[...PRIORITY_WORDS]
              .sort(
                (a, b) =>
                  Number(draft.important.includes(b.name)) -
                  Number(draft.important.includes(a.name)),
              )
              .map((p) => (
                <Chip
                  key={p.name}
                  label={`iwillbe.${p.name}`}
                  selected={draft.important.includes(p.name)}
                  onPress={() => toggle("important", p.name, 10)}
                />
              ))}
          </View>
        </>
      )}
      {draft.step === 4 && (
        <>
          <Title>Which 3 do you most want to work on?</Title>
          <View style={s.wrap}>
            {draft.important.map((p) => (
              <Chip
                key={p}
                label={`iwillbe.${p}`}
                selected={draft.working.includes(p)}
                onPress={() => toggle("working", p, 3)}
              />
            ))}
          </View>
        </>
      )}
      {draft.step === 5 && (
        <>
          <Title>Which tradition guides you?</Title>
          <Body>Optional, and private.</Body>
          <View style={s.wrap}>
            {FAITH_TRADITIONS.map((p) => (
              <Chip
                key={p}
                label={p}
                selected={draft.faith === p}
                onPress={() => update({ faith: p })}
              />
            ))}
          </View>
        </>
      )}
      {draft.step === 6 && (
        <>
          <Title>What did you love doing as a kid?</Title>
          <Field
            multiline
            label="What comes to mind?"
            value={draft.kid}
            onChangeText={(kid) => update({ kid })}
            maxLength={1500}
          />
        </>
      )}
      {draft.step === 7 && (
        <>
          <Body>What could you love?</Body>
          <View
            style={{
              minHeight: 170,
              justifyContent: "center",
              gap: 6,
              paddingVertical: 16,
            }}
          >
            <Text style={{ fontFamily: F.bold, fontSize: 28, color: C.navy }}>
              iwillbe.
            </Text>
            <Text
              style={{
                fontFamily: F.bold,
                fontSize: 28,
                lineHeight: 35,
                color: C.gold,
              }}
            >
              {QUICK_PICKS[draft.cursor].title}
            </Text>
            <Body>{QUICK_PICKS[draft.cursor].description}</Body>
          </View>
          <View style={{ gap: 10 }}>
            {(["love", "like", "open", "pass"] as const).map((v, i) => (
              <Button
                key={v}
                secondary={i !== 0}
                label={["Love it", "Like it", "Open to it", "Not now"][i]}
                loading={action.busy}
                onPress={() => pick(v)}
              />
            ))}
          </View>
          <TextButton label="I'm done with quick picks" onPress={() => go(8)} />
          <Notice text={action.error} tone="error" />
        </>
      )}
      {draft.step === 8 && (
        <>
          <Title>Is there something you’d like to get better at?</Title>
          <Field
            label="Something to grow into"
            value={draft.growth}
            onChangeText={(growth) => update({ growth })}
            maxLength={500}
          />
          {proposed && (
            <Body>That sounds like “{proposed}”. Add it as a priority?</Body>
          )}
        </>
      )}
      {(draft.step === 9 || draft.step === 10) && (
        <>
          <Title>
            {draft.step === 9
              ? "Who do you most want to show up for?"
              : "Where do you spend most of your day?"}
          </Title>
          <View style={s.wrap}>
            {(draft.step === 9 ? WHO : WHERE.map((x) => [x, x])).map(
              ([title, value]) => (
                <Chip
                  key={value}
                  label={title}
                  selected={(draft.step === 9
                    ? draft.who
                    : draft.where
                  ).includes(value)}
                  onPress={() =>
                    toggle(draft.step === 9 ? "who" : "where", value)
                  }
                />
              ),
            )}
          </View>
          <Field
            label="Add your own"
            value={draft.step === 9 ? draft.customWho : draft.customWhere}
            onChangeText={(value) =>
              update(
                draft.step === 9
                  ? { customWho: value }
                  : { customWhere: value },
              )
            }
            maxLength={100}
          />
        </>
      )}
      {draft.step === 11 && (
        <>
          <Title>When will you check in?</Title>
          <Field
            label="When will you check in each morning?"
            placeholder="after brushing my teeth"
            value={draft.morning}
            onChangeText={(morning) => update({ morning })}
            maxLength={300}
          />
          <Field
            label="When will you check in each night?"
            placeholder="after brushing my teeth"
            value={draft.night}
            onChangeText={(night) => update({ night })}
            maxLength={300}
          />
          <Body style={{ fontSize: 13, color: C.muted }}>
            You can set a reminder time in Me.
          </Body>
        </>
      )}
      {draft.step === 12 && (
        <>
          <Title>Who do you want to be remembered as?</Title>
          <Body>A first draft, in your words. You can shape it over time.</Body>
          <Field
            multiline
            label="My why"
            value={draft.why}
            onChangeText={(why) => update({ why })}
            maxLength={3000}
          />
        </>
      )}
      {draft.step === 13 && (
        <>
          <Title>A starting point</Title>
          <Body>{REVIEW_QUESTIONS[draft.baselineIndex]}</Body>
          <View style={s.wrap}>
            {Array.from({ length: 11 }, (_, n) => (
              <Chip
                key={n}
                label={String(n)}
                selected={draft.baseline[draft.baselineIndex] === n}
                onPress={() =>
                  update({
                    baseline: draft.baseline.map((v, i) =>
                      i === draft.baselineIndex ? n : v,
                    ),
                  })
                }
              />
            ))}
          </View>
          <Body style={{ fontSize: 13, color: C.muted }}>
            0 · Not at all. 10 · Very much. These stay private.
          </Body>
        </>
      )}
      {!pinned && draft.step !== 7 && buttons}
    </Page>
  );
}
export default withAccount(Onboarding);
