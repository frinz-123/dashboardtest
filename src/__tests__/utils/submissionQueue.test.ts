import {
  findActiveDuplicateSubmission,
  isActiveDuplicateStatus,
} from "@/utils/submissionQueue";

describe("submissionQueue dedupe helpers", () => {
  test("blocks the same submission id while it is pending", () => {
    const existing = [{ id: "same-id", status: "pending" as const }];

    expect(findActiveDuplicateSubmission(existing, "same-id")).toEqual(
      existing[0],
    );
  });

  test("blocks the same submission id while it is sending", () => {
    const existing = [{ id: "same-id", status: "sending" as const }];

    expect(findActiveDuplicateSubmission(existing, "same-id")).toEqual(
      existing[0],
    );
  });

  test("allows the same submission id after the queue item failed", () => {
    const existing = [{ id: "same-id", status: "failed" as const }];

    expect(findActiveDuplicateSubmission(existing, "same-id")).toBeUndefined();
  });

  test("allows different ids even when another active item exists", () => {
    const existing = [{ id: "queued-id", status: "pending" as const }];

    expect(findActiveDuplicateSubmission(existing, "new-id")).toBeUndefined();
  });

  test("treats only pending and sending as active duplicate states", () => {
    expect(isActiveDuplicateStatus("pending")).toBe(true);
    expect(isActiveDuplicateStatus("sending")).toBe(true);
    expect(isActiveDuplicateStatus("failed")).toBe(false);
    expect(isActiveDuplicateStatus("completed")).toBe(false);
  });
});
