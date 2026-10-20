import React from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Stack, router, usePathname } from "expo-router";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useFonts } from "expo-font";
import { Fraunces_500Medium } from "@expo-google-fonts/fraunces/500Medium";
import { Fraunces_600SemiBold } from "@expo-google-fonts/fraunces/600SemiBold";
import { DMSans_400Regular } from "@expo-google-fonts/dm-sans/400Regular";
import { DMSans_500Medium } from "@expo-google-fonts/dm-sans/500Medium";
import { DMSans_600SemiBold } from "@expo-google-fonts/dm-sans/600SemiBold";
import { SunIcon as Sun } from "phosphor-react-native/src/icons/Sun";
import { GraphIcon as Graph } from "phosphor-react-native/src/icons/Graph";
import { ChatCircleIcon as ChatCircle } from "phosphor-react-native/src/icons/ChatCircle";
import { PracticeProvider } from "../src/practice";
import { NotificationRouting } from "../src/notification-routing";
import { PrivacyLock } from "../src/privacy-lock";
import { C, F } from "../src/ui";
export default function Layout() {
  const [loaded, error] = useFonts({
    Fraunces_500Medium,
    Fraunces_600SemiBold,
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_600SemiBold,
  });
  const path = usePathname();
  const tabs = ["/", "/galaxy", "/chloe"].includes(path);
  if (!loaded && !error)
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: C.paper,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <ActivityIndicator color={C.gold} />
      </View>
    );
  return (
    <SafeAreaProvider>
      <PracticeProvider>
        <PrivacyLock>
          <NotificationRouting />
          <View style={styles.outer}>
            <SafeAreaView style={styles.app} edges={["top", "bottom"]}>
              <StatusBar style="light" />
              <View style={{ flex: 1 }}>
                <Stack
                  screenOptions={{
                    headerShown: false,
                    contentStyle: { backgroundColor: C.paper },
                    animation: "none",
                    animationDuration: 180,
                  }}
                />
              </View>
              {tabs && (
                <View style={styles.tabs} accessibilityRole="tablist">
                  {(
                    [
                      { path: "/", label: "Today", Icon: Sun },
                      { path: "/galaxy", label: "Galaxy", Icon: Graph },
                      { path: "/chloe", label: "Chloe", Icon: ChatCircle },
                    ] as const
                  ).map(({ path: to, label, Icon }) => (
                    <Pressable
                      accessibilityRole="tab"
                      accessibilityLabel={label}
                      accessibilityState={{ selected: path === to }}
                      {...(Platform.OS === "web"
                        ? { "aria-selected": path === to }
                        : {})}
                      onPress={() => router.replace(to)}
                      key={to}
                      style={styles.tab}
                    >
                      <Icon
                        size={28}
                        weight="light"
                        color={path === to ? C.gold : C.ink}
                      />
                      <Text
                        style={{
                          fontFamily: F.medium,
                          fontSize: 12,
                          color: path === to ? C.gold : C.ink,
                        }}
                      >
                        {label}
                      </Text>
                      <View
                        style={{
                          height: 3,
                          width: 22,
                          borderRadius: 2,
                          backgroundColor: path === to ? C.gold : "transparent",
                        }}
                      />
                    </Pressable>
                  ))}
                </View>
              )}
            </SafeAreaView>
          </View>
        </PrivacyLock>
      </PracticeProvider>
    </SafeAreaProvider>
  );
}
const styles = StyleSheet.create({
  outer: { flex: 1, backgroundColor: "#080912", alignItems: "center" },
  app: {
    flex: 1,
    width: "100%",
    maxWidth: 430,
    backgroundColor: C.paper,
    ...(Platform.OS === "web" ? { boxShadow: "0px 0px 70px #10152B0A" } : {}),
  },
  tabs: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderColor: C.line,
    paddingTop: 12,
    paddingBottom: 8,
    backgroundColor: C.paper,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    gap: 5,
    minHeight: 64,
    justifyContent: "center",
  },
});
