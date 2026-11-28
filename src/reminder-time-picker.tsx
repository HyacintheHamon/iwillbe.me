import React from "react";
import { Platform, View } from "react-native";
import { Body, C, F } from "./ui";
import { ScrollWheel } from "./scroll-wheel";

const hours = Array.from({ length: 24 }, (_, hour) => ({
  id: String(hour).padStart(2, "0"),
  label: String(hour).padStart(2, "0"),
}));
const minutes = Array.from({ length: 60 }, (_, minute) => ({
  id: String(minute).padStart(2, "0"),
  label: String(minute).padStart(2, "0"),
}));

/** A time control on web and two explicit, accessible wheels on phones. */
export function ReminderTimePicker({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const [hour = "08", minute = "00"] = value.split(":");
  return (
    <View style={{ gap: 8 }}>
      <Body style={{ fontFamily: F.strong }}>{label}</Body>
      {Platform.OS === "web" ? (
        React.createElement("input", {
          type: "time",
          "aria-label": label,
          value,
          step: 60,
          onChange: (event: React.ChangeEvent<HTMLInputElement>) =>
            onChange(event.target.value),
          style: {
            color: C.ink,
            background: C.white,
            border: `1px solid ${C.line}`,
            borderRadius: 12,
            padding: 12,
            minHeight: 48,
            fontSize: 20,
            fontFamily: "inherit",
            width: "100%",
            boxSizing: "border-box",
          },
        })
      ) : (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            borderWidth: 1,
            borderColor: C.line,
            borderRadius: 12,
          }}
        >
          <View style={{ flex: 1 }}>
            <ScrollWheel
              items={hours}
              value={hour}
              onChange={(next) => onChange(`${next}:${minute}`)}
              label={`${label} hours`}
            />
          </View>
          <Body>:</Body>
          <View style={{ flex: 1 }}>
            <ScrollWheel
              items={minutes}
              value={minute}
              onChange={(next) => onChange(`${hour}:${next}`)}
              label={`${label} minutes`}
            />
          </View>
        </View>
      )}
    </View>
  );
}
