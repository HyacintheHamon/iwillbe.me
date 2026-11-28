import React, { useCallback, useEffect, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";
import { usePractice } from "./practice";
import { entryInput } from "./journey";
import { onboardingSchedule } from "./onboarding-followups";
import { CHLOE_INTRO } from "./today-flow";
import { Body, C } from "./ui";

export function FirstTodayIntro() {
  const { data, session, putEntry } = usePractice();
  const [visible, setVisible] = useState(false);
  const current = useRef({ data, putEntry });
  useEffect(() => {
    current.current = { data, putEntry };
  }, [data, putEntry]);
  const request = useRef<{ owner: string; pending: Promise<unknown> } | null>(
    null,
  );
  const owner = session?.user.id;
  useFocusEffect(
    useCallback(() => {
      // The previous Today route can remain mounted behind onboarding. It must
      // not consume the once-only introduction before the person can see it.
      const { data: practice, putEntry: save } = current.current;
      const prior = practice.entries.find(
        (entry) =>
          entry.kind === "preferences" && entry.title === "Chloe introduction",
      );
      const show =
        !!owner && !!onboardingSchedule(practice) && !prior?.meta.intro_shown;
      setVisible(show);
      if (show && owner && request.current?.owner !== owner) {
        request.current = {
          owner,
          pending: save(
            entryInput("preferences", "Chloe introduction", {
              ...prior,
              meta: { ...prior?.meta, intro_shown: true },
            }),
          ).catch(() => {
            request.current = null;
          }),
        };
      }
      // Saving the marker must not hide the line during its first visible visit.
      return () => setVisible(false);
    }, [owner]),
  );
  return visible ? (
    <Body style={{ color: C.muted, fontSize: 14, lineHeight: 22 }}>
      {CHLOE_INTRO}
    </Body>
  ) : null;
}
