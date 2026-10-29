import React from "react";
import { Redirect, usePathname, useLocalSearchParams } from "expo-router";
import { usePractice } from "./practice";
import { requiresAccount, safeDestination } from "./access";

export function AccessGate({ children }: { children: React.ReactNode }) {
  const { session, loading } = usePractice();
  const path = usePathname();
  const { question } = useLocalSearchParams<{ question?: string }>();
  if (loading) return null;
  if (!session && requiresAccount(path)) {
    return (
      <Redirect
        href={{
          pathname: "/account",
          params: {
            returnTo: safeDestination(path),
            reason: path === "/chloe" ? "chloe" : "join",
            ...(path === "/chloe" && typeof question === "string"
              ? { question: question.slice(0, 500) }
              : {}),
          },
        }}
      />
    );
  }
  return children;
}

export function withAccount(Screen: React.ComponentType) {
  return function AccountScreen() {
    return (
      <AccessGate>
        <Screen />
      </AccessGate>
    );
  };
}
