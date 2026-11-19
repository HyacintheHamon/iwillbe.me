import React from "react";
import { Text, View } from "react-native";
import { C, F, s } from "./ui";

/** Shared across Today, My map and Me; the day pill belongs to Today only. */
export function BrandHeader({ right }: { right?: React.ReactNode }) {
  return (
    <View
      style={[
        s.row,
        {
          justifyContent: "space-between",
          paddingHorizontal: 16,
          height: 58,
        },
      ]}
    >
      <Text
        accessibilityLabel="be.me"
        style={{ fontFamily: F.bold, fontSize: 22, color: C.navy }}
      >
        be<Text style={{ color: C.gold }}>.</Text>me
      </Text>
      {right}
    </View>
  );
}
