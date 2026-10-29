import { withAccount } from "../src/access-gate";
import React, { useState } from "react";
import { View, useWindowDimensions } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { usePractice } from "../src/practice";
import { entriesOf, entryInput, PLANETS, type Planet } from "../src/journey";
import { useAction } from "../src/use-action";
import { draftKey, useDraft } from "../src/drafts";
import { newerPicturePossibility, proposeAreaMap } from "../src/guidance";
import { isUnreadyAnswer } from "../src/onboarding";
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
function Telescope() {
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
  const { draft, update, clear, ready } = useDraft(
    draftKey(`vision.${horizon}`, session?.user.id),
    {
      text: current?.body || "",
      age: current?.meta.life_age || (90 as 80 | 90 | 100),
      notes:
        current?.meta.planet_notes || ({} as Partial<Record<Planet, string>>),
      mapping: false,
    },
  );
  const action = useAction();
  const [editing, setEditing] = useState(!current || changed),
    [area, setArea] = useState<Planet | null>(null),
    [message, setMessage] = useState("");
  const [saved, setSaved] = useState(false),
    [archive, setArchive] = useState(false);
  const emerging = newerPicturePossibility(data, horizon);
  const reviewMap = () =>
    update({
      mapping: true,
      notes: { ...proposeAreaMap(draft.text), ...draft.notes },
    });
  const save = (source: string, reaffirm = false, withoutAreas = false) =>
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
              planet_notes: withoutAreas ? {} : picture.notes,
              life_age:
                horizon === "life" ? (picture.age as 80 | 90 | 100) : undefined,
            },
          },
        ),
      );
      if (!reaffirm) await clear();
      setEditing(false);
      setSaved(true);
      setMessage("A little space for the life you want. Saved privately.");
    });
  if (saved)
    return (
      <Page header={<TopBar title="Future me" />}>
        <Eyebrow>
          {horizon === "year" ? "One year out" : "Later in life"}
        </Eyebrow>
        <Title>There’s a little more direction.</Title>
        <Body>
          {horizon === "year"
            ? "Your confirmed areas can shape your mornings. Your earlier pictures are still here."
            : "Keep this picture lightly. There’s room for it to change as you live."}
        </Body>
        <Button
          label="Done for now"
          onPress={() =>
            router.canGoBack() ? router.back() : router.replace("/")
          }
        />
      </Page>
    );
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
      <Title>
        {editing && draft.mapping
          ? "Does this sorting feel right?"
          : "Look a little further."}
      </Title>
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
      {!draft.mapping || !editing ? (
        <Body>
          {horizon === "year"
            ? "Picture a year from now, living the life you want. What’s in it?"
            : `Imagine you at ${draft.age}, looking back. What are you proud of? Who’s around you?`}
        </Body>
      ) : (
        <Body>
          These are your words, tentatively sorted. Edit or remove anything
          before it guides your mornings.
        </Body>
      )}
      {!editing && current ? (
        <>
          <View
            style={{
              width: lens,
              height: lens,
              borderRadius: 24,
              borderWidth: 2,
              borderColor: C.line,
              overflow: "hidden",
              alignSelf: "center",
              alignItems: "center",
              justifyContent: "center",
              padding: 28,
              backgroundColor: C.white,
            }}
          >
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
      ) : ready && !draft.mapping ? (
        <Field
          label="The life I picture"
          multiline
          value={draft.text}
          onChangeText={(text) => update({ text, mapping: false })}
          placeholder="Calmer mornings, weekends outside, and my sisters close by…"
          maxLength={3000}
        />
      ) : null}
      {editing && horizon === "year" && !draft.mapping ? (
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
        editing && !draft.mapping && area === planet ? (
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
      {editing && draft.mapping ? (
        <>
          <View style={s.card}>
            <Body>{draft.text}</Body>
          </View>
          {PLANETS.slice(0, 5).map((planet) => (
            <View key={planet} style={s.card}>
              <Field
                label={planet}
                multiline
                value={draft.notes[planet] || ""}
                placeholder="Leave empty if it doesn’t belong here"
                onChangeText={(text) =>
                  update({ notes: { ...draft.notes, [planet]: text } })
                }
                maxLength={600}
              />
              {draft.notes[planet] ? (
                <TextButton
                  label={`Remove ${planet}`}
                  onPress={() =>
                    update({ notes: { ...draft.notes, [planet]: "" } })
                  }
                />
              ) : null}
            </View>
          ))}
          <TextButton
            label="Change my picture"
            onPress={() => update({ mapping: false })}
          />
        </>
      ) : null}
      {editing ? (
        <>
          <Button
            label={draft.mapping ? "Confirm these areas" : "Keep this picture"}
            disabled={isUnreadyAnswer(draft.text)}
            loading={action.busy}
            onPress={() =>
              horizon === "year" && !draft.mapping
                ? reviewMap()
                : save(
                    draft.mapping
                      ? "Written and sorted by you"
                      : "Written by you",
                  )
            }
          />
          {draft.mapping ? (
            <TextButton
              label="Keep my picture without area guidance"
              onPress={() =>
                save("Written by you · area guidance left open", false, true)
              }
            />
          ) : null}
          <TextButton
            label="Let this picture keep forming"
            onPress={() =>
              router.canGoBack() ? router.back() : router.replace("/")
            }
          />
        </>
      ) : null}
      {!editing && emerging ? (
        <View style={s.card}>
          <Body>
            You keep making room for {emerging.area.toLowerCase()}, including “
            {emerging.example}”. Should that be part of your One year out
            picture?
          </Body>
          <TextButton
            label="Try it in my draft"
            onPress={() => {
              update({
                notes: { ...draft.notes, [emerging.area]: emerging.example },
                mapping: true,
              });
              setEditing(true);
            }}
          />
        </View>
      ) : null}
      <Notice
        text={action.error || message}
        tone={action.error ? "error" : "normal"}
      />
      <TextButton
        label={archive ? "Close earlier pictures" : "Earlier pictures"}
        onPress={() => setArchive(!archive)}
      />
      {archive &&
        versions.map((v) => (
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

export default withAccount(Telescope);
