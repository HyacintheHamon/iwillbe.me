import React from "react";
import { Image, View } from "react-native";
import { router } from "expo-router";
import {
  Body,
  Button,
  Eyebrow,
  Page,
  TextButton,
  Title,
  TopBar,
  s,
} from "../src/ui";
export default function About() {
  return (
    <Page header={<TopBar title="iwillbe.me" />}>
      <Eyebrow>A little more you.</Eyebrow>
      <Title>A life that feels like yours.</Title>
      <Body>Noticing what matters can start with one small thing.</Body>
      <Image
        source={require("../assets/illustrations/galaxy-night.jpg")}
        style={{ width: "100%", height: 260, borderRadius: 28 }}
      />
      <Button
        label="Find my sparks"
        onPress={() => router.push("/onboarding")}
      />
      {[
        [
          "Discover",
          "Follow a curiosity, a story, or something you already love.",
        ],
        ["Try", "Choose one small action that fits a real day."],
        [
          "Notice",
          "Did it light you up? Is it something you would choose again?",
        ],
        [
          "Make it yours",
          "Let your galaxy and your why grow with your experience.",
        ],
      ].map(([title, body]) => (
        <View key={title} style={s.card}>
          <Title style={{ fontSize: 24, lineHeight: 31 }}>{title}</Title>
          <Body>{body}</Body>
        </View>
      ))}
      <Body>
        Begin on this device without an account. Connect when you want to save
        across devices or talk with Chloe. Your practice is private; you choose
        what to share.
      </Body>
      <TextButton
        label="Return to my practice"
        onPress={() => router.replace("/")}
      />
    </Page>
  );
}
