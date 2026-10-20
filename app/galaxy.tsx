import React, { useState } from "react";
import { Pressable, View, StyleSheet } from "react-native";
import Svg, { Circle, Line } from "react-native-svg";
import { GraphIcon as Graph } from "phosphor-react-native/src/icons/Graph";
import { StarFourIcon as StarFour } from "phosphor-react-native/src/icons/StarFour";
import { InfoIcon as Info } from "phosphor-react-native/src/icons/Info";
import { router } from "expo-router";
import { usePractice } from "../src/practice";
import { activityCount, INTERESTS, SUGGESTIONS } from "../src/domain";
import {
  Body,
  Button,
  C,
  Chip,
  Eyebrow,
  F,
  Illustration,
  Notice,
  Page,
  Sheet,
  TextButton,
  Title,
  TopBar,
  art,
  s,
} from "../src/ui";
const positions = [
  [80, 66],
  [252, 57],
  [295, 180],
  [250, 300],
  [85, 298],
  [38, 180],
  [164, 32],
  [315, 265],
  [35, 85],
  [168, 330],
];
export default function Galaxy() {
  const { data, saveProfile } = usePractice();
  const [selected, setSelected] = useState<string | null>(null),
    [explore, setExplore] = useState(false),
    [info, setInfo] = useState(false),
    [error, setError] = useState("");
  const labels = Array.from(
    new Set([...data.profile.values, ...data.profile.interests]),
  );
  const count = selected ? activityCount(data, selected) : 0;
  const completed = data.checkIns.filter((c) => c.outcome !== "not_yet").length;
  const add = async (label: string) => {
    try {
      await saveProfile({
        ...data.profile,
        interests: [...data.profile.interests, label].slice(0, 6),
      });
      setExplore(false);
      setSelected(label);
    } catch (e) {
      setError((e as Error).message);
    }
  };
  return (
    <Page
      header={
        <TopBar
          title="Your galaxy"
          back={false}
          right={
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="How your galaxy grows"
              onPress={() => setInfo(true)}
              style={s.iconButton}
            >
              <Info size={23} color={C.ink} weight="light" />
            </Pressable>
          }
        />
      }
      contentStyle={{ paddingTop: 8 }}
    >
      <Eyebrow>A MAP OF WHAT MATTERS</Eyebrow>
      <Title>{"A universe,\nuniquely yours."}</Title>
      <Body>
        Your values, your interests, and the small moments that bring them to
        life.
      </Body>
      {labels.length ? (
        <>
          <View style={{ width: "100%", aspectRatio: 1, position: "relative" }}>
            <Svg viewBox="0 0 350 360" style={StyleSheet.absoluteFill}>
              <Circle
                cx={175}
                cy={180}
                r={116}
                stroke="#D8C6A3"
                strokeWidth={0.7}
                strokeDasharray="2 8"
                fill="none"
              />
              {labels.slice(0, 10).map((label, index) => {
                const [x, y] = positions[index];
                return (
                  <Line
                    key={label}
                    x1={175}
                    y1={180}
                    x2={x}
                    y2={y}
                    stroke={activityCount(data, label) ? "#C5A36B" : "#DED7C9"}
                    strokeWidth={0.8}
                  />
                );
              })}
            </Svg>
            <View
              style={{
                position: "absolute",
                left: "39%",
                top: "38%",
                width: "22%",
                alignItems: "center",
                gap: 6,
              }}
            >
              <StarFour size={58} color={C.gold} weight="duotone" />
              <Body
                style={{
                  fontFamily: F.medium,
                  fontSize: 12,
                  textAlign: "center",
                }}
              >
                You
              </Body>
            </View>
            {labels.slice(0, 10).map((label, index) => {
              const [x, y] = positions[index],
                n = activityCount(data, label);
              return (
                <Pressable
                  key={label}
                  accessibilityRole="button"
                  accessibilityLabel={`${label}, ${n} real-world steps`}
                  onPress={() => setSelected(label)}
                  style={{
                    position: "absolute",
                    left: `${(x / 350) * 100 - 12}%`,
                    top: `${(y / 360) * 100 - 7}%`,
                    width: "24%",
                    alignItems: "center",
                    gap: 6,
                    paddingVertical: 7,
                  }}
                >
                  <StarFour
                    size={n ? 30 : 22}
                    color={n ? C.gold : "#9A9B98"}
                    weight={n ? "duotone" : "light"}
                  />
                  <Body
                    style={{
                      textAlign: "center",
                      fontSize: 11,
                      lineHeight: 15,
                      color: C.navy,
                    }}
                  >
                    {label}
                  </Body>
                  {n > 0 && (
                    <Body
                      style={{ fontSize: 10, color: C.gold, lineHeight: 12 }}
                    >
                      {n} {n === 1 ? "moment" : "moments"}
                    </Body>
                  )}
                </Pressable>
              );
            })}
          </View>
          {labels.length > 10 && (
            <View style={s.wrap}>
              {labels.slice(10).map((label) => (
                <Chip
                  key={label}
                  label={`${label} · ${activityCount(data, label)}`}
                  onPress={() => setSelected(label)}
                />
              ))}
            </View>
          )}
          <Body style={{ textAlign: "center", fontSize: 13 }}>
            {completed
              ? `${completed} real-world ${completed === 1 ? "step" : "steps"}. A little more you.`
              : "Your first real-world step will light a star."}
          </Body>
        </>
      ) : (
        <>
          <Illustration source={art.explore} height={250} />
          <Button
            label="Find my first stars"
            onPress={() => router.push("/onboarding")}
          />
        </>
      )}
      <View style={s.section}>
        <View style={[s.row, { justifyContent: "space-between" }]}>
          <Title style={{ fontSize: 23, lineHeight: 30 }}>
            Room for discovery
          </Title>
          <Graph size={22} color={C.gold} weight="light" />
        </View>
        <Body style={{ fontSize: 14 }}>
          You don’t have to know who you’ll become. Start with something that
          makes you curious.
        </Body>
        <Button
          secondary
          label="Explore an interest"
          onPress={() => {
            setError("");
            setExplore(true);
          }}
        />
      </View>
      <Sheet
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected || ""}
      >
        <Eyebrow>
          {count ? "GROWING THROUGH ACTION" : "A POSSIBILITY TO EXPLORE"}
        </Eyebrow>
        <Body>
          {count
            ? `You have brought ${selected?.toLowerCase()} into ${count} real-world ${count === 1 ? "moment" : "moments"}.`
            : "This star is here because it matters to you. It will grow when you bring it into your day."}
        </Body>
        {data.intentions
          .filter(
            (i) =>
              i.value === selected &&
              data.checkIns.some(
                (c) => c.intention_id === i.id && c.outcome !== "not_yet",
              ),
          )
          .slice(0, 3)
          .map((i) => (
            <View
              key={i.id}
              style={{
                gap: 5,
                borderTopWidth: 1,
                borderColor: C.line,
                paddingTop: 12,
              }}
            >
              <Body style={{ fontSize: 11, color: C.gold }}>{i.day}</Body>
              <Body>{i.action}</Body>
            </View>
          ))}
        <Eyebrow>A SMALL WAY TO BEGIN</Eyebrow>
        {(SUGGESTIONS[selected || ""] || SUGGESTIONS.Curiosity)
          .slice(0, 2)
          .map((action) => (
            <TextButton
              key={action}
              label={action}
              onPress={() => {
                const value = selected || "Curiosity";
                setSelected(null);
                router.push({ pathname: "/ritual", params: { value, action } });
              }}
            />
          ))}
      </Sheet>
      <Sheet
        open={explore}
        onClose={() => setExplore(false)}
        title="Follow your curiosity"
      >
        <Illustration source={art.explore} height={160} />
        <Body>Pick something you’d like to make room for.</Body>
        <View style={s.wrap}>
          {INTERESTS.filter((v) => !data.profile.interests.includes(v)).map(
            (v) => (
              <Chip key={v} label={v} onPress={() => add(v)} />
            ),
          )}
        </View>
        {INTERESTS.every((v) => data.profile.interests.includes(v)) && (
          <Body>All these interests are already in your galaxy.</Body>
        )}
        <Notice text={error} tone="error" />
      </Sheet>
      <Sheet
        open={info}
        onClose={() => setInfo(false)}
        title="A galaxy you live"
      >
        <Body>
          Choosing a value or interest plants a possibility. When your evening
          reflection records a real step — even a small one — that star grows.
        </Body>
        <Body>
          Chatting, opening the app, and planning don’t increase it. Missed days
          never take anything away.
        </Body>
        <Button label="That feels right" onPress={() => setInfo(false)} />
      </Sheet>
    </Page>
  );
}
