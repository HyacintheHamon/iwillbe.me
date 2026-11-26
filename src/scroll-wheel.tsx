import React, { useRef, useEffect, useState } from "react";
import { ScrollView, View, Text, Pressable, Platform } from "react-native";
import { C, F } from "./ui";

type Item = { id: string; label: string; isNew?: boolean };

/** Five quiet words, with a separate unhandled strip for scrolling the page. */
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
  const row = priority ? 46 : 34;
  const ref = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const selected = Math.max(
    0,
    items.findIndex((item) => item.id === value),
  );
  const positionKey = `${value}:${items.length}`;
  const [scrollPosition, setScrollPosition] = useState({
    key: positionKey,
    index: selected,
  });
  const visible =
    scrollPosition.key === positionKey ? scrollPosition.index : selected;
  const live = useRef({ items, onChange });
  useEffect(() => {
    live.current = { items, onChange };
  }, [items, onChange]);
  useEffect(() => {
    ref.current?.scrollTo({ y: selected * row, animated: true });
  }, [selected, row]);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  const settle = (y: number) => {
    const index = Math.max(
      0,
      Math.min(live.current.items.length - 1, Math.round(y / row)),
    );
    const item = live.current.items[index];
    if (!item) return;
    ref.current?.scrollTo({ y: index * row, animated: true });
    setScrollPosition({ key: positionKey, index });
    live.current.onChange(item.id);
  };
  const later = (y: number) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => settle(y), 140);
  };
  return (
    <View
      accessibilityLabel={label}
      style={{ height: row * 5, flexDirection: "row" }}
    >
      <View style={{ width: "72%", flexDirection: "row", overflow: "hidden" }}>
        {priority && (
          <View
            pointerEvents="none"
            style={{ width: 101, justifyContent: "center" }}
          >
            <Text style={{ fontFamily: F.bold, fontSize: 28, color: C.navy }}>
              iwillbe.
            </Text>
          </View>
        )}
        <ScrollView
          ref={ref}
          style={{ flex: 1 }}
          nestedScrollEnabled
          showsVerticalScrollIndicator={false}
          snapToInterval={row}
          decelerationRate="fast"
          scrollEventThrottle={16}
          onMomentumScrollBegin={() => {
            if (timer.current) clearTimeout(timer.current);
          }}
          onMomentumScrollEnd={(event) =>
            settle(event.nativeEvent.contentOffset.y)
          }
          onScrollEndDrag={(event) => later(event.nativeEvent.contentOffset.y)}
          onScroll={(event) => {
            const y = event.nativeEvent.contentOffset.y;
            setScrollPosition({
              key: positionKey,
              index: Math.max(
                0,
                Math.min(items.length - 1, Math.round(y / row)),
              ),
            });
            if (Platform.OS === "web") later(y);
          }}
          contentContainerStyle={{ paddingVertical: row * 2 }}
        >
          {items.map((item, index) => {
            const distance = Math.abs(index - visible);
            const size = priority
              ? distance === 0
                ? 38
                : distance === 1
                  ? 26
                  : 20
              : distance === 0
                ? 26
                : distance === 1
                  ? 20
                  : 16;
            return (
              <Pressable
                key={item.id}
                accessibilityRole="button"
                accessibilityLabel={`${label}: ${item.label}`}
                accessibilityState={{ selected: index === selected }}
                onPress={() => settle(index * row)}
                style={{
                  height: row,
                  justifyContent: "center",
                  paddingRight: 3,
                }}
              >
                <Text
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.5}
                  style={{
                    fontFamily: distance === 0 ? F.bold : F.medium,
                    fontSize: size,
                    lineHeight: row,
                    color: distance === 0 ? C.gold : C.navy,
                    opacity: distance === 0 ? 1 : distance === 1 ? 0.35 : 0.15,
                  }}
                >
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
      <View
        testID="wheel-page-scroll-margin"
        pointerEvents="none"
        style={{ flex: 1 }}
      />
    </View>
  );
}
