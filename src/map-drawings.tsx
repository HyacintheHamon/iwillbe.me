import React from "react";
import Svg, { Circle, Line, Path } from "react-native-svg";
import { C } from "./ui";

export function MapDrawing({
  kind,
  size = 56,
  color = C.gold,
}: {
  kind: "target" | "sprout" | "compass" | "mountain";
  size?: number;
  color?: string;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64" accessible={false}>
      {kind === "target" && (
        <>
          <Circle
            cx="32"
            cy="32"
            r="29"
            fill="none"
            stroke={color}
            strokeWidth="1.5"
          />
          <Circle
            cx="32"
            cy="32"
            r="19"
            fill="none"
            stroke={color}
            strokeWidth="1.5"
          />
          <Circle cx="32" cy="32" r="8" fill={color} />
        </>
      )}
      {kind === "sprout" && (
        <>
          <Line
            x1="32"
            y1="51"
            x2="32"
            y2="28"
            stroke={color}
            strokeWidth="2"
            strokeLinecap="round"
          />
          <Path d="M32 33C16 34 10 23 10 14C26 14 33 23 32 33Z" fill={color} />
          <Path d="M32 29C32 15 43 9 55 9C55 24 43 31 32 29Z" fill={color} />
          <Line
            x1="7"
            y1="55"
            x2="57"
            y2="55"
            stroke={color}
            strokeWidth="1.5"
          />
          <Circle cx="14" cy="48" r="3" fill={color} opacity={0.6} />
          <Circle cx="51" cy="46" r="5" fill={color} opacity={0.6} />
        </>
      )}
      {kind === "compass" && (
        <>
          <Circle
            cx="32"
            cy="32"
            r="25"
            fill="none"
            stroke={C.ink}
            strokeWidth="2"
          />
          <Path d="M42 20L36 36L22 44L28 28Z" fill={color} />
          <Path d="M22 44L28 28L36 36Z" fill={C.ink} />
        </>
      )}
      {kind === "mountain" && (
        <>
          <Circle cx="47" cy="16" r="7" fill={color} />
          <Path d="M3 54L22 25L36 47L42 34L61 54Z" fill={C.ink} />
          <Path d="M17 32L22 25L27 33L22 30Z" fill={C.white} />
        </>
      )}
    </Svg>
  );
}
