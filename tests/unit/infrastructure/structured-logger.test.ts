import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { StructuredLogger } from "../../../src/infrastructure/logging/structured-logger.js";

describe("StructuredLogger", () => {
  let writeSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    writeSpy = vi.spyOn(process.stdout, "write").mockReturnValue(true);
  });

  afterEach(() => {
    writeSpy.mockRestore();
  });

  it("should emit JSON log entries to stdout", () => {
    const logger = new StructuredLogger("info");
    logger.info("Test message");

    expect(writeSpy).toHaveBeenCalledTimes(1);
    const output = writeSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output.trim());
    expect(parsed.msg).toBe("Test message");
    expect(parsed.level).toBe(30); // info = 30
    expect(parsed.time).toBeGreaterThan(0);
  });

  it("should include context in log entries", () => {
    const logger = new StructuredLogger("info");
    logger.info("With context", { key: "value", count: 42 });

    const output = writeSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output.trim());
    expect(parsed.key).toBe("value");
    expect(parsed.count).toBe(42);
  });

  it("should respect log level filtering", () => {
    const logger = new StructuredLogger("warn");
    logger.info("Should not appear");
    logger.warn("Should appear");

    expect(writeSpy).toHaveBeenCalledTimes(1);
    const output = writeSpy.mock.calls[0][0] as string;
    expect(output).toContain("Should appear");
  });

  it("should log stage data with logStage()", () => {
    const logger = new StructuredLogger("info");
    logger.logStage("requirements", {
      durationMs: 1500,
      tokensUsed: 200,
      success: true,
    });

    const output = writeSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output.trim());
    expect(parsed.stage).toBe("requirements");
    expect(parsed.durationMs).toBe(1500);
    expect(parsed.tokensUsed).toBe(200);
    expect(parsed.success).toBe(true);
  });

  it("should include error details in error()", () => {
    const logger = new StructuredLogger("info");
    const testError = new Error("Something broke");
    logger.error("Operation failed", testError, { operation: "test" });

    const output = writeSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output.trim());
    expect(parsed.level).toBe(50); // error = 50
    expect(parsed.err.type).toBe("Error");
    expect(parsed.err.message).toBe("Something broke");
    expect(parsed.operation).toBe("test");
  });

  it("should log failed stages at error level", () => {
    const logger = new StructuredLogger("info");
    logger.logStage("design", { durationMs: 500, success: false, error: "LLM timeout" });

    const output = writeSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output.trim());
    expect(parsed.level).toBe(50); // error
    expect(parsed.error).toBe("LLM timeout");
  });
});
