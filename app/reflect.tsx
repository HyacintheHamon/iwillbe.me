import React, { useState } from "react";
import { View } from "react-native";
import { router } from "expo-router";
import { usePractice } from "../src/practice";
import { type Outcome } from "../src/domain";
import {
  Body,
  Button,
  Chip,
  Eyebrow,
  Field,
  Illustration,
  Notice,
  Page,
  Title,
  TopBar,
  art,
  s,
} from "../src/ui";
import { useToday } from "../src/use-today";
export default function Reflect() {
  const { data, checkIn } = usePractice();
  const today = useToday();
  const intention = data.intentions.find((i) => i.day === today);
  const prior = data.checkIns.find((c) => c.intention_id === intention?.id);
  const [outcome, setOutcome] = useState<Outcome | undefined>(prior?.outcome),
    [note, setNote] = useState(prior?.reflection || ""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [done, setDone] = useState(false);
  const save = async () => {
    if (!intention || !outcome) return;
    setBusy(true);
    try {
      await checkIn({
        intention_id: intention.id,
        outcome,
        reflection: note.trim(),
      });
      setDone(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  if (!intention)
    return (
      <Page header={<TopBar title="Your evening ritual" />}>
        <Title>A fresh moment.</Title>
        <Body>Choose an intention first, then come back to reflect.</Body>
        <Button
          label="Choose an intention"
          onPress={() => router.replace("/ritual")}
        />
      </Page>
    );
  return (
    <Page header={<TopBar title="Your evening ritual" />}>
      <Eyebrow>
        {done ? "YOUR DAY, HELD WITH CARE" : "A MOMENT TO LOOK BACK"}
      </Eyebrow>
      <Title>
        {done
          ? "You made space\nfor yourself."
          : "How did your\nintention feel?"}
      </Title>
      <Illustration source={art.evening} height={230} />
      {done ? (
        <>
          <Body>
            {outcome === "not_yet"
              ? "Some days are like that. Your stars stay with you, and tomorrow is a fresh invitation."
              : "This small step is now part of your galaxy. Let that be enough for today."}
          </Body>
          <Button
            label="See my galaxy"
            onPress={() => router.replace("/galaxy")}
          />
          <Button
            label="Back to today"
            secondary
            onPress={() => router.replace("/")}
          />
        </>
      ) : (
        <>
          <View style={s.card}>
            <Body
              style={{
                fontFamily: "Fraunces_500Medium",
                fontSize: 21,
                lineHeight: 29,
              }}
            >
              {intention.action}
            </Body>
            <Eyebrow>
              {intention.value} · FOR {intention.person || "MYSELF"}
            </Eyebrow>
          </View>
          <View style={s.wrap}>
            {(
              [
                { id: "yes", label: "I did" },
                { id: "partly", label: "A little" },
                { id: "not_yet", label: "Not today" },
              ] as const
            ).map((o) => (
              <Chip
                key={o.id}
                label={o.label}
                selected={outcome === o.id}
                onPress={() => setOutcome(o.id)}
              />
            ))}
          </View>
          <Field
            label={
              outcome === "not_yet"
                ? "WHAT GOT IN THE WAY?"
                : "WHAT DID YOU NOTICE?"
            }
            multiline
            placeholder="A sentence is enough. You can also leave this blank."
            value={note}
            onChangeText={setNote}
            maxLength={2000}
          />
          <Notice text={error} tone="error" />
          <Button
            label="Close my day"
            disabled={!outcome}
            loading={busy}
            onPress={save}
          />
          <Body style={{ textAlign: "center", fontSize: 12 }}>
            No scores. No lost streaks. Just a little more understanding.
          </Body>
        </>
      )}
    </Page>
  );
}
