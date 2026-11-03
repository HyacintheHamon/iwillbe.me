import React from "react";
import { View } from "react-native";
import { Body, s } from "./ui";
export function SupportNotice({ level }: { level: number }) {
  return (
    <View accessibilityRole="alert" style={s.card}>
      <Body>
        {level >= 3
          ? "Your safety comes first. If you’re in immediate danger, contact local emergency services now. If you can, be with someone you trust and tell them what is happening."
          : "This deserves more support than an app can give. A doctor, therapist, or someone you trust can help you take the next step."}
      </Body>
      <Body>
        You can keep talking here. Your actions and reflections can wait.
      </Body>
    </View>
  );
}
