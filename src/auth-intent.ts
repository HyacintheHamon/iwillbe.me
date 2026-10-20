import AsyncStorage from "@react-native-async-storage/async-storage";
import { draftKey } from "./drafts";
export const AUTH_INTENT_KEY = "iwillbe.auth.intent";
const destinations = [
  "/",
  "/chloe",
  "/settings",
  "/galaxy",
  "/ritual",
  "/history",
  "/connections",
  "/membership",
  "/why",
  "/explore",
  "/rhythms",
  "/telescope",
] as const;
export function safeDestination(value?: string) {
  return destinations.find((path) => path === value) || "/";
}
export async function rememberAuthIntent(returnTo?: string, reason?: string) {
  const intent = {
    returnTo: safeDestination(returnTo),
    reason: reason || "save",
  };
  await AsyncStorage.setItem(AUTH_INTENT_KEY, JSON.stringify(intent));
  return intent;
}
export async function readAuthIntent() {
  const saved = await AsyncStorage.getItem(AUTH_INTENT_KEY);
  const intent = saved ? JSON.parse(saved) : {};
  return {
    returnTo: safeDestination(intent.returnTo),
    reason: intent.reason || "save",
  };
}
export async function finishAuthIntent(owner: string, returnTo: string) {
  // Only the explicitly requested conversation draft follows the sign-in flow.
  if (returnTo === "/chloe") {
    const guest = await AsyncStorage.getItem(draftKey("chloe"));
    const account = await AsyncStorage.getItem(draftKey("chloe", owner));
    if (guest && JSON.parse(guest).input) {
      if (!account || !JSON.parse(account).input)
        await AsyncStorage.setItem(draftKey("chloe", owner), guest);
      else if (JSON.parse(account).input !== JSON.parse(guest).input)
        await AsyncStorage.setItem(draftKey("chloe.incoming", owner), guest);
    }
  }
  await AsyncStorage.removeItem(AUTH_INTENT_KEY);
}
