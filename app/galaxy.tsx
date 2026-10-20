import React, { useState } from "react";
import {
  Image,
  Pressable,
  View,
  useWindowDimensions,
  ScrollView,
} from "react-native";
import { router } from "expo-router";
import { StarFourIcon } from "phosphor-react-native/src/icons/StarFour";
import { usePractice } from "../src/practice";
import {
  currentWhy,
  entriesOf,
  entryInput,
  interestState,
  valueState,
  type Entry,
  type EntryKind,
} from "../src/journey";
import { nextIntentionDay, dayLabel } from "../src/domain";
import {
  Body,
  Button,
  C,
  Chip,
  Eyebrow,
  Field,
  Notice,
  Page,
  Sheet,
  TextButton,
  Title,
  TopBar,
  s,
} from "../src/ui";
const colors: Record<string, string> = {
  Spark: "#BAB4E8",
  Glow: "#F8DE9A",
  Blaze: "#92BCFF",
  Ember: "#E79980",
  Craft: "#92BCFF",
  Flicker: "#CDB978",
  Steady: "#F4C96D",
  Drift: "#AEB4C5",
};
const layers: [EntryKind, string][] = [
  ["interest", "Interests"],
  ["value", "Values"],
  ["strength", "Strengths"],
  ["person", "People"],
];
export default function Galaxy() {
  const { data, putEntry, removeEntry } = usePractice();
  const { width } = useWindowDimensions();
  const mapSize = Math.min(width, 430) - 48;
  const mapHeight = Math.min(mapSize, 300);
  const [layer, setLayer] = useState<EntryKind>("interest"),
    [selected, setSelected] = useState<Entry | null>(null),
    [adding, setAdding] = useState(false),
    [name, setName] = useState(""),
    [error, setError] = useState("");
  const why = currentWhy(data);
  const items = entriesOf(data, layer);
  const state = (e: Entry) =>
    e.kind === "interest"
      ? interestState(data, e)
      : e.kind === "value"
        ? valueState(data, e)
        : e.kind === "person"
          ? "Person"
          : "Strength";
  const save = async (input: Parameters<typeof putEntry>[0]) => {
    try {
      await putEntry(input);
      setSelected(null);
      setAdding(false);
      setName("");
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const moments = selected
    ? data.intentions.filter((i) =>
        layer === "interest"
          ? i.interest_id
            ? i.interest_id === selected.id
            : i.interest === selected.title
          : layer === "value"
            ? i.value_id
              ? i.value_id === selected.id
              : i.value === selected.title
            : i.person === selected.title,
      )
    : [];
  return (
    <Page
      footer={
        <Button label="Try one today" onPress={() => router.push("/ritual")} />
      }
      header={
        <TopBar
          title="iwillbe.me"
          back={false}
          right={
            <TextButton
              label="Explore"
              onPress={() => router.push("/explore")}
            />
          }
        />
      }
    >
      <Eyebrow>
        {new Date().toLocaleDateString("en-US", {
          weekday: "long",
          month: "long",
          day: "numeric",
        })}
      </Eyebrow>
      <Title>Your galaxy</Title>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Open my why"
        onPress={() => router.push("/why")}
      >
        <Body style={{ color: C.gold, fontStyle: "italic" }}>
          {why?.body || "Your why is still forming. Start with what draws you."}
        </Body>
      </Pressable>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8 }}
        style={{ flexGrow: 0, flexShrink: 0 }}
      >
        {layers.map(([kind, label]) => (
          <Chip
            key={kind}
            label={label}
            selected={layer === kind}
            onPress={() => setLayer(kind)}
          />
        ))}
      </ScrollView>
      <View
        style={{
          width: "100%",
          height: mapHeight,
          borderRadius: 28,
          overflow: "hidden",
        }}
      >
        <Image
          source={require("../assets/illustrations/galaxy-night.jpg")}
          resizeMode="cover"
          style={{ position: "absolute", width: mapSize, height: mapHeight }}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="My why at the centre"
          onPress={() => router.push("/why")}
          style={{
            position: "absolute",
            top: "40%",
            left: "36%",
            width: "28%",
            height: "24%",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <StarFourIcon size={36} weight="fill" color={C.gold} />
          <Body style={{ fontSize: 12, color: C.gold }}>My why</Body>
        </Pressable>
        {items.slice(0, 8).map((e, n) => {
          const a =
            (((n * 360) / Math.max(items.slice(0, 8).length, 3) - 90) *
              Math.PI) /
            180;
          return (
            <Pressable
              key={e.id}
              accessibilityRole="button"
              accessibilityLabel={`${e.title} · ${state(e)}`}
              onPress={() => setSelected(e)}
              style={{
                position: "absolute",
                left: `${41 + 35 * Math.cos(a)}%`,
                top: `${40 + 35 * Math.sin(a)}%`,
                width: "20%",
                minHeight: 58,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <StarFourIcon
                size={state(e) === "Blaze" || state(e) === "Craft" ? 24 : 16}
                weight={state(e) === "Craft" ? "duotone" : "fill"}
                color={colors[state(e)] || C.gold}
              />
              <Body
                style={{
                  fontSize: 11,
                  lineHeight: 14,
                  textAlign: "center",
                  color: C.navy,
                }}
              >
                {e.title}
              </Body>
            </Pressable>
          );
        })}
      </View>
      {layer === "interest" ? (
        <Body style={{ fontSize: 12, textAlign: "center" }}>
          Spark · Glow · Blaze · Ember · Craft
        </Body>
      ) : null}
      {!items.length ? (
        <View style={s.card}>
          <Title style={{ fontSize: 23, lineHeight: 30 }}>
            Room for something new.
          </Title>
          <Body>
            {layer === "interest"
              ? "A curiosity is enough to begin. You do not need to have tried it."
              : "Add something you recognise in yourself. Chloe never decides this for you."}
          </Body>
        </View>
      ) : null}
      <View style={s.wrap}>
        <Chip label="+ Add to my galaxy" onPress={() => setAdding(true)} />
        <Chip label="+ Possibility" onPress={() => router.push("/explore")} />
      </View>
      <Eyebrow>{layers.find((l) => l[0] === layer)?.[1]} · all</Eyebrow>
      {items.map((e) => (
        <Pressable
          key={e.id}
          accessibilityRole="button"
          onPress={() => setSelected(e)}
          style={s.card}
        >
          <View style={[s.row, { justifyContent: "space-between" }]}>
            <Body style={{ color: C.navy, flex: 1 }}>{e.title}</Body>
            <Body style={{ color: colors[state(e)] || C.gold, fontSize: 13 }}>
              {state(e)}
            </Body>
          </View>
          <Body style={{ fontSize: 12 }}>{e.source}</Body>
        </Pressable>
      ))}
      <TextButton
        label="My practices and history"
        onPress={() => router.push("/history")}
      />
      <Button label="Try one today" onPress={() => router.push("/ritual")} />
      <TextButton
        label="The people in my constellation"
        onPress={() => router.push("/connections")}
      />
      <TextButton
        label="My telescope"
        onPress={() => router.push("/telescope")}
      />
      <TextButton
        label="My rhythms and open questions"
        onPress={() => router.push("/rhythms")}
      />
      <Sheet
        open={adding}
        onClose={() => setAdding(false)}
        title={`Add ${layer === "interest" ? "a spark" : layer === "person" ? "a person" : layer === "value" ? "a value" : "a strength"}`}
      >
        <Field
          label="Name"
          value={name}
          onChangeText={setName}
          maxLength={80}
        />
        <Body>
          {layer === "person"
            ? "This is someone you admire or care about. Choosing a person here does not create a shared moment."
            : "Your choice is a starting point. Your lived experience adds detail over time."}
        </Body>
        <Button
          label="Add to my galaxy"
          disabled={!name.trim()}
          onPress={() => save(entryInput(layer, name.trim()))}
        />
        <Notice text={error} tone="error" />
      </Sheet>
      <Sheet
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected?.title || ""}
      >
        {selected ? (
          <>
            <Eyebrow>{state(selected)}</Eyebrow>
            <Body>{selected.body || selected.source}</Body>
            <Body style={{ fontSize: 13 }}>
              {layer === "interest"
                ? "Spark: curious. Glow: you already love it, or one try lit you up. Blaze: three try-ons lit you up. Ember and Craft are choices you make. Absence never dims a star."
                : layer === "value"
                  ? "Flicker: still exploring. Steady: chosen again in at least two reflections. Drift: your latest choice was “not mine”."
                  : "A part of your story, without rankings or scores."}
            </Body>
            {moments.map((i) => (
              <View key={i.id} style={s.section}>
                <Body>{i.action}</Body>
                <Body style={{ fontSize: 12 }}>
                  {dayLabel(i.day)} ·{" "}
                  {data.checkIns.find((c) => c.intention_id === i.id)?.energy ||
                    "No energy noted"}
                </Body>
                <TextButton
                  label="Open this moment"
                  onPress={() => {
                    setSelected(null);
                    router.push({ pathname: "/history", params: { id: i.id } });
                  }}
                />
              </View>
            ))}
            <Button
              label="Try this next"
              onPress={() => {
                setSelected(null);
                router.push({
                  pathname: "/ritual",
                  params: {
                    day: nextIntentionDay(data),
                    [layer === "interest"
                      ? "interest"
                      : layer === "value"
                        ? "value"
                        : "person"]: selected.title,
                  },
                });
              }}
            />
            {layer === "interest" ? (
              <>
                <Button
                  secondary
                  label={
                    selected.state === "craft"
                      ? "Return to exploring"
                      : "Make it my craft"
                  }
                  onPress={() =>
                    save({
                      ...selected,
                      state: selected.state === "craft" ? "spark" : "craft",
                    })
                  }
                />
                <TextButton
                  label={
                    selected.state === "ember"
                      ? "Light this spark again"
                      : "Let it become an ember"
                  }
                  onPress={() =>
                    save({
                      ...selected,
                      state: selected.state === "ember" ? "spark" : "ember",
                    })
                  }
                />
              </>
            ) : null}
            <TextButton
              label="Remove from my galaxy"
              onPress={async () => {
                try {
                  await removeEntry(selected.id);
                  setSelected(null);
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            />
            <Notice text={error} tone="error" />
          </>
        ) : null}
      </Sheet>
    </Page>
  );
}
