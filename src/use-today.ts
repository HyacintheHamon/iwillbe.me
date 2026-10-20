import { useEffect, useState } from "react";
import { AppState } from "react-native";
import { localDay } from "./domain";

export function useToday() {
  const [day, setDay] = useState(localDay);
  useEffect(() => {
    const update = () => setDay(localDay());
    const timer = setInterval(update, 60_000);
    const listener = AppState.addEventListener("change", (state) => {
      if (state === "active") update();
    });
    return () => {
      clearInterval(timer);
      listener.remove();
    };
  }, []);
  return day;
}
