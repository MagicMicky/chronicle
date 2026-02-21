import { describe, it, expect } from "bun:test";
import { parseMarkers, formatMarkerSummary, type ParsedMarkers } from "./parser";

describe("parseMarkers", () => {
  it("extracts thought markers (> prefix)", () => {
    const content = "> This is a thought\n> Another thought";
    const result = parseMarkers(content);
    expect(result.thoughts).toEqual(["This is a thought", "Another thought"]);
  });

  it("extracts important/decision markers (! prefix)", () => {
    const content = "! Critical decision made\n! Another important point";
    const result = parseMarkers(content);
    expect(result.important).toEqual([
      "Critical decision made",
      "Another important point",
    ]);
  });

  it("extracts question markers (? prefix)", () => {
    const content = "? What is the timeline?\n? Who is responsible?";
    const result = parseMarkers(content);
    expect(result.questions).toEqual([
      "What is the timeline?",
      "Who is responsible?",
    ]);
  });

  it("extracts action items ([] prefix)", () => {
    const content = "[] Send the report\n[] Follow up with team";
    const result = parseMarkers(content);
    expect(result.actions).toEqual(["Send the report", "Follow up with team"]);
  });

  it("extracts completed action items ([x] prefix)", () => {
    const content = "[x] Already done task\n[X] Also completed";
    const result = parseMarkers(content);
    expect(result.actions).toEqual([
      "[DONE] Already done task",
      "[DONE] Also completed",
    ]);
  });

  it("extracts person references (@name: prefix)", () => {
    const content = "@alice: Said something important\n@bob: Made a suggestion";
    const result = parseMarkers(content);
    expect(result.attributions).toEqual([
      { person: "alice", said: "Said something important" },
      { person: "bob", said: "Made a suggestion" },
    ]);
  });

  it("handles empty input", () => {
    const result = parseMarkers("");
    expect(result.thoughts).toEqual([]);
    expect(result.important).toEqual([]);
    expect(result.questions).toEqual([]);
    expect(result.actions).toEqual([]);
    expect(result.attributions).toEqual([]);
  });

  it("handles input with no markers", () => {
    const content =
      "Just some regular text\nAnother line\nNothing special here";
    const result = parseMarkers(content);
    expect(result.thoughts).toEqual([]);
    expect(result.important).toEqual([]);
    expect(result.questions).toEqual([]);
    expect(result.actions).toEqual([]);
    expect(result.attributions).toEqual([]);
  });

  it("handles mixed markers", () => {
    const content = [
      "> My thought on this",
      "! Important decision",
      "? What about budget?",
      "[] Follow up with finance",
      "@alice: We need more data",
      "Some regular text",
      "> Another thought",
    ].join("\n");

    const result = parseMarkers(content);
    expect(result.thoughts).toEqual([
      "My thought on this",
      "Another thought",
    ]);
    expect(result.important).toEqual(["Important decision"]);
    expect(result.questions).toEqual(["What about budget?"]);
    expect(result.actions).toEqual(["Follow up with finance"]);
    expect(result.attributions).toEqual([
      { person: "alice", said: "We need more data" },
    ]);
  });

  it("handles multi-line content with markers interspersed", () => {
    const content = [
      "# Meeting Notes",
      "",
      "Discussion about the project roadmap.",
      "",
      "> We should prioritize mobile",
      "More context about the discussion.",
      "! Deadline is March 15",
      "",
      "? Can we hire contractors?",
      "[] Draft hiring proposal",
      "[x] Review budget spreadsheet",
      "",
      "@john: The client wants it by Q2",
    ].join("\n");

    const result = parseMarkers(content);
    expect(result.thoughts).toHaveLength(1);
    expect(result.important).toHaveLength(1);
    expect(result.questions).toHaveLength(1);
    expect(result.actions).toHaveLength(2);
    expect(result.attributions).toHaveLength(1);
  });

  it("trims leading whitespace before checking markers", () => {
    const content = "  > Indented thought\n  ! Indented important";
    const result = parseMarkers(content);
    expect(result.thoughts).toEqual(["Indented thought"]);
    expect(result.important).toEqual(["Indented important"]);
  });

  it("ignores @ lines that do not match the attribution pattern", () => {
    const content = "@nocolon this should not match\n@valid: This should match";
    const result = parseMarkers(content);
    expect(result.attributions).toHaveLength(1);
    expect(result.attributions[0].person).toBe("valid");
  });

  it("requires a space after marker prefix", () => {
    // ">noSpace" should not match since there's no space after >
    const content = ">noSpace\n!noSpace\n?noSpace";
    const result = parseMarkers(content);
    expect(result.thoughts).toEqual([]);
    expect(result.important).toEqual([]);
    expect(result.questions).toEqual([]);
  });
});

describe("formatMarkerSummary", () => {
  it("formats summary with all marker types", () => {
    const markers: ParsedMarkers = {
      thoughts: ["a", "b"],
      important: ["c"],
      questions: ["d", "e", "f"],
      actions: ["g"],
      attributions: [
        { person: "alice", said: "x" },
        { person: "bob", said: "y" },
      ],
    };

    const summary = formatMarkerSummary(markers);
    expect(summary).toContain("Thoughts (2)");
    expect(summary).toContain("Important points (1)");
    expect(summary).toContain("Questions (3)");
    expect(summary).toContain("Action items (1)");
    expect(summary).toContain("alice");
    expect(summary).toContain("bob");
  });

  it("returns fallback message when no markers found", () => {
    const markers: ParsedMarkers = {
      thoughts: [],
      important: [],
      questions: [],
      actions: [],
      attributions: [],
    };

    const summary = formatMarkerSummary(markers);
    expect(summary).toBe("No semantic markers found in notes.");
  });

  it("deduplicates attribution people", () => {
    const markers: ParsedMarkers = {
      thoughts: [],
      important: [],
      questions: [],
      actions: [],
      attributions: [
        { person: "alice", said: "first" },
        { person: "alice", said: "second" },
        { person: "bob", said: "third" },
      ],
    };

    const summary = formatMarkerSummary(markers);
    // Should list "alice, bob" not "alice, alice, bob"
    expect(summary).toContain("alice, bob");
  });

  it("only includes sections for present marker types", () => {
    const markers: ParsedMarkers = {
      thoughts: ["one"],
      important: [],
      questions: [],
      actions: [],
      attributions: [],
    };

    const summary = formatMarkerSummary(markers);
    expect(summary).toContain("Thoughts (1)");
    expect(summary).not.toContain("Important");
    expect(summary).not.toContain("Questions");
    expect(summary).not.toContain("Action items");
    expect(summary).not.toContain("Attributions");
  });
});
