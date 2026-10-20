import React, { useState } from "react";
import { View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { usePractice } from "../src/practice";
import { localDay, SUGGESTIONS, VALUES } from "../src/domain";
import {
  Body,
  Button,
  Chip,
  ChloeMark,
  Eyebrow,
  Field,
  Notice,
  Page,
  TextButton,
  Title,
  TopBar,
  s,
} from "../src/ui";
export default function Ritual() {
  const { data, saveIntention } = usePractice();
  const params = useLocalSearchParams<{
    value?: string;
    action?: string;
    person?: string;
  }>();
  const current = data.intentions.find((i) => i.day === localDay());
  const [value, setValue] = useState(
      params.value || current?.value || data.profile.values[0] || "Presence",
    ),
    [action, setAction] = useState(params.action || current?.action || ""),
    [person, setPerson] = useState(
      params.person || current?.person || data.profile.north_star || "",
    ),
    [review, setReview] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const save = async () => {
    setBusy(true);
    setError("");
    try {
      await saveIntention(action, value, person);
      router.replace("/");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Page header={<TopBar title="Your morning ritual" />}>
      <ChloeMark />
      <Eyebrow>{review ? "MAKE IT YOURS" : "ONE SMALL INTENTION"}</Eyebrow>
      <Title>
        {review
          ? "A small promise\nto carry with you."
          : "How would you like\nto show up today?"}
      </Title>
      {review ? (
        <>
          <View style={s.card}>
            <Eyebrow>TODAY, I WILL</Eyebrow>
            <Title style={{ fontSize: 27, lineHeight: 36 }}>{action}</Title>
            <Body>
              {value} · For {person || "myself"}
            </Body>
          </View>
          <Body>
            It doesn’t have to be perfect. This is something to come back to,
            not another thing to get right.
          </Body>
          <Notice text={error} tone="error" />
          <Button label="This is my intention" loading={busy} onPress={save} />
          <TextButton
            label="Make a small change"
            onPress={() => setReview(false)}
          />
        </>
      ) : (
        <>
          <Body>Pick a quality you want to bring into one real moment.</Body>
          <View style={s.wrap}>
            {Array.from(
              new Set([
                ...data.profile.values,
                ...data.profile.interests,
                ...VALUES.slice(0, 4),
              ]),
            )
              .slice(0, 9)
              .map((v) => (
                <Chip
                  key={v}
                  label={v}
                  selected={value === v}
                  onPress={() => setValue(v)}
                />
              ))}
          </View>
          <Field
            label="TODAY, I WILL…"
            multiline
            placeholder="One small, doable action"
            value={action}
            onChangeText={setAction}
            maxLength={500}
          />
          <View style={{ gap: 10 }}>
            <Eyebrow>A LITTLE INSPIRATION</Eyebrow>
            {(SUGGESTIONS[value] || SUGGESTIONS.Presence).map((text) => (
              <TextButton
                key={text}
                label={text}
                onPress={() => setAction(text)}
              />
            ))}
          </View>
          <Field
            label="FOR WHOM?"
            placeholder="Myself, someone I love…"
            value={person}
            onChangeText={setPerson}
            maxLength={120}
          />
          <Button
            label="Keep this intention"
            disabled={!action.trim()}
            onPress={() => setReview(true)}
          />
          <TextButton
            label="Talk it through with Chloe"
            onPress={() => router.push("/chloe")}
          />
        </>
      )}
    </Page>
  );
}
