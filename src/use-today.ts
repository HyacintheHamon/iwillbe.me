import { useEffect, useState } from "react";
import { AppState } from "react-native";
import { dayInZone } from "./journey";
import { usePractice } from "./practice";

// Mission eligibility changes within the day as well as at midnight. Keep
// open suggestion sheets current, including when returning from background.
export function useLocalNow() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const update = () => setNow(new Date());
    const timer = setInterval(update, 60_000);
    const listener = AppState.addEventListener("change", (state) => {
      if (state === "active") update();
    });
    return () => {
      clearInterval(timer);
      listener.remove();
    };
  }, []);
  return now;
}

export function useToday() {
  const { data } = usePractice();
  const timezone = data.profile.timezone;
  const [clock, setClock] = useState(() => ({
    timezone,
    day: dayInZone(timezone),
  }));
  useEffect(() => {
    const update = () => {
      const day = dayInZone(timezone);
      setClock((previous) =>
        previous.timezone === timezone && previous.day === day
          ? previous
          : { timezone, day },
      );
    };
    update();
    const timer = setInterval(update, 60_000);
    const listener = AppState.addEventListener("change", (state) => {
      if (state === "active") update();
    });
    return () => {
      clearInterval(timer);
      listener.remove();
    };
  }, [timezone]);
  // A profile/timezone change must affect this render, before the effect runs.
  return clock.timezone === timezone ? clock.day : dayInZone(timezone);
}
