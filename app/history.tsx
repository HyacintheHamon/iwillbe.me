import React from "react";
import { useLocalSearchParams } from "expo-router";
import { usePractice } from "../src/practice";
import { outcomeLabel } from "../src/domain";
import {
  Body,
  Eyebrow,
  Illustration,
  Page,
  Title,
  TopBar,
  art,
  s,
} from "../src/ui";
import { View } from "react-native";
export default function History() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data } = usePractice();
  const intention = data.intentions.find((i) => i.id === id);
  const reflection = data.checkIns.find((c) => c.intention_id === id);
  return (
    <Page header={<TopBar title="A moment in your story" />}>
      {intention ? (
        <>
          <Eyebrow>
            {intention.day} · {intention.value}
          </Eyebrow>
          <Title>{intention.action}</Title>
          <Body>For {intention.person || "myself"}</Body>
          <Illustration source={art.evening} height={230} />
          <View style={s.card}>
            <Eyebrow>YOUR REFLECTION</Eyebrow>
            <Body>
              {reflection
                ? outcomeLabel(reflection.outcome)
                : "You left this day open. That’s okay."}
            </Body>
            {!!reflection?.reflection && <Body>{reflection.reflection}</Body>}
          </View>
        </>
      ) : (
        <Body>This moment could not be found.</Body>
      )}
    </Page>
  );
}
