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
import { Inter_400Regular } from "@expo-google-fonts/inter/400Regular";
import { Inter_500Medium } from "@expo-google-fonts/inter/500Medium";
import { Inter_600SemiBold } from "@expo-google-fonts/inter/600SemiBold";
import { Inter_800ExtraBold } from "@expo-google-fonts/inter/800ExtraBold";
import { SunIcon as Sun } from "phosphor-react-native/src/icons/Sun";
import { GraphIcon as Graph } from "phosphor-react-native/src/icons/Graph";
import { UserCircleIcon as UserCircle } from "phosphor-react-native/src/icons/UserCircle";
import { usePractice, PracticeProvider } from "../src/practice";
import { NotificationRouting } from "../src/notification-routing";
import { PrivacyLock } from "../src/privacy-lock";
import { C, F } from "../src/ui";
export default function Layout() {
  const [loaded, error] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_800ExtraBold,
  });
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
          <AppShell />
        </PrivacyLock>
      </PracticeProvider>
    </SafeAreaProvider>
  );
}
function AppShell() {
  const path = usePathname();
  const { session } = usePractice();
  const tabs = !!session && ["/", "/galaxy", "/settings"].includes(path);
  const landing = !session && ["/", "/about"].includes(path);
  return (
    <View style={styles.outer}>
      <SafeAreaView
        style={[styles.app, landing && { maxWidth: 1100 }]}
        edges={["top", "bottom"]}
      >
        <StatusBar style="dark" />
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
                { path: "/galaxy", label: "My map", Icon: Graph },
                { path: "/settings", label: "Me", Icon: UserCircle },
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
  );
}
const styles = StyleSheet.create({
  outer: { flex: 1, backgroundColor: "#ECE9E2", alignItems: "center" },
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
