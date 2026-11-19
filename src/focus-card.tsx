import React from "react";
import { Pressable, View } from "react-native";
import { Body, Button, C, F } from "./ui";
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
  availableLevels = LEVELS,
  unavailableReasons = {},
}: {
  mission: Round2Mission | undefined;
  level: Level;
  onLevel: (level: Level) => void;
  onAccept: () => void;
  loading?: boolean;
  label?: string;
  disabled?: boolean;
  hideActions?: boolean;
  availableLevels?: Level[];
  unavailableReasons?: Partial<Record<Level, string>>;
}) {
  const harder = LEVELS.find(
    (candidate) =>
      LEVELS.indexOf(candidate) > LEVELS.indexOf(level) &&
      availableLevels.includes(candidate),
  );
  const easier = LEVELS.find(
    (candidate) =>
      LEVELS.indexOf(candidate) < LEVELS.indexOf(level) &&
      availableLevels.includes(candidate),
  );
  const next = harder || easier;
  const unavailable =
    unavailableReasons[level] ||
    (!harder && level !== "stretch"
      ? unavailableReasons.normal || unavailableReasons.stretch
      : "");
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
        {mission?.mission_text ||
          unavailable ||
          "No step fits this size right now. Try an easier size or write your own focus."}
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
      {!!mission && !!unavailable && (
        <Body style={{ color: "#E4DED6", fontSize: 13, lineHeight: 20 }}>
          {unavailable}
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
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              harder ? "Harder" : easier ? "Easier" : "Harder"
            }
            accessibilityState={{ disabled: !next || loading }}
            disabled={!next || loading}
            onPress={() => {
              if (next) onLevel(next);
            }}
            style={{
              minHeight: 44,
              minWidth: 60,
              justifyContent: "center",
              alignItems: "center",
              opacity: next ? 1 : 0.45,
            }}
          >
            <Body style={{ color: "#FFFFFF", fontFamily: F.medium }}>
              {harder ? "Harder" : easier ? "Easier" : "Harder"}
            </Body>
          </Pressable>
        </View>
      )}
    </View>
  );
}
