import React, { useState } from "react";
import { View } from "react-native";
import { router } from "expo-router";
import { usePractice } from "../src/practice";
import { currentWhy, entriesOf, entryInput } from "../src/journey";
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
  const current = currentWhy(data);
  const { draft, update, clear, ready } = useDraft(
    draftKey("why", session?.user.id),
    { text: current?.body || "", sources: [] as string[] },
  );
  const action = useAction();
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
      setSaved(true);
    });
  return (
    <Page header={<TopBar title="My why" />}>
      <Eyebrow>A direction, not a destination</Eyebrow>
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
      {versions
        .filter((v) => v.state === "proposed")
        .map((v) => (
          <View key={v.id} style={s.card}>
            <Eyebrow>A proposal · yours to shape</Eyebrow>
            <Body>{v.body}</Body>
            <TextButton
              label="Use these words in my draft"
              onPress={() => update({ text: v.body, sources: v.source_ids })}
            />
          </View>
        ))}
      <Eyebrow>Clues from your life</Eyebrow>
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
        .filter((i) =>
          data.checkIns.some(
            (c) => c.intention_id === i.id && c.energy === "lit",
          ),
        )
        .slice(0, 6)
        .map((i) => (
          <View key={i.id} style={s.card}>
            <Body>{i.action}</Body>
            <Body>{dayLabel(i.day)} · Lit you up</Body>
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
      <TextButton label="Keep my current why" onPress={() => router.back()} />
      <TextButton
        label="Explore this with Chloe"
        onPress={() =>
          router.push({ pathname: "/chloe", params: { mode: "why" } })
        }
      />
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
