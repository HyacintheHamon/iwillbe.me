import AsyncStorage from "@react-native-async-storage/async-storage";
import { draftKey } from "./drafts";
import { safeDestination } from "./access";
export { safeDestination } from "./access";
export const AUTH_INTENT_KEY = "iwillbe.auth.intent";
export async function rememberAuthIntent(
  returnTo?: string,
  reason?: string,
  question?: string,
) {
  const intent = {
    returnTo: safeDestination(returnTo),
    reason: reason || "save",
    question: typeof question === "string" ? question.slice(0, 500) : "",
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
    question:
      typeof intent.question === "string" ? intent.question.slice(0, 500) : "",
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
