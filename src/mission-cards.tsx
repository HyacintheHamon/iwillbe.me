import React from "react";
import { Pressable, View } from "react-native";
import { Body, C, F, s } from "./ui";
import type { Mission } from "./missions";
export function MissionCards({
  missions,
  selected,
  onSelect,
}: {
  missions: Mission[];
  selected: string;
  onSelect: (mission: Mission) => void;
}) {
  return (
    <View style={{ gap: 12 }}>
      {missions.map((m) => (
        <Pressable
          key={m.id}
          accessibilityRole="button"
          accessibilityLabel={`${m.size === "5-minute" ? "5 minutes" : m.size}: ${m.mission_text}`}
          accessibilityState={{ selected: m.id === selected }}
          onPress={() => onSelect(m)}
          style={[
            s.card,
            {
              padding: 16,
              borderWidth: m.id === selected ? 2 : 1,
              borderColor: m.id === selected ? C.gold : C.line,
              backgroundColor: m.id === selected ? C.soft : C.white,
            },
          ]}
        >
          <Body style={{ fontFamily: F.strong, color: C.gold }}>
            {m.size === "5-minute" ? "5 minutes" : m.size}
            {m.id === selected ? " · Selected" : ""}
          </Body>
          <Body style={{ color: C.navy }}>{m.mission_text}</Body>
          <Body style={{ fontSize: 13 }}>
            {m.minutes} min · {m.cost}
          </Body>
          {m.first_step !== m.mission_text && (
            <Body style={{ fontSize: 14 }}>First step: {m.first_step}</Body>
          )}
          {!!m.safety_note && (
            <Body style={{ fontSize: 13 }}>{m.safety_note}</Body>
          )}
        </Pressable>
      ))}
    </View>
  );
}
