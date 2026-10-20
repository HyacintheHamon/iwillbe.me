import { useEffect, useState } from "react";
import { Platform } from "react-native";
import * as Linking from "expo-linking";
import { supabase } from "./supabase";

export function authRedirect(path: "account" | "reset-password") {
  return Platform.OS === "web"
    ? `${window.location.origin}/${path}`
    : `iwillbe://${path}`;
}

// Web tokens are handled by supabase-js; native apps exchange them explicitly.
export function useAuthRedirect() {
  const url = Linking.useLinkingURL();
  const [error, setError] = useState("");
  useEffect(() => {
    if (!url) return;
    const params = new URLSearchParams(
      url.split("#")[1] || url.split("?")[1] || "",
    );
    if (Platform.OS === "web") return;
    const access_token = params.get("access_token");
    const refresh_token = params.get("refresh_token");
    if (access_token && refresh_token) {
      void supabase.auth
        .setSession({ access_token, refresh_token })
        .then(({ error }) => {
          if (error)
            setError("This link has expired. Please request a new one.");
        });
    }
  }, [url]);
  const linkFailed =
    url &&
    new URLSearchParams(url.split("#")[1] || url.split("?")[1] || "").has(
      "error_description",
    );
  return linkFailed
    ? "This link has expired. Please request a new one."
    : error;
}
