import React from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
} from "react-native";
import { router } from "expo-router";
import { GearSixIcon as GearSix } from "phosphor-react-native/src/icons/GearSix";
import { MoonStarsIcon as MoonStars } from "phosphor-react-native/src/icons/MoonStars";
import { CheckCircleIcon as CheckCircle } from "phosphor-react-native/src/icons/CheckCircle";
import { ArrowUpRightIcon as ArrowUpRight } from "phosphor-react-native/src/icons/ArrowUpRight";
import { usePractice } from "../src/practice";
import { outcomeLabel } from "../src/domain";
import {
  Body,
  Button,
  C,
  ChloeMark,
  Eyebrow,
  F,
  Notice,
  Page,
  Title,
  art,
  s,
} from "../src/ui";
import { useToday } from "../src/use-today";
export default function Today() {
  const { data, loading, error } = usePractice();
  const width = Math.min(useWindowDimensions().width, 430);
  const today = useToday();
  const intention = data.intentions.find((i) => i.day === today);
  const checked = data.checkIns.find((c) => c.intention_id === intention?.id);
  if (loading)
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={C.gold} />
      </View>
    );
  const begin = () =>
    router.push(data.profile.onboarded ? "/ritual" : "/onboarding");
  return (
    <Page contentStyle={{ paddingHorizontal: 0, paddingTop: 18, gap: 0 }}>
      <View style={styles.brand}>
        <Title style={{ fontSize: 27, lineHeight: 36, letterSpacing: -0.7 }}>
          iwillbe.me
        </Title>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Settings"
          onPress={() => router.push("/settings")}
          style={styles.settings}
        >
          <GearSix size={23} weight="light" color={C.ink} />
        </Pressable>
      </View>
      <View style={styles.intro}>
        <Eyebrow>
          {intention ? "YOUR DAILY PRACTICE" : "YOUR MORNING RITUAL"}
        </Eyebrow>
        <Title style={styles.heading}>
          {intention
            ? checked
              ? "A little more\nyou."
              : "Let your intention\nlead the way."
            : "Who will you\nbe today?"}
        </Title>
        <Body style={{ textAlign: "center", fontSize: 16 }}>
          {intention
            ? checked
              ? "Every small step becomes part of your story."
              : `One small promise${data.profile.display_name ? `, ${data.profile.display_name}` : ""}. Room to be human.`
            : "One small intention. A little more you."}
        </Body>
      </View>
      {!intention ? (
        <>
          <Image
            source={art.morning}
            style={{ width: "100%", height: width, marginTop: 4 }}
            resizeMode="cover"
          />
          <View style={styles.actions}>
            <View style={[s.row, { justifyContent: "center", gap: 10 }]}>
              <ChloeMark small />
              <Body style={{ fontSize: 14 }}>
                Chloe is here to help you choose.
              </Body>
            </View>
            <Button label="Begin with Chloe" onPress={begin} />
          </View>
        </>
      ) : (
        <View style={styles.active}>
          <Image
            source={checked ? art.evening : art.morning}
            style={{ width: "100%", height: 190 }}
            resizeMode="contain"
          />
          <View style={s.card}>
            <View style={[s.row, { justifyContent: "space-between" }]}>
              <Eyebrow>TODAY’S ONE THING</Eyebrow>
              {checked && <CheckCircle color={C.gold} size={22} />}
            </View>
            <Title style={{ fontSize: 25, lineHeight: 34 }}>
              {intention.action}
            </Title>
            <Body style={{ fontSize: 12, color: C.gold }}>
              {intention.value} · For {intention.person || "myself"}
            </Body>
            {checked ? (
              <>
                <View style={{ height: 1, backgroundColor: C.line }} />
                <Body style={{ fontFamily: F.medium }}>
                  {outcomeLabel(checked.outcome)}
                </Body>
                {!!checked.reflection && <Body>{checked.reflection}</Body>}
              </>
            ) : (
              <Body style={{ fontSize: 13 }}>
                Carry this with you. We’ll make room to reflect later.
              </Body>
            )}
          </View>
          {!checked ? (
            <>
              <Button
                label="Reflect on today"
                onPress={() => router.push("/reflect")}
              />
              <Pressable
                onPress={begin}
                accessibilityRole="button"
                accessibilityLabel="Adjust my intention"
                style={{ padding: 8 }}
              >
                <Body style={{ textAlign: "center", fontSize: 13 }}>
                  Adjust my intention
                </Body>
              </Pressable>
            </>
          ) : (
            <Button
              label="See my galaxy"
              onPress={() => router.replace("/galaxy")}
            />
          )}
        </View>
      )}
      {!!error && (
        <View style={{ paddingHorizontal: 24, paddingTop: 20 }}>
          <Notice text={error} tone="error" />
        </View>
      )}
      {data.intentions.length > 0 && (
        <View
          style={{
            marginHorizontal: 24,
            marginTop: 28,
            gap: 15,
            borderTopWidth: 1,
            borderColor: C.line,
            paddingTop: 20,
          }}
        >
          <View style={[s.row, { justifyContent: "space-between" }]}>
            <Eyebrow>A LITTLE SPACE TO GROW</Eyebrow>
            <MoonStars size={19} color={C.gold} />
          </View>
          <Body style={{ fontSize: 16 }}>
            Your practice grows through what you do, not how often you open the
            app.
          </Body>
          {data.intentions
            .filter((i) => i.day !== today)
            .slice(0, 3)
            .map((i) => (
              <Pressable
                key={i.id}
                onPress={() =>
                  router.push({ pathname: "/history", params: { id: i.id } })
                }
                accessibilityRole="button"
                style={{
                  borderTopWidth: 1,
                  borderColor: C.line,
                  paddingTop: 15,
                  gap: 5,
                }}
              >
                <Body style={{ fontSize: 11, color: C.gold }}>
                  {new Date(i.day + "T12:00:00").toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })}{" "}
                  · {i.value}
                </Body>
                <View style={[s.row, { justifyContent: "space-between" }]}>
                  <Body style={{ flex: 1 }}>{i.action}</Body>
                  <ArrowUpRight size={18} color={C.ink} />
                </View>
              </Pressable>
            ))}
        </View>
      )}
    </Page>
  );
}
const styles = StyleSheet.create({
  brand: {
    position: "relative",
    height: 45,
    alignItems: "center",
    justifyContent: "center",
  },
  settings: {
    position: "absolute",
    right: 17,
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  intro: {
    paddingHorizontal: 22,
    paddingTop: 23,
    alignItems: "center",
    gap: 13,
  },
  heading: {
    fontFamily: F.bold,
    fontSize: 52,
    lineHeight: 55,
    textAlign: "center",
    letterSpacing: -1.4,
  },
  actions: { paddingHorizontal: 24, gap: 21, paddingTop: 5 },
  active: { padding: 24, paddingTop: 0, gap: 18 },
});
