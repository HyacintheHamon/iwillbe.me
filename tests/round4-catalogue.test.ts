import assert from "node:assert/strict";
import test from "node:test";
import previousMissions from "../data/round3/missions.json";
import previousBooks from "../data/round3/learning-shelf.json";
import source from "../data/round4/source.json";
import { LEARNING_SHELF, MISSIONS } from "../src/round2";

test("Round 4 retains every historical mission and book unchanged", () => {
  const current = new Map(MISSIONS.map((mission) => [mission.id, mission]));
  assert.equal(current.size, MISSIONS.length);
  for (const mission of previousMissions)
    assert.deepEqual(current.get(mission.id), mission);
  const shelf = new Map(LEARNING_SHELF.map((book) => [book.id, book]));
  for (const book of previousBooks) assert.deepEqual(shelf.get(book.id), book);
  assert.equal(source.missions, MISSIONS.length);
  assert.equal(
    source.added_missions,
    MISSIONS.length - previousMissions.length,
  );
  assert.equal(source.books, LEARNING_SHELF.length);
  assert.equal(source.added_books, 1);
});

test("each new ladder has five ordered steps with all three sizes", () => {
  for (const { code, name } of source.new_ladders) {
    const ladder = MISSIONS.filter((mission) =>
      mission.id.startsWith(`${code}-`),
    );
    assert.equal(ladder.length, 15, name);
    for (let step = 1; step <= 5; step++) {
      const family = ladder.filter((mission) => mission.ladder_step === step);
      assert.deepEqual(
        new Set(family.map((mission) => mission.level)),
        new Set(["easy", "normal", "stretch"]),
      );
      assert.deepEqual(
        new Set(family.map((mission) => mission.family_id)),
        new Set([`${code}-${step}`]),
      );
      const stage =
        step === 1
          ? "Want to try"
          : step === 2
            ? "From time to time"
            : step === 5
              ? "All in"
              : "Into it";
      assert.ok(family.every((mission) => mission.stage === stage));
      assert.ok(
        family.every(
          (mission) =>
            mission.ladder === name &&
            mission.type === "do" &&
            mission.priorities.length &&
            mission.mission_text &&
            mission.first_step,
        ),
      );
    }
  }
});

test("new shelf addition keeps the source title, author and permitted priority tags", () => {
  const book = LEARNING_SHELF.find((row) => row.id === "book-57");
  assert.equal(book?.title, "Changeable");
  assert.equal(book?.author, "J. Stuart Ablon");
  assert.deepEqual(book?.priorities, [
    "patient",
    "a clear thinker",
    "good with people",
  ]);
});
