import React, { useRef, useState } from "react";
import {
  AccessibilityInfo,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { router } from "expo-router";
import { ArrowLeftIcon } from "phosphor-react-native/src/icons/ArrowLeft";
import { ArrowRightIcon } from "phosphor-react-native/src/icons/ArrowRight";
import { Body, Button, C, Eyebrow, F, TextButton, Title } from "./ui";

const slides = [
  {
    label: "A LITTLE MORE YOU",
    title: "Show up for\nwhat matters.",
    body: "A small daily practice to find your why and live it. Chloe helps you choose one thing that matters today, then gets you off the screen.",
  },
  {
    label: "A FEW MINUTES, THEN GO LIVE",
    title: "One intention.\nA real day.",
    body: "Choose one small “I will” in the morning. Come back at night to notice how it went. No streaks, no score, no catching up.",
  },
  {
    label: "MAKE ROOM FOR POSSIBILITY",
    title: "Find what\nfeels like you.",
    body: "Explore what you love, what you could try, and who you want to be. Your why grows with what you discover.",
  },
  {
    label: "YOUR FIRST SMALL STEP",
    title: "I will be\nmore me.",
    body: "You don’t need all the answers. Create your account, then meet Chloe for a gentle first session. About five minutes, at your pace.",
  },
];

function Example({ step }: { step: number }) {
  if (step === 0)
    return (
      <View style={styles.example}>
        <Eyebrow style={styles.smallLabel}>A SMALL EXAMPLE</Eyebrow>
        <Text style={styles.promise}>I will be present.</Text>
        <View style={styles.rule} />
        <Body>Call Mum after my morning coffee.</Body>
        <Body style={styles.caption}>
          One thing. Someone I love. A moment that’s mine.
        </Body>
      </View>
    );
  if (step === 1)
    return (
      <View style={styles.example}>
        {[
          [
            "MORNING",
            "Choose how to show up.",
            "I will take a walk with Maya.",
          ],
          ["DAY", "Put the phone down.", "Make room for the real thing."],
          [
            "NIGHT",
            "Notice what stays with you.",
            "How did it feel to make that time?",
          ],
        ].map(([label, title, detail], i) => (
          <View key={label} style={[styles.rhythm, i > 0 && styles.separated]}>
            <Eyebrow style={styles.smallLabel}>{label}</Eyebrow>
            <Body style={styles.rowTitle}>{title}</Body>
            <Body style={styles.caption}>{detail}</Body>
          </View>
        ))}
      </View>
    );
  if (step === 2)
    return (
      <View style={{ gap: 14 }}>
        <View style={styles.why}>
          <Eyebrow style={styles.smallLabel}>A WHY, STILL GROWING</Eyebrow>
          <Text style={styles.whyText}>
            To make the people around me braver.
          </Text>
        </View>
        <View style={styles.columns}>
          {[
            ["MAYBE", "Gardening"],
            ["TRIED IT", "A pottery class"],
            ["INTO IT", "Cooking"],
          ].map(([label, activity], i) => (
            <View
              key={label}
              style={[
                styles.possibility,
                i === 0 && styles.maybe,
                i === 2 && styles.into,
              ]}
            >
              <Text style={[styles.stage, i === 2 && styles.inverse]}>
                {label}
              </Text>
              <Body
                style={{
                  fontSize: 14,
                  lineHeight: 19,
                  color: i === 2 ? C.paper : C.navy,
                }}
              >
                {activity}
              </Body>
            </View>
          ))}
        </View>
        <Body style={styles.caption}>
          An example. Your possibilities will be your own.
        </Body>
      </View>
    );
  return (
    <View style={styles.steps}>
      {[
        [
          "01",
          "Create your account",
          "Keep your reflections in your own space.",
        ],
        [
          "02",
          "Find your possibilities",
          "A few picture picks and short stories. Skip any question.",
        ],
        ["03", "Choose one thing", "Take one small commitment into your day."],
      ].map(([number, title, detail]) => (
        <View key={number} style={styles.step}>
          <Text style={styles.number}>{number}</Text>
          <View style={{ flex: 1, gap: 3 }}>
            <Body style={styles.rowTitle}>{title}</Body>
            <Body style={styles.caption}>{detail}</Body>
          </View>
        </View>
      ))}
    </View>
  );
}

export function Landing() {
  const { width: viewportWidth } = useWindowDimensions();
  const width = Math.min(viewportWidth, 1100);
  const wide = width >= 760;
  const [step, setStep] = useState(0);
  const [pageWidth, setPageWidth] = useState(width);
  const pager = useRef<React.ElementRef<typeof ScrollView>>(null);
  const join = () =>
    router.push({
      pathname: "/account",
      params: { returnTo: "/onboarding", reason: "join" },
    });
  const signIn = () =>
    router.push({
      pathname: "/account",
      params: { returnTo: "/", reason: "signin" },
    });
  const go = async (next: number) => {
    const index = Math.max(0, Math.min(slides.length - 1, next));
    const reduceMotion = await AccessibilityInfo.isReduceMotionEnabled().catch(
      () => true,
    );
    setStep(index);
    pager.current?.scrollTo({ x: index * pageWidth, animated: !reduceMotion });
  };
  return (
    <View style={styles.root}>
      <View style={[styles.header, wide && styles.desktopPadding]}>
        <View style={styles.brandRow}>
          <Text style={styles.brand}>iwillbe.me</Text>
          <Text style={styles.beta}>BETA</Text>
        </View>
        <TextButton label="Sign in" onPress={signIn} />
      </View>
      <ScrollView
        ref={pager}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        style={{ flex: 1 }}
        onLayout={(event) => {
          const nextWidth = event.nativeEvent.layout.width;
          setPageWidth(nextWidth);
          pager.current?.scrollTo({ x: step * nextWidth, animated: false });
        }}
        onScroll={(event) => {
          const next = Math.round(
            event.nativeEvent.contentOffset.x / pageWidth,
          );
          if (next >= 0 && next < slides.length) setStep(next);
        }}
        scrollEventThrottle={32}
      >
        {slides.map((slide, index) => (
          <ScrollView
            key={slide.label}
            showsVerticalScrollIndicator={false}
            style={{ width: pageWidth }}
            accessibilityElementsHidden={step !== index}
            importantForAccessibility={
              step === index ? "auto" : "no-hide-descendants"
            }
            {...(Platform.OS === "web"
              ? { "aria-hidden": step !== index }
              : {})}
            contentContainerStyle={[styles.slide, wide && styles.wideSlide]}
          >
            <View style={[styles.copy, wide && { flex: 1 }]}>
              <Eyebrow style={styles.kicker}>{slide.label}</Eyebrow>
              <Title
                style={{
                  fontSize: wide ? 66 : pageWidth < 360 ? 36 : 43,
                  lineHeight: wide ? 71 : pageWidth < 360 ? 41 : 48,
                  letterSpacing: -1.9,
                }}
              >
                {slide.title}
              </Title>
              <Body style={styles.description}>{slide.body}</Body>
            </View>
            <View style={wide ? { flex: 1, maxWidth: 410 } : undefined}>
              <Example step={index} />
            </View>
          </ScrollView>
        ))}
      </ScrollView>
      <View style={[styles.footer, wide && styles.desktopPadding]}>
        <View style={styles.navigation}>
          <View style={styles.dots} accessibilityLabel="Introduction pages">
            {slides.map((slide, index) => (
              <Pressable
                key={slide.label}
                accessibilityRole="button"
                accessibilityLabel={`Page ${index + 1}: ${slide.label.toLowerCase()}`}
                accessibilityState={{ selected: index === step }}
                onPress={() => void go(index)}
                style={styles.dotTarget}
              >
                <View
                  style={[styles.dot, index === step && styles.activeDot]}
                />
              </Pressable>
            ))}
          </View>
          <View style={styles.arrows}>
            <Text
              style={styles.counter}
              accessibilityLiveRegion="polite"
            >{`0${step + 1} / 04`}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Previous page"
              disabled={step === 0}
              accessibilityState={{ disabled: step === 0 }}
              onPress={() => void go(step - 1)}
              style={[styles.arrow, step === 0 && { opacity: 0.25 }]}
            >
              <ArrowLeftIcon size={20} color={C.navy} />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                step === 3 ? "Create my account" : "Next page"
              }
              onPress={step === 3 ? join : () => void go(step + 1)}
              style={styles.arrow}
            >
              <ArrowRightIcon size={20} color={C.navy} />
            </Pressable>
          </View>
        </View>
        <View
          style={[
            styles.ctaRow,
            wide && { flexDirection: "row", alignItems: "center" },
          ]}
        >
          <View style={wide ? { width: 300 } : undefined}>
            <Button label="Join the beta" onPress={join} />
          </View>
          <Body style={styles.ctaNote}>
            Create your account first. Meet Chloe next.
          </Body>
          <TextButton label="Privacy" onPress={() => router.push("/privacy")} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.paper },
  header: {
    paddingHorizontal: 24,
    paddingTop: 8,
    minHeight: 76,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderColor: C.line,
  },
  desktopPadding: { paddingHorizontal: 56 },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  brand: { fontFamily: F.bold, fontSize: 26, letterSpacing: -1, color: C.navy },
  beta: {
    fontFamily: F.medium,
    color: C.gold,
    fontSize: 9,
    letterSpacing: 1.5,
    borderWidth: 1,
    borderColor: C.line,
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 5,
  },
  slide: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingVertical: 30,
    gap: 28,
    justifyContent: "center",
  },
  wideSlide: {
    flexDirection: "row",
    alignItems: "center",
    gap: 64,
    paddingHorizontal: 56,
    paddingVertical: 60,
  },
  copy: { gap: 16 },
  kicker: { color: C.gold, fontSize: 10, letterSpacing: 1.8 },
  description: { fontSize: 16, lineHeight: 25, maxWidth: 400 },
  example: {
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 18,
    padding: 22,
    gap: 12,
  },
  smallLabel: {
    color: C.muted,
    fontSize: 9,
    lineHeight: 15,
    letterSpacing: 1.4,
  },
  promise: { fontFamily: F.serif, fontSize: 28, lineHeight: 34, color: C.navy },
  rule: { height: 1, backgroundColor: C.line, marginVertical: 2 },
  caption: { color: C.muted, fontSize: 12, lineHeight: 19 },
  rowTitle: {
    color: C.navy,
    fontFamily: F.strong,
    fontSize: 15,
    lineHeight: 22,
  },
  rhythm: { gap: 4 },
  separated: { paddingTop: 14, borderTopWidth: 1, borderColor: C.line },
  why: { backgroundColor: C.soft, padding: 22, gap: 10, borderRadius: 18 },
  whyText: { fontFamily: F.serif, fontSize: 25, lineHeight: 32, color: C.navy },
  columns: { flexDirection: "row", gap: 9 },
  possibility: {
    flex: 1,
    borderRadius: 12,
    padding: 12,
    gap: 12,
    borderWidth: 1,
    borderColor: C.line,
    backgroundColor: C.white,
  },
  maybe: {
    backgroundColor: "transparent",
    borderStyle: "dashed",
    borderColor: C.muted,
  },
  into: { backgroundColor: C.navy, borderColor: C.navy },
  stage: {
    fontFamily: F.strong,
    fontSize: 8,
    letterSpacing: 0.8,
    color: C.gold,
  },
  inverse: { color: C.paper },
  steps: { gap: 23 },
  step: { flexDirection: "row", gap: 18, alignItems: "flex-start" },
  number: { fontFamily: F.serif, color: C.gold, fontSize: 24, lineHeight: 30 },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 8,
    paddingTop: 6,
    borderTopWidth: 1,
    borderColor: C.line,
  },
  navigation: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingBottom: 6,
  },
  dots: { flexDirection: "row" },
  dotTarget: {
    minWidth: 28,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  dot: { width: 17, height: 3, borderRadius: 2, backgroundColor: C.line },
  activeDot: { backgroundColor: C.gold },
  arrows: { flexDirection: "row", gap: 5, alignItems: "center" },
  counter: {
    fontFamily: F.medium,
    fontSize: 11,
    letterSpacing: 1,
    color: C.muted,
    marginRight: 10,
  },
  arrow: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  ctaRow: { gap: 0 },
  ctaNote: {
    fontSize: 11,
    lineHeight: 18,
    textAlign: "center",
    paddingHorizontal: 18,
    paddingTop: 8,
    flexShrink: 1,
  },
});
