import React, { useState } from "react";
import { View } from "react-native";
import { router } from "expo-router";
import { usePractice } from "../src/practice";
import { VALUES, INTERESTS } from "../src/domain";
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
export default function Onboarding() {
  const { data, session, saveProfile } = usePractice();
  const [step, setStep] = useState(0),
    [name, setName] = useState(data.profile.display_name),
    [person, setPerson] = useState(data.profile.north_star),
    [values, setValues] = useState<string[]>(data.profile.values),
    [interests, setInterests] = useState<string[]>(data.profile.interests),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const toggle = (item: string, items: string[], set: (v: string[]) => void) =>
    set(
      items.includes(item)
        ? items.filter((v) => v !== item)
        : items.length < 3
          ? [...items, item]
          : items,
    );
  const finish = async () => {
    setBusy(true);
    setError("");
    try {
      await saveProfile({
        ...data.profile,
        display_name: name.trim(),
        north_star: person.trim(),
        values,
        interests,
        onboarded: true,
      });
      router.replace("/ritual");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Page header={<TopBar title="A little about you" />}>
      <Eyebrow>{`GETTING TO KNOW YOU · ${step + 1} OF 3`}</Eyebrow>
      <Title>
        {
          [
            "Start with what\nfeels like you.",
            "Who brings out\nthe best in you?",
            "Leave room\nfor curiosity.",
          ][step]
        }
      </Title>
      <Body>
        {
          [
            "A few small things help make this practice yours.",
            "It could be someone you love, your community, or yourself.",
            "Choose up to three things you enjoy — or would love to try.",
          ][step]
        }
      </Body>
      {step === 0 ? (
        <>
          <Field
            label="WHAT SHOULD WE CALL YOU?"
            placeholder="Your first name"
            value={name}
            onChangeText={setName}
            maxLength={80}
          />
          <Body style={s.label}>CHOOSE UP TO THREE VALUES</Body>
          <View style={s.wrap}>
            {VALUES.map((v) => (
              <Chip
                key={v}
                label={v}
                selected={values.includes(v)}
                onPress={() => toggle(v, values, setValues)}
              />
            ))}
          </View>
          <Button
            label="Continue"
            disabled={!values.length}
            onPress={() => setStep(1)}
          />
        </>
      ) : step === 1 ? (
        <>
          <Illustration source={art.explore} height={220} />
          <Field
            label="MY NORTH STAR"
            placeholder="For example: myself, Sam, my family"
            value={person}
            onChangeText={setPerson}
            maxLength={100}
          />
          <Body style={{ fontSize: 13 }}>
            You can change this anytime. There is no right answer.
          </Body>
          <Button label="Continue" onPress={() => setStep(2)} />
        </>
      ) : (
        <>
          <Illustration source={art.explore} height={210} />
          <View style={s.wrap}>
            {INTERESTS.map((v) => (
              <Chip
                key={v}
                label={v}
                selected={interests.includes(v)}
                onPress={() => toggle(v, interests, setInterests)}
              />
            ))}
          </View>
          <Notice text={error} tone="error" />
          <Button
            label="Choose my first intention"
            loading={busy}
            onPress={finish}
          />
          <Body style={{ fontSize: 12, textAlign: "center" }}>
            {session
              ? "Your practice is saved privately in your account."
              : "Your practice starts privately on this device. You can connect an account whenever you’re ready."}
          </Body>
        </>
      )}
    </Page>
  );
}
