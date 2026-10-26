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
  possibilityPattern,
  type Entry,
} from "../src/journey";
import { nextIntentionDay, dayLabel } from "../src/domain";
import { useToday } from "../src/use-today";
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
  Maybe: "#BAB4E8",
  "Tried it": "#F8DE9A",
  "Into it": "#92BCFF",
  "On pause": "#E79980",
  "All in": "#92BCFF",
  "Trying it on": "#CDB978",
  Mine: "#F4C96D",
  "Let go": "#AEB4C5",
};
type Layer = "interest" | "value" | "strength" | "person" | "practice";
const layers: [Layer, string][] = [
  ["interest", "Possibilities"],
  ["value", "Values"],
  ["strength", "Strengths"],
  ["person", "People I admire"],
  ["practice", "Practices and habits"],
];
export default function Galaxy() {
  const { data, putEntry, removeEntry } = usePractice();
  const today = useToday();
  const { width } = useWindowDimensions();
  const mapSize = Math.min(width, 430) - 48;
  const mapHeight = Math.min(mapSize, 300);
  const [layer, setLayer] = useState<Layer>("interest"),
    [selected, setSelected] = useState<Entry | null>(null),
    [adding, setAdding] = useState(false),
    [name, setName] = useState(""),
    [detail, setDetail] = useState(""),
    [error, setError] = useState("");
  const why = currentWhy(data);
  const items = entriesOf(
    data,
    layer === "practice" ? "interest" : layer,
  ).filter((e) =>
    layer === "practice"
      ? e.meta.category === "practice"
      : e.meta.category !== "practice",
  );
  const strengths = [
    ...entriesOf(data, "strength"),
    ...entriesOf(data, "value").filter((e) => valueState(data, e) === "Mine"),
  ];
  const threads = entriesOf(data, "interest")
    .filter(
      (e) =>
        e.meta.category !== "practice" &&
        !["ember", "paused"].includes(e.state),
    )
    .slice(0, 2);
  const pattern = possibilityPattern(data);
  const state = (e: Entry) =>
    e.meta.category === "practice"
      ? "Practice"
      : e.kind === "interest"
        ? interestState(data, e)
        : e.kind === "value"
          ? valueState(data, e)
          : e.kind === "person"
            ? "Admired"
            : "Strength";
  const save = async (input: Parameters<typeof putEntry>[0]) => {
    try {
      await putEntry(input);
      setSelected(null);
      setAdding(false);
      setName("");
      setDetail("");
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const moments = selected
    ? data.intentions.filter((i) =>
        layer === "interest" || layer === "practice"
          ? i.interest_id
            ? i.interest_id === selected.id
            : i.interest === selected.title
          : layer === "value"
            ? i.value_id
              ? i.value_id === selected.id
              : i.value === selected.title
            : false,
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
      <Title>My Possibilities</Title>
      <Eyebrow>Your why, and strengths</Eyebrow>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Open my why"
        onPress={() => router.push("/why")}
      >
        <Body style={{ color: C.gold, fontStyle: "italic" }}>
          {why?.body || "Your why is still forming. Start with what draws you."}
        </Body>
      </Pressable>
      {!why && threads.length ? (
        <Body style={{ fontSize: 13 }}>
          Emerging threads: {threads.map((e) => e.title).join(" · ")}
        </Body>
      ) : null}
      {strengths.length ? (
        <View style={s.wrap}>
          {strengths.map((e) => (
            <Chip
              key={e.id}
              label={e.title}
              onPress={() => {
                setLayer(e.kind === "value" ? "value" : "strength");
                setSelected(e);
              }}
            />
          ))}
        </View>
      ) : null}
      {pattern ? <Body>{pattern}</Body> : null}
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
                size={state(e) === "Into it" || state(e) === "All in" ? 24 : 16}
                weight={state(e) === "All in" ? "duotone" : "fill"}
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
          Maybe · Tried it · Into it · On pause · All in
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
        <Chip label="+ Add something" onPress={() => setAdding(true)} />
        <Chip label="+ Possibility" onPress={() => router.push("/explore")} />
      </View>
      <Eyebrow>{layers.find((l) => l[0] === layer)?.[1]}</Eyebrow>
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
          <Body style={{ fontSize: 12 }}>{e.body || e.source}</Body>
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
        label="One year out and Later in life"
        onPress={() => router.push("/telescope")}
      />
      <TextButton
        label="My rhythms and open questions"
        onPress={() => router.push("/rhythms")}
      />
      <Sheet
        open={adding}
        onClose={() => setAdding(false)}
        title={`Add ${layer === "interest" ? "a possibility" : layer === "person" ? "someone I admire" : layer === "value" ? "a value" : layer === "practice" ? "a practice" : "a strength"}`}
      >
        <Field
          label="Name"
          value={name}
          onChangeText={setName}
          maxLength={80}
        />
        <Body>
          {layer === "person"
            ? "Keep what you admire about them next to your why."
            : "Your choice is a starting point. Your lived experience adds detail over time."}
        </Body>
        {layer === "person" || layer === "practice" ? (
          <Field
            label={
              layer === "person"
                ? "What exactly do you admire about them?"
                : "How does this support your why?"
            }
            multiline
            value={detail}
            onChangeText={setDetail}
            maxLength={1000}
          />
        ) : null}
        <Button
          label="Keep this"
          disabled={!name.trim() || (layer === "person" && !detail.trim())}
          onPress={() =>
            save(
              entryInput(
                layer === "practice" ? "interest" : layer,
                name.trim(),
                {
                  body: detail.trim(),
                  state:
                    layer === "interest"
                      ? "spark"
                      : layer === "value"
                        ? "trying"
                        : "active",
                  meta: layer === "practice" ? { category: "practice" } : {},
                },
              ),
            )
          }
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
                ? "Follow what draws you, try it in real life, and notice what keeps lighting you up. On pause stays part of your story."
                : layer === "value"
                  ? "Try it on, choose what feels like yours, and let go of what does not."
                  : "A part of your story."}
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
            {layer !== "person" && layer !== "strength" ? (
              <Button
                label="Try this next"
                onPress={() => {
                  setSelected(null);
                  router.push({
                    pathname: "/ritual",
                    params: {
                      day: nextIntentionDay(data, today),
                      [layer === "interest" || layer === "practice"
                        ? "interest"
                        : layer === "value"
                          ? "value"
                          : "person"]: selected.title,
                    },
                  });
                }}
              />
            ) : null}
            {layer === "interest" ? (
              <>
                {state(selected) === "All in" ||
                (state(selected) === "Into it" &&
                  Date.parse(`${today}T12:00:00Z`) -
                    Date.parse(selected.created_at) >=
                    7 * 86400000) ? (
                  <Button
                    secondary
                    label={
                      state(selected) === "All in"
                        ? "Return to exploring"
                        : "Go all in"
                    }
                    onPress={() =>
                      save({
                        ...selected,
                        state: state(selected) === "All in" ? "love" : "craft",
                      })
                    }
                  />
                ) : null}
                <TextButton
                  label={
                    state(selected) === "On pause"
                      ? "Explore this again"
                      : "Put this on pause"
                  }
                  onPress={() =>
                    save({
                      ...selected,
                      state:
                        state(selected) === "On pause"
                          ? selected.meta.previous_state === "craft"
                            ? "love"
                            : selected.meta.previous_state || "spark"
                          : "ember",
                      meta: {
                        ...selected.meta,
                        previous_state: selected.state,
                      },
                    })
                  }
                />
              </>
            ) : null}
            {layer === "value" ? (
              <TextButton
                label={
                  state(selected) === "Let go"
                    ? "Try this on again"
                    : "Let this value go"
                }
                onPress={() =>
                  save({
                    ...selected,
                    state: state(selected) === "Let go" ? "trying" : "let_go",
                  })
                }
              />
            ) : null}
            <TextButton
              label="Remove this"
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
