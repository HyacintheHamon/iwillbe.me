import { useEffect } from "react";
import { Platform } from "react-native";
import { router } from "expo-router";
import * as Notifications from "expo-notifications";
export function NotificationRouting() {
  useEffect(() => {
    if (Platform.OS === "web") return;
    const open = (r: Notifications.NotificationResponse | null) => {
      const url = r?.notification.request.content.data?.url;
      if (url === "/ritual" || url === "/reflect") router.push(url);
    };
    void Notifications.getLastNotificationResponseAsync().then(open);
    const sub = Notifications.addNotificationResponseReceivedListener(open);
    return () => sub.remove();
  }, []);
  return null;
}
