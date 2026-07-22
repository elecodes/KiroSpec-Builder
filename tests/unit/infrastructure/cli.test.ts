import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// We test the arg parser logic by importing main and checking behavior
// Since main() relies on env vars and file system, we test parseArgs indirectly

describe("CLI", () => {
  let stderrSpy: ReturnType<typeof vi.spyOn>;
  let stdoutSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    stderrSpy = vi.spyOn(process.stderr, "write").mockReturnValue(true);
    stdoutSpy = vi.spyOn(process.stdout, "write").mockReturnValue(true);
  });

  afterEach(() => {
    stderrSpy.mockRestore();
    stdoutSpy.mockRestore();
  });

  it("should show help with --help flag", async () => {
    const { main } = await import("../../../src/infrastructure/cli/index.js");
    await main(["--help"]);

    const output = stdoutSpy.mock.calls.map((c) => c[0]).join("");
    expect(output).toContain("KiroSpec Builder");
    expect(output).toContain("--input");
    expect(output).toContain("--output");
    expect(output).toContain("--force");
    expect(output).toContain("--merge");
    expect(output).toContain("--provider");
  });

  it("should show help with -h flag", async () => {
    const { main } = await import("../../../src/infrastructure/cli/index.js");
    await main(["-h"]);

    const output = stdoutSpy.mock.calls.map((c) => c[0]).join("");
    expect(output).toContain("KiroSpec Builder");
  });

  it("should show version with --version flag", async () => {
    const { main } = await import("../../../src/infrastructure/cli/index.js");
    await main(["--version"]);

    const output = stdoutSpy.mock.calls.map((c) => c[0]).join("");
    expect(output).toContain("0.1.0");
  });

  it("should show version with -v flag", async () => {
    const { main } = await import("../../../src/infrastructure/cli/index.js");
    await main(["-v"]);

    const output = stdoutSpy.mock.calls.map((c) => c[0]).join("");
    expect(output).toContain("0.1.0");
  });
});
