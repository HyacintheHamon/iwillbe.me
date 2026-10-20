import React, { useState } from "react";
import { Image, View, useWindowDimensions } from "react-native";
import { usePractice } from "../src/practice";
import { entriesOf, entryInput, PLANETS, type Planet } from "../src/journey";
import { useAction } from "../src/use-action";
import { draftKey, useDraft } from "../src/drafts";
import {
  Body,
  C,
  F,
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
export default function Telescope() {
  const [horizon, setHorizon] = useState<"year" | "life">("year");
  return <Vision key={horizon} {...{ horizon, setHorizon }} />;
}
function Vision({
  horizon,
  setHorizon,
}: {
  horizon: "year" | "life";
  setHorizon: (h: "year" | "life") => void;
}) {
  const { data, session, putEntry } = usePractice();
  const { width } = useWindowDimensions();
  const lens = Math.min(width - 56, 330);
  const versions = entriesOf(data, "vision")
    .filter((e) => e.meta.horizon === horizon)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
  const current = versions[0];
  const { draft, update, ready } = useDraft(
    draftKey(`vision.${horizon}`, session?.user.id),
    {
      text: current?.body || "",
      notes:
        current?.meta.planet_notes || ({} as Partial<Record<Planet, string>>),
    },
  );
  const action = useAction();
  const [editing, setEditing] = useState(!current),
    [message, setMessage] = useState("");
  const save = (source: string) =>
    action.run(async () => {
      await putEntry(
        entryInput(
          "vision",
          horizon === "year" ? "A year from now" : "Me at 90",
          {
            body: draft.text.trim() || current?.body || "",
            source,
            meta: {
              horizon,
              version: versions.length + 1,
              planet_notes: draft.notes,
            },
          },
        ),
      );
      setEditing(false);
      setMessage("A little space for the life you want. Saved privately.");
    });
  return (
    <Page
      header={<TopBar title="The telescope" />}
      footer={
        !editing && current ? (
          <View style={{ gap: 8 }}>
            <Body>Is this still the life you want?</Body>
            <Button
              label="Still true"
              loading={action.busy}
              onPress={() => save("Reaffirmed by you")}
            />
            <View style={[s.row, { justifyContent: "center" }]}>
              <TextButton label="Tweak it" onPress={() => setEditing(true)} />
              <TextButton
                label="Something has changed"
                onPress={() => {
                  setEditing(true);
                  update({ text: "", notes: {} });
                }}
              />
            </View>
          </View>
        ) : undefined
      }
    >
      <Eyebrow>A life to move towards</Eyebrow>
      <Title>Look a little further.</Title>
      <View style={s.wrap}>
        <Chip
          label="A year from now"
          selected={horizon === "year"}
          onPress={() => setHorizon("year")}
        />
        <Chip
          label="Me at 90"
          selected={horizon === "life"}
          onPress={() => setHorizon("life")}
        />
      </View>
      <Body>
        {horizon === "year"
          ? "Imagine an ordinary day a year from now. Who is there? What fills it? How does it feel?"
          : "Imagine looking back at 90. What would you be glad you made room for? You can choose any later chapter that feels right."}
      </Body>
      {!editing && current ? (
        <>
          <View
            style={{
              width: lens,
              height: lens,
              borderRadius: lens / 2,
              borderWidth: 2,
              borderColor: C.line,
              overflow: "hidden",
              alignSelf: "center",
              alignItems: "center",
              justifyContent: "center",
              padding: 35,
            }}
          >
            <Image
              source={require("../assets/illustrations/galaxy-night.jpg")}
              style={{ position: "absolute", width: lens, height: lens }}
            />
            <Body
              numberOfLines={7}
              style={{
                fontFamily: F.serif,
                fontSize: 25,
                lineHeight: 33,
                color: C.navy,
                textAlign: "center",
              }}
            >
              {current.body}
            </Body>
          </View>
          {current.body.length > 180 ? <Body>{current.body}</Body> : null}
        </>
      ) : ready ? (
        <Field
          label="The life I picture"
          multiline
          value={draft.text}
          onChangeText={(text) => update({ text })}
          placeholder="Calmer mornings, weekends outside, and my sisters close by…"
          maxLength={3000}
        />
      ) : null}
      {PLANETS.slice(0, 5).map((planet) =>
        editing ? (
          <Field
            key={planet}
            label={`${planet} · optional`}
            value={draft.notes[planet] || ""}
            onChangeText={(text) =>
              update({ notes: { ...draft.notes, [planet]: text } })
            }
            maxLength={200}
          />
        ) : current?.meta.planet_notes?.[planet] ? (
          <View key={planet} style={s.row}>
            <Eyebrow>{planet}</Eyebrow>
            <Body style={{ flex: 1 }}>{current.meta.planet_notes[planet]}</Body>
          </View>
        ) : null,
      )}
      {editing ? (
        <Button
          label="Keep this picture"
          disabled={!draft.text.trim()}
          loading={action.busy}
          onPress={() => save("Written by you")}
        />
      ) : null}
      <Notice
        text={action.error || message}
        tone={action.error ? "error" : "normal"}
      />
      <Eyebrow>Earlier pictures</Eyebrow>
      {versions.map((v) => (
        <View key={v.id} style={s.card}>
          <Body>{v.body}</Body>
          <Body style={{ fontSize: 12 }}>
            {new Date(v.created_at).toLocaleDateString()} · {v.source}
          </Body>
          <TextButton
            label="Start from this picture"
            onPress={() => {
              update({ text: v.body, notes: v.meta.planet_notes || {} });
              setEditing(true);
            }}
          />
        </View>
      ))}
    </Page>
  );
}
