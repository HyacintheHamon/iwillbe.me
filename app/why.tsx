import React, { useState } from "react";
import { View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { usePractice } from "../src/practice";
import {
  currentWhy,
  currentVision,
  entriesOf,
  entryInput,
  valueState,
} from "../src/journey";
import { useToday } from "../src/use-today";
import { dayLabel } from "../src/domain";
import { useAction } from "../src/use-action";
import { draftKey, useDraft } from "../src/drafts";
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
export default function Why() {
  const { data, session, putEntry } = usePractice();
  const { revisit } = useLocalSearchParams<{ revisit?: string }>();
  const today = useToday();
  const revisiting = revisit === "true";
  const current = currentWhy(data);
  const { draft, update, clear, ready } = useDraft(
    draftKey("why", session?.user.id),
    { text: current?.body || "", sources: [] as string[] },
  );
  const action = useAction();
  const finishRevisit = async () => {
    if (!revisiting) return;
    const prior = entriesOf(data, "review").find(
      (e) => e.meta.period === `why:${today}`,
    );
    await putEntry(
      entryInput("review", "Why revisit", {
        id: prior?.id,
        state: "done",
        meta: {
          period: `why:${today}`,
          why_revisited_at: new Date().toISOString(),
        },
      }),
    );
  };
  const [saved, setSaved] = useState(false);
  const versions = entriesOf(data, "why").sort((a, b) =>
    b.created_at.localeCompare(a.created_at),
  );
  const keep = () =>
    action.run(async () => {
      await putEntry(
        entryInput("why", "My why", {
          body: draft.text.trim(),
          state: "accepted",
          source: "Written and accepted by you",
          source_ids: draft.sources,
          meta: { version: versions.length + 1 },
        }),
      );
      await clear();
      await finishRevisit();
      setSaved(true);
    });
  return (
    <Page header={<TopBar title="My why" />}>
      <Eyebrow>
        {revisiting ? "Why revisit · about fifteen minutes" : "A living draft"}
      </Eyebrow>
      <Title>
        {current
          ? "A why that grows with you."
          : "Your why can still be forming."}
      </Title>
      <Body>
        No perfect sentence required. Notice what gives your days meaning, who
        matters, and what you want to contribute.
      </Body>
      {current ? (
        <View style={s.card}>
          <Eyebrow>CURRENT WHY</Eyebrow>
          <Title style={{ fontSize: 24, lineHeight: 33 }}>{current.body}</Title>
        </View>
      ) : null}
      <View style={s.wrap}>
        {[
          ...entriesOf(data, "strength"),
          ...entriesOf(data, "value").filter(
            (e) => valueState(data, e) === "Mine",
          ),
        ].map((e) => (
          <Chip
            key={e.id}
            label={e.title}
            onPress={() => router.push("/galaxy")}
          />
        ))}
      </View>
      {versions
        .filter((v) => v.state === "proposed")
        .map((v) => (
          <View key={v.id} style={s.card}>
            <Eyebrow>A proposal · yours to shape</Eyebrow>
            <Body>{v.body}</Body>
            <Body style={{ fontSize: 13 }}>
              From{" "}
              {v.source_ids
                .map(
                  (id) =>
                    data.entries.find((e) => e.id === id)?.title ||
                    data.intentions.find((i) => i.id === id)?.action,
                )
                .filter(Boolean)
                .join(" · ") || "the experiences you chose to share"}
              .
            </Body>
            <Body>Would this help you choose between two options?</Body>
            <TextButton
              label="Use these words in my draft"
              onPress={() => update({ text: v.body, sources: v.source_ids })}
            />
          </View>
        ))}
      <Eyebrow>Clues from your life</Eyebrow>
      {revisiting ? (
        <Body>
          Recent moments, people you showed up for, and the values you kept
          choosing.
        </Body>
      ) : null}
      {entriesOf(data, "story").map((e) => (
        <View style={s.card} key={e.id}>
          <Body>{e.title}</Body>
          <Body>{e.body}</Body>
          <Chip
            label={
              draft.sources.includes(e.id)
                ? "Included as a clue"
                : "Use as a clue"
            }
            selected={draft.sources.includes(e.id)}
            onPress={() =>
              update({
                sources: draft.sources.includes(e.id)
                  ? draft.sources.filter((id) => id !== e.id)
                  : [...draft.sources, e.id],
              })
            }
          />
        </View>
      ))}
      {data.intentions
        .filter(
          (i) =>
            (!revisiting ||
              Date.parse(`${today}T12:00:00Z`) -
                Date.parse(`${i.day}T12:00:00Z`) <=
                93 * 86400000) &&
            data.checkIns.some(
              (c) =>
                c.intention_id === i.id &&
                c.outcome !== "not_yet" &&
                (c.energy === "lit" ||
                  c.value_choice === "yes" ||
                  (i.person && !/^(me|myself|for me)$/i.test(i.person))),
            ),
        )
        .slice(0, revisiting ? 12 : 6)
        .map((i) => (
          <View key={i.id} style={s.card}>
            <Body>{i.action}</Body>
            <Body>
              {dayLabel(i.day)} ·{" "}
              {data.checkIns.find((c) => c.intention_id === i.id)?.energy ===
              "lit"
                ? "Lit you up"
                : i.value &&
                    data.checkIns.find((c) => c.intention_id === i.id)
                      ?.value_choice === "yes"
                  ? `You chose ${i.value.toLowerCase()}`
                  : `For ${i.person}`}
            </Body>
            <Chip
              label="Use this moment"
              selected={draft.sources.includes(i.id)}
              onPress={() =>
                update({
                  sources: draft.sources.includes(i.id)
                    ? draft.sources.filter((id) => id !== i.id)
                    : [...draft.sources, i.id],
                })
              }
            />
          </View>
        ))}
      {ready ? (
        <Field
          label="In my words"
          multiline
          placeholder="I want to be someone who…"
          value={draft.text}
          onChangeText={(text) => {
            update({ text });
            setSaved(false);
          }}
          maxLength={2000}
        />
      ) : null}
      <Button
        label="Keep this version"
        disabled={!draft.text.trim()}
        loading={action.busy}
        onPress={keep}
      />
      <Notice
        text={
          saved
            ? "Your why is saved. Earlier versions are still yours."
            : action.error
        }
        tone={action.error ? "error" : "normal"}
      />
      <TextButton
        label="Keep my current why"
        onPress={() =>
          action.run(async () => {
            await finishRevisit();
            if (router.canGoBack()) router.back();
            else router.replace("/galaxy");
          })
        }
      />
      <TextButton
        label="Explore this with Chloe"
        onPress={() =>
          router.push({ pathname: "/chloe", params: { mode: "why" } })
        }
      />
      {revisiting ? (
        <>
          {(["year", "life"] as const).map((horizon) => (
            <View style={s.card} key={horizon}>
              <Eyebrow>
                {horizon === "year" ? "One year out" : "Later in life"}
              </Eyebrow>
              <Body>
                {currentVision(data, horizon)?.body || "Still forming."}
              </Body>
              <TextButton
                label="Look at this picture again"
                onPress={() =>
                  router.push({ pathname: "/telescope", params: { horizon } })
                }
              />
            </View>
          ))}
        </>
      ) : null}
      <Eyebrow>Earlier versions</Eyebrow>
      {versions
        .filter((v) => v.state === "accepted")
        .map((v) => (
          <View key={v.id} style={s.card}>
            <Body>{v.body}</Body>
            <Body style={{ fontSize: 12 }}>
              {new Date(v.created_at).toLocaleDateString()} · {v.source}
            </Body>
            {v.id !== current?.id ? (
              <TextButton
                label="Use these words again"
                onPress={() => update({ text: v.body, sources: v.source_ids })}
              />
            ) : null}
          </View>
        ))}
      <TextButton
        label="Return to my discovery stories"
        onPress={() => router.push("/onboarding")}
      />
    </Page>
  );
}
