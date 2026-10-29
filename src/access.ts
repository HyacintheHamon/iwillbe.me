// The public introduction never opens a personal question before sign-in.
const publicPaths = new Set([
  "/",
  "/about",
  "/account",
  "/privacy",
  "/invite",
  "/reset-password",
]);
export function requiresAccount(path: string) {
  return !publicPaths.has(path.replace(/\/$/, "") || "/");
}
export const destinations = [
  "/",
  "/onboarding",
  "/chloe",
  "/settings",
  "/galaxy",
  "/ritual",
  "/reflect",
  "/history",
  "/connections",
  "/membership",
  "/why",
  "/explore",
  "/rhythms",
  "/telescope",
] as const;
export function safeDestination(value?: string) {
  return destinations.find((path) => path === value) || "/";
}
export function afterSignIn(returnTo: string, onboarded: boolean) {
  const destination = safeDestination(returnTo);
  if (destination === "/" && !onboarded) return "/onboarding";
  if (destination === "/onboarding" && onboarded) return "/";
  return destination;
}
