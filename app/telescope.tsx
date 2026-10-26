import React, { useState } from "react";
import { Image, View, useWindowDimensions } from "react-native";
import { useLocalSearchParams } from "expo-router";
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
  const params = useLocalSearchParams<{ horizon?: string; changed?: string }>();
  const [horizon, setHorizon] = useState<"year" | "life">(
    params.horizon === "life" ? "life" : "year",
  );
  return (
    <Vision
      key={horizon}
      {...{ horizon, setHorizon }}
      changed={params.changed === "true"}
    />
  );
}
function Vision({
  horizon,
  setHorizon,
  changed,
}: {
  horizon: "year" | "life";
  setHorizon: (h: "year" | "life") => void;
  changed: boolean;
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
      age: current?.meta.life_age || (90 as 80 | 90 | 100),
      notes:
        current?.meta.planet_notes || ({} as Partial<Record<Planet, string>>),
    },
  );
  const action = useAction();
  const [editing, setEditing] = useState(!current || changed),
    [area, setArea] = useState<Planet | null>(null),
    [message, setMessage] = useState("");
  const save = (source: string, reaffirm = false) =>
    action.run(async () => {
      const picture =
        reaffirm && current
          ? {
              text: current.body,
              notes: current.meta.planet_notes || {},
              age: current.meta.life_age || 90,
            }
          : draft;
      await putEntry(
        entryInput(
          "vision",
          horizon === "year"
            ? "One year out"
            : `Later in life · ${picture.age}`,
          {
            body: picture.text.trim(),
            source,
            meta: {
              horizon,
              version: versions.length + 1,
              planet_notes: picture.notes,
              life_age:
                horizon === "life" ? (picture.age as 80 | 90 | 100) : undefined,
            },
          },
        ),
      );
      setEditing(false);
      setMessage("A little space for the life you want. Saved privately.");
    });
  return (
    <Page
      header={<TopBar title="Future me" />}
      footer={
        !editing && current ? (
          <View style={{ gap: 8 }}>
            <Body>Is this still the life you want?</Body>
            <Button
              label="Still true"
              loading={action.busy}
              onPress={() => save("Reaffirmed by you", true)}
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
          label="One year out"
          selected={horizon === "year"}
          onPress={() => setHorizon("year")}
        />
        <Chip
          label="Later in life"
          selected={horizon === "life"}
          onPress={() => setHorizon("life")}
        />
      </View>
      {horizon === "life" && editing ? (
        <View style={s.wrap}>
          {([80, 90, 100] as const).map((age) => (
            <Chip
              key={age}
              label={`Me at ${age}`}
              selected={draft.age === age}
              onPress={() => update({ age })}
            />
          ))}
        </View>
      ) : null}
      <Body>
        {horizon === "year"
          ? "Picture a year from now, living the life you want. What’s in it?"
          : `Imagine you at ${draft.age}, looking back. What are you proud of? Who’s around you?`}
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
      {editing && horizon === "year" ? (
        <>
          <TextButton
            label="Add a little detail by area"
            onPress={() => setArea(area ? null : "Be")}
          />
          {area ? (
            <View style={s.wrap}>
              {PLANETS.slice(0, 5).map((planet) => (
                <Chip
                  key={planet}
                  label={planet}
                  selected={area === planet}
                  onPress={() => setArea(planet)}
                />
              ))}
            </View>
          ) : null}
          <Body style={{ fontSize: 13 }}>
            The areas you include help shape your mornings.
          </Body>
        </>
      ) : null}
      {PLANETS.slice(0, 5).map((planet) =>
        editing && area === planet ? (
          <Field
            key={planet}
            label={`${planet} · optional`}
            value={draft.notes[planet] || ""}
            onChangeText={(text) =>
              update({ notes: { ...draft.notes, [planet]: text } })
            }
            maxLength={200}
          />
        ) : !editing && current?.meta.planet_notes?.[planet] ? (
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
              update({
                text: v.body,
                notes: v.meta.planet_notes || {},
                age: v.meta.life_age || 90,
              });
              setEditing(true);
            }}
          />
        </View>
      ))}
    </Page>
  );
}
