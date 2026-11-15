-- Round 2 asks for ten priorities. The original eight-value limit rejected
-- both Go to Today and Skip when they saved the completed onboarding profile.
-- Keep older profiles valid, retain a bounded array, and leave all data,
-- ownership policies and optimistic-concurrency triggers unchanged.
alter table public.profiles
  drop constraint profiles_values_check,
  add constraint profiles_values_check check (cardinality("values") <= 10);
