import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import type { Practice } from "./domain";
import { reminderCalendar, validReminderTime } from "./reminder-calendar";

const KEY = "iwillbe.reminders.v2";
let pending: Promise<void> = Promise.resolve();
let generation = 0;
let lastSchedule = "";
export const phoneTimeZone = () =>
  Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
export async function reminderTimezone() {
  return Platform.OS !== "web" && (await AsyncStorage.getItem(KEY))
    ? phoneTimeZone()
    : null;
}
export function downloadReminderCalendar(
  morning: string,
  evening: string,
  timezone: string,
) {
  if (Platform.OS !== "web")
    throw new Error("Calendar download is available in your browser.");
  const contents = reminderCalendar({ morning, evening, timezone });
  const url = URL.createObjectURL(
    new Blob([contents], { type: "text/calendar;charset=utf-8" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = "iwillbe-check-in-reminders.ics";
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export async function scheduleReminders(
  morning: string,
  evening: string,
  practice?: Practice,
) {
  const requestedGeneration = generation;
  if (Platform.OS === "web")
    throw new Error("Add these reminders to your calendar from Settings.");
  if (![morning, evening].every(validReminderTime))
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
  pending = pending
    .catch(() => {})
    .then(async () => {
      if (requestedGeneration !== generation)
        throw new Error(
          "Reminders were turned off. You can turn them back on in Settings.",
        );
      await AsyncStorage.setItem(
        KEY,
        JSON.stringify({ morning, evening, policy: "phone-local" }),
      );
    });
  await pending;
  if (requestedGeneration !== generation) return;
  lastSchedule = "";
  await syncReminders(practice);
}
export function syncReminders(_practice?: Practice) {
  if (Platform.OS === "web") return Promise.resolve();
  const requestedGeneration = generation;
  pending = pending
    .catch(() => {})
    .then(async () => {
      if (requestedGeneration !== generation) return;
      const stored = await AsyncStorage.getItem(KEY);
      if (!stored) return;
      const { morning, evening } = JSON.parse(stored);
      if (![morning, evening].every(validReminderTime))
        throw new Error("Check your reminder times in Settings.");
      const permission = await Notifications.getPermissionsAsync();
      if (!permission.granted)
        throw new Error(
          "Reminders are paused. Allow notifications in your phone settings to turn them back on.",
        );
      const fingerprint = `${morning}/${evening}/${phoneTimeZone()}`;
      if (fingerprint === lastSchedule) {
        const scheduled =
          await Notifications.getAllScheduledNotificationsAsync();
        if (
          ["/ritual", "/reflect"].every((url) =>
            scheduled.some((item) => item.content.data?.url === url),
          )
        )
          return;
      }
      await Notifications.cancelAllScheduledNotificationsAsync();
      if (requestedGeneration !== generation) return;
      try {
        for (const [time, title, body, url] of [
          [
            morning,
            "A little room for today",
            "One small commitment, then back to your day.",
            "/ritual",
          ],
          [
            evening,
            "A moment to look back",
            "A short reflection, when it helps.",
            "/reflect",
          ],
        ]) {
          const [hour, minute] = time.split(":").map(Number);
          await Notifications.scheduleNotificationAsync({
            content: { title, body, data: { url } },
            trigger:
              Platform.OS === "ios"
                ? {
                    type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
                    hour,
                    minute,
                    repeats: true,
                  }
                : {
                    type: Notifications.SchedulableTriggerInputTypes.DAILY,
                    hour,
                    minute,
                    channelId: "rituals",
                  },
          });
        }
        if (requestedGeneration !== generation)
          await Notifications.cancelAllScheduledNotificationsAsync();
        else lastSchedule = fingerprint;
      } catch (error) {
        lastSchedule = "";
        await Notifications.cancelAllScheduledNotificationsAsync();
        throw error;
      }
    });
  return pending;
}
export async function cancelReminders() {
  generation += 1;
  lastSchedule = "";
  if (Platform.OS === "web") return;
  pending = pending
    .catch(() => {})
    .then(async () => {
      await AsyncStorage.removeItem(KEY);
      await Notifications.cancelAllScheduledNotificationsAsync();
    });
  await pending;
}
