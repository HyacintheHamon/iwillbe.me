import React, { useRef, useEffect } from "react";
import { ScrollView, View, Text, Pressable, Platform } from "react-native";
import { C, F } from "./ui";
type Item = { id: string; label: string; isNew?: boolean };
const ROW = 48;
export function ScrollWheel({
  items,
  value,
  onChange,
  priority = false,
  label,
}: {
  items: Item[];
  value: string;
  onChange: (id: string) => void;
  priority?: boolean;
  label: string;
}) {
  const ref = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const selected = Math.max(
    0,
    items.findIndex((i) => i.id === value),
  );
  const live = useRef({ items, onChange });
  useEffect(() => {
    live.current = { items, onChange };
  }, [items, onChange]);
  useEffect(() => {
    ref.current?.scrollTo({ y: selected * ROW, animated: true });
  }, [selected]);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  const settle = (y: number) => {
    const i = Math.max(
      0,
      Math.min(live.current.items.length - 1, Math.round(y / ROW)),
    );
    const next = live.current.items[i];
    if (next) {
      ref.current?.scrollTo({ y: i * ROW, animated: true });
      live.current.onChange(next.id);
    }
  };
  return (
    <View
      accessibilityLabel={label}
      style={{
        height: ROW * 3,
        borderRadius: 22,
        backgroundColor: C.white,
        overflow: "hidden",
        borderWidth: 1,
        borderColor: C.line,
        flexDirection: "row",
      }}
    >
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          top: ROW,
          height: ROW,
          left: 8,
          right: 38,
          borderRadius: 12,
          backgroundColor: priority ? C.soft : "#F5F1EC",
        }}
      />
      {priority && (
        <Text
          pointerEvents="none"
          style={{
            position: "absolute",
            left: 18,
            top: ROW + 7,
            fontFamily: F.bold,
            fontSize: 26,
            color: C.navy,
          }}
        >
          iwillbe.
        </Text>
      )}
      <ScrollView
        ref={ref}
        style={{ flex: 1 }}
        nestedScrollEnabled
        showsVerticalScrollIndicator={false}
        snapToInterval={ROW}
        decelerationRate="fast"
        scrollEventThrottle={16}
        onMomentumScrollEnd={(e) => settle(e.nativeEvent.contentOffset.y)}
        onScroll={(e) => {
          if (Platform.OS === "web") {
            if (timer.current) clearTimeout(timer.current);
            const y = e.nativeEvent.contentOffset.y;
            timer.current = setTimeout(() => settle(y), 140);
          }
        }}
        contentContainerStyle={{ paddingVertical: ROW }}
      >
        {items.map((item, i) => (
          <Pressable
            key={item.id}
            accessibilityRole="button"
            accessibilityLabel={`${label}: ${item.label}`}
            accessibilityState={{ selected: i === selected }}
            onPress={() => {
              ref.current?.scrollTo({ y: i * ROW, animated: true });
              onChange(item.id);
            }}
            style={{
              height: ROW,
              paddingLeft: priority ? 118 : 20,
              paddingRight: 16,
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
            }}
          >
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.55}
              style={{
                flex: 1,
                fontFamily: i === selected ? F.bold : F.medium,
                fontSize: priority ? (i === selected ? 26 : 20) : 18,
                color: i === selected ? C.navy : C.muted,
              }}
            >
              {item.label}
            </Text>
            {item.isNew && (
              <Text
                style={{
                  backgroundColor: C.gold,
                  color: "#FFFFFF",
                  fontFamily: F.strong,
                  fontSize: 11,
                  paddingHorizontal: 6,
                  paddingVertical: 3,
                  borderRadius: 5,
                }}
              >
                new
              </Text>
            )}
          </Pressable>
        ))}
      </ScrollView>
      <View
        testID="wheel-page-scroll-margin"
        pointerEvents="none"
        style={{ width: 30, flexShrink: 0 }}
      />
    </View>
  );
}
