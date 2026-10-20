import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
export async function scheduleReminders(morning: string, evening: string) {
  if (Platform.OS === "web")
    throw new Error("Reminders are available in the iOS and Android app.");
  for (const time of [morning, evening])
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time))
      throw new Error("Use a time like 08:00 or 20:30.");
  if (Platform.OS === "android")
    await Notifications.setNotificationChannelAsync("rituals", {
      name: "Your daily rituals",
      importance: 3,
    });
  const permission = await Notifications.requestPermissionsAsync();
  if (!permission.granted)
    throw new Error(
      "Allow notifications in your phone settings to receive reminders.",
    );
  await Notifications.cancelAllScheduledNotificationsAsync();
  for (const [time, title, body] of [
    [
      morning,
      "A little more you.",
      "Take two minutes to choose what matters today.",
    ],
    [evening, "A moment to look back.", "How did your intention feel today?"],
  ]) {
    const [hour, minute] = time.split(":").map(Number);
    await Notifications.scheduleNotificationAsync({
      content: { title, body, data: { url: "/" } },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour,
        minute,
        channelId: "rituals",
      },
    });
  }
}
export async function cancelReminders() {
  if (Platform.OS !== "web")
    await Notifications.cancelAllScheduledNotificationsAsync();
}
