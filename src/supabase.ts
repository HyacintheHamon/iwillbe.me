import "react-native-url-polyfill/auto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AppState, Platform } from "react-native";
import { createClient, processLock } from "@supabase/supabase-js";
export const supabaseUrl =
  process.env.EXPO_PUBLIC_SUPABASE_URL ||
  "https://mvhqovdznrzoduntyryh.supabase.co";
const publishableKey =
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  "sb_publishable_vftstRIF-w-f0Vzs17Vjhw_BpHKEzz2";
export const supabase = createClient(supabaseUrl, publishableKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: Platform.OS === "web",
    lock: processLock,
  },
});
if (Platform.OS !== "web")
  AppState.addEventListener("change", (state) => {
    if (state === "active") supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
