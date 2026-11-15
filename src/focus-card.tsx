import React from "react";
import { View } from "react-native";
import { Body, Button, C, F, TextButton } from "./ui";
import { LEVELS, type Level, type Round2Mission } from "./round2";
export function FocusCard({
  mission,
  level,
  onLevel,
  onAccept,
  loading = false,
  label = "I'll do this",
  disabled = false,
  hideActions = false,
}: {
  mission: Round2Mission | undefined;
  level: Level;
  onLevel: (level: Level) => void;
  onAccept: () => void;
  loading?: boolean;
  label?: string;
  disabled?: boolean;
  hideActions?: boolean;
}) {
  return (
    <View
      style={{
        backgroundColor: C.navy,
        borderRadius: 22,
        padding: 20,
        gap: 12,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Body style={{ color: "#FB923C", fontFamily: F.strong }}>
          {level === "easy"
            ? "Easy · 5 min"
            : level === "normal"
              ? `Normal${mission ? ` · ${mission.minutes} min` : ""}`
              : `Stretch${mission ? ` · ${mission.minutes} min` : ""}`}
        </Body>
        <View style={{ flexDirection: "row", gap: 5 }}>
          {LEVELS.map((l) => (
            <View
              key={l}
              style={{
                width: 6,
                height: 6,
                borderRadius: 3,
                backgroundColor: l === level ? "#FB923C" : "#68635D",
              }}
            />
          ))}
        </View>
      </View>
      {mission?.type === "learn" && (
        <Body style={{ color: "#FB923C", fontSize: 12, fontFamily: F.strong }}>
          Learn
        </Body>
      )}
      <Body
        style={{
          color: "#FFFFFF",
          fontSize: 19,
          lineHeight: 28,
          fontFamily: F.strong,
        }}
      >
        {mission?.mission_text || "Finding a step that fits…"}
      </Body>
      {!!mission?.first_step && (
        <Body style={{ color: "#E4DED6", fontSize: 14, lineHeight: 21 }}>
          {mission.first_step}
        </Body>
      )}
      {!!mission?.safety_note && (
        <Body style={{ color: "#E4DED6", fontSize: 13, lineHeight: 20 }}>
          {mission.safety_note}
        </Body>
      )}
      {!hideActions && (
        <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
          <View style={{ flex: 1 }}>
            <Button
              label={label}
              loading={loading}
              disabled={!mission || disabled}
              onPress={onAccept}
            />
          </View>
          <TextButton
            label={level === "stretch" ? "Easier" : "Harder"}
            color="#FFFFFF"
            onPress={() => onLevel(LEVELS[(LEVELS.indexOf(level) + 1) % 3])}
          />
        </View>
      )}
    </View>
  );
}
