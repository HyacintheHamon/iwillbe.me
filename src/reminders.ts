import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import type { Practice } from "./domain";
import { localDay } from "./domain";
const KEY = "iwillbe.reminders.v2";
let pending: Promise<void> = Promise.resolve();
export async function scheduleReminders(
  morning: string,
  evening: string,
  practice?: Practice,
) {
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
  await AsyncStorage.setItem(KEY, JSON.stringify({ morning, evening }));
  await syncReminders(practice);
}
export function syncReminders(practice?: Practice) {
  if (Platform.OS === "web") return Promise.resolve();
  pending = pending
    .catch(() => {})
    .then(async () => {
      const stored = await AsyncStorage.getItem(KEY);
      if (!stored) return;
      const { morning, evening } = JSON.parse(stored);
      await Notifications.cancelAllScheduledNotificationsAsync();
      for (let offset = 0; offset < 14; offset++)
        for (const [time, title, body, url] of [
          [
            morning,
            "A little more you.",
            "Make room for one small thing today.",
            "/ritual",
          ],
          [
            evening,
            "A moment to look back.",
            "Did it light you up?",
            "/reflect",
          ],
        ]) {
          const when = new Date();
          when.setDate(when.getDate() + offset);
          const [hour, minute] = time.split(":").map(Number);
          when.setHours(hour, minute, 0, 0);
          if (when.getTime() <= Date.now()) continue;
          const intention = practice?.intentions.find(
            (i) => i.day === localDay(when),
          );
          if (url === "/ritual" && intention) continue;
          if (
            url === "/reflect" &&
            intention &&
            practice?.checkIns.some((c) => c.intention_id === intention.id)
          )
            continue;
          await Notifications.scheduleNotificationAsync({
            content: { title, body, data: { url } },
            trigger: {
              type: Notifications.SchedulableTriggerInputTypes.DATE,
              date: when,
              channelId: "rituals",
            },
          });
        }
    });
  return pending;
}
export async function cancelReminders() {
  if (Platform.OS !== "web") {
    await AsyncStorage.removeItem(KEY);
    await pending.catch(() => {});
    await Notifications.cancelAllScheduledNotificationsAsync();
  }
}
