import React, { useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { usePractice } from "../src/practice";
import { dayLabel, type Intention, type Outcome } from "../src/domain";
import { draftKey, useDraft } from "../src/drafts";
import { ENERGY_LABELS, type Energy, type ValueChoice } from "../src/journey";
import { useToday } from "../src/use-today";
import {
  Body,
  Button,
  Chip,
  Eyebrow,
  Field,
  Illustration,
  Notice,
  Page,
  TextButton,
  Title,
  TopBar,
  s,
} from "../src/ui";
export default function Reflect() {
  const { data } = usePractice();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const today = useToday();
  const intention = data.intentions.find((i) =>
    id ? i.id === id : i.day === today,
  );
  if (!intention || intention.day > today)
    return (
      <Page header={<TopBar title="A moment to reflect" />}>
        <Title>{intention ? "A little early." : "A fresh moment."}</Title>
        <Body>
          {intention
            ? "Come back on the day of this intention to reflect."
            : "Choose an intention or revisit a moment in your history."}
        </Body>
        <Button
          label="View my history"
          onPress={() => router.replace("/history")}
        />
        <TextButton
          label="Choose an intention"
          onPress={() => router.replace("/ritual")}
        />
      </Page>
    );
  return (
    <ReflectionForm key={intention.id} intention={intention} today={today} />
  );
}
function ReflectionForm({
  intention,
  today,
}: {
  intention: Intention;
  today: string;
}) {
  const { data, session, checkIn } = usePractice();
  const prior = data.checkIns.find((c) => c.intention_id === intention.id);
  const { draft, update, clear, ready, draftError } = useDraft(
    draftKey(`reflect.${intention.id}`, session?.user.id),
    {
      outcome: prior?.outcome as Outcome | undefined,
      note: prior?.reflection || "",
      energy: prior?.energy || (null as Energy | null),
      value_choice: prior?.value_choice || (null as ValueChoice | null),
    },
  );
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [done, setDone] = useState(false);
  const save = async () => {
    if (!draft.outcome) return;
    setBusy(true);
    setError("");
    try {
      await checkIn({
        intention_id: intention.id,
        outcome: draft.outcome,
        reflection: draft.note.trim(),
        energy: draft.outcome === "not_yet" ? null : draft.energy,
        value_choice: intention.value ? draft.value_choice : null,
      });
      await clear();
      setDone(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  if (!ready)
    return <ActivityIndicator accessibilityLabel="Restoring your reflection" />;
  return (
    <Page
      header={
        <TopBar
          title={prior ? "Edit your reflection" : "A moment to reflect"}
        />
      }
      footer={
        !done && (
          <>
            <Notice text={error || draftError} tone="error" />
            <Button
              label={prior ? "Save my reflection" : "Keep this reflection"}
              disabled={!draft.outcome}
              loading={busy}
              onPress={save}
            />
          </>
        )
      }
    >
      <Eyebrow>
        {dayLabel(intention.day)}
        {intention.day < today ? " · LOOKING BACK" : ""}
      </Eyebrow>
      <Title>
        {done ? "You made space for yourself." : "Did you show up?"}
      </Title>
      {done ? (
        <>
          <Illustration
            source={require("../assets/illustrations/galaxy-night.jpg")}
            height={180}
          />
          <Body>
            {draft.outcome === "not_yet"
              ? "Some days are like that. Your stars stay with you."
              : "This small step is now part of your galaxy."}
          </Body>
          <Button
            label="See my galaxy"
            onPress={() => router.replace("/galaxy")}
          />
          <Button
            secondary
            label="Back to today"
            onPress={() => router.replace("/")}
          />
        </>
      ) : (
        <>
          <View style={s.card}>
            <Title style={{ fontSize: 23, lineHeight: 31 }}>
              {intention.action}
            </Title>
            <Body>
              {intention.value} · For {intention.person || "myself"}
            </Body>
          </View>
          {intention.day < today && (
            <Body>
              You’re reflecting on {dayLabel(intention.day)}. It’s never too
              late to notice what happened.
            </Body>
          )}
          <View style={s.wrap}>
            {(
              [
                { id: "yes", label: "I did" },
                { id: "partly", label: "A little" },
                { id: "not_yet", label: "Not this time" },
              ] as const
            ).map((o) => (
              <Chip
                key={o.id}
                label={o.label}
                selected={draft.outcome === o.id}
                onPress={() => update({ outcome: o.id })}
              />
            ))}
          </View>
          {draft.outcome && draft.outcome !== "not_yet" ? (
            <View style={{ gap: 12 }}>
              <Body>
                {intention.interest || "This experience"}: how did it feel?
              </Body>
              <View style={s.wrap}>
                {(["lit", "neutral", "drained"] as const).map((energy) => (
                  <Chip
                    key={energy}
                    label={ENERGY_LABELS[energy]}
                    selected={draft.energy === energy}
                    onPress={() =>
                      update({
                        energy: draft.energy === energy ? null : energy,
                      })
                    }
                  />
                ))}
              </View>
            </View>
          ) : null}
          {intention.value ? (
            <View style={{ gap: 12 }}>
              <Body>
                {intention.value}: would you choose it again, even when it is
                hard?
              </Body>
              <View style={s.wrap}>
                {(
                  [
                    ["yes", "Yes, it’s mine"],
                    ["not_sure", "Not sure"],
                    ["not_mine", "Not mine"],
                  ] as const
                ).map(([value_choice, label]) => (
                  <Chip
                    key={value_choice}
                    label={label}
                    selected={draft.value_choice === value_choice}
                    onPress={() =>
                      update({
                        value_choice:
                          draft.value_choice === value_choice
                            ? null
                            : value_choice,
                      })
                    }
                  />
                ))}
              </View>
              <Body style={{ fontSize: 13 }}>
                Values are tested by whether they are worth choosing, not by
                whether they feel easy.
              </Body>
            </View>
          ) : null}
          <Field
            label={
              draft.outcome === "not_yet"
                ? "WHAT GOT IN THE WAY?"
                : "WHAT DID YOU NOTICE?"
            }
            multiline
            placeholder="A sentence is enough. You can also leave this blank."
            value={draft.note}
            onChangeText={(note) => update({ note })}
            maxLength={2000}
          />
          <Body style={{ fontSize: 13 }}>
            No scores. No lost streaks. Editing a reflection updates this moment
            once.
          </Body>
        </>
      )}
    </Page>
  );
}
