import { useEffect, useState } from "react";
import { AppState } from "react-native";
import { dayInZone } from "./journey";
import { usePractice } from "./practice";

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
