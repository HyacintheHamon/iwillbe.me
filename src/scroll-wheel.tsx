import React, { useRef, useEffect, useState } from "react";
import { ScrollView, View, Text, Pressable, Platform } from "react-native";
import { C, F } from "./ui";

type Item = { id: string; label: string; isNew?: boolean };

/** A cyclic five-word picker, with a separate strip for scrolling the page. */
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
  const count = items.length;
  // Keep two full cycles on either side. Even a one-item wheel has five
  // populated rows; settling always returns to the visually identical middle.
  const middle = count * 2;
  const centre = middle + selected;
  const copies = Array.from({ length: count * 5 }, (_, index) => ({
    item: items[index % count],
    index,
    original: index >= middle && index < middle + count,
  }));
  const positionKey = `${value}:${items.map((item) => item.id).join("|")}`;
  const [scrollPosition, setScrollPosition] = useState({
    key: positionKey,
    index: centre,
  });
  const visible =
    scrollPosition.key === positionKey ? scrollPosition.index : centre;
  const live = useRef({ items, onChange });
  useEffect(() => {
    live.current = { items, onChange };
  }, [items, onChange]);
  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    ref.current?.scrollTo({
      y: Math.max(0, centre - 2) * row,
      animated: false,
    });
  }, [centre, row, positionKey]);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  const choose = (index: number) => {
    const length = live.current.items.length;
    if (!length) return;
    if (timer.current) clearTimeout(timer.current);
    const logicalIndex = ((index % length) + length) % length;
    const item = live.current.items[logicalIndex];
    if (!item) return;
    const centredIndex = length * 2 + logicalIndex;
    ref.current?.scrollTo({ y: (centredIndex - 2) * row, animated: false });
    setScrollPosition({ key: positionKey, index: centredIndex });
    live.current.onChange(item.id);
  };
  const settle = (y: number) => {
    if (!live.current.items.length) return;
    const index = Math.max(
      2,
      Math.min(live.current.items.length * 5 - 3, Math.round(y / row) + 2),
    );
    choose(index);
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
          contentOffset={{ x: 0, y: Math.max(0, centre - 2) * row }}
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
                2,
                Math.min(count * 5 - 3, Math.round(y / row) + 2),
              ),
            });
            if (Platform.OS === "web") later(y);
          }}
        >
          {copies.map(({ item, index, original }) => {
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
                key={`${item.id}:${index}`}
                accessibilityRole="button"
                accessibilityLabel={`${label}: ${item.label}`}
                accessible={original}
                accessibilityElementsHidden={!original}
                importantForAccessibility={
                  original ? "yes" : "no-hide-descendants"
                }
                {...(Platform.OS === "web"
                  ? { "aria-hidden": !original, tabIndex: original ? 0 : -1 }
                  : {})}
                accessibilityState={{ selected: original && index === centre }}
                onPress={() => choose(index)}
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
