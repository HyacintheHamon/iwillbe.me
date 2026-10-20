import React, { useEffect, useState } from "react";
import { AppState, Platform, View } from "react-native";
import * as LocalAuthentication from "expo-local-authentication";
import * as SecureStore from "expo-secure-store";
import { Body, Button, C, Notice, Title } from "./ui";
let enabledOnDevice = false;
const KEY = "iwillbe.device-lock";
export async function setDeviceLock(enabled: boolean) {
  if (Platform.OS === "web")
    throw new Error("Use Lock this session to sign out securely on the web.");
  if (enabled) {
    if (!(await LocalAuthentication.isEnrolledAsync()))
      throw new Error(
        "Set up Face ID, a fingerprint or device authentication in your phone settings first.",
      );
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: "Protect your private practice",
    });
    if (!result.success) throw new Error("Device unlock was cancelled.");
  }
  await SecureStore.setItemAsync(KEY, enabled ? "on" : "off");
  enabledOnDevice = enabled;
}
export function PrivacyLock({ children }: { children: React.ReactNode }) {
  const [locked, setLocked] = useState(Platform.OS !== "web"),
    [error, setError] = useState("");
  useEffect(() => {
    if (Platform.OS === "web") return;
    let alive = true;
    const check = async () => {
      const enabled = await SecureStore.getItemAsync(KEY);
      enabledOnDevice = enabled === "on";
      if (alive) setLocked(enabledOnDevice);
    };
    void check();
    const sub = AppState.addEventListener("change", (state) => {
      if (state !== "active" && enabledOnDevice) setLocked(true);
    });
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);
  return (
    <View style={{ flex: 1 }}>
      <View style={{ flex: 1, display: locked ? "none" : "flex" }}>
        {children}
      </View>
      {locked ? (
        <View
          style={{
            flex: 1,
            backgroundColor: C.paper,
            padding: 28,
            justifyContent: "center",
            gap: 24,
          }}
        >
          <Title>Your private space.</Title>
          <Body>Unlock with your device to return to your practice.</Body>
          <Button
            label="Unlock my practice"
            onPress={async () => {
              try {
                const result = await LocalAuthentication.authenticateAsync({
                  promptMessage: "Unlock your practice",
                });
                if (result.success) setLocked(false);
                else
                  setError(
                    "Your space is still locked. Try again when you are ready.",
                  );
              } catch {
                setError(
                  "Device authentication is unavailable. Please try again.",
                );
              }
            }}
          />
          <Notice text={error} tone="error" />
        </View>
      ) : null}
    </View>
  );
}
