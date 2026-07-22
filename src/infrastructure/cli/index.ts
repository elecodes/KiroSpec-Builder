#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { loadConfig } from "../config/app.config.js";
import { createContainer } from "../di/container.js";
import { randomUUID } from "node:crypto";

/**
 * CLI Entrypoint for KiroSpec Builder.
 *
 * Usage:
 *   kirospec generate [options]
 *
 * Options:
 *   --input, -i <file>       Input file (reads from stdin if omitted)
 *   --output, -o <dir>       Output directory (default: .kiro/specs)
 *   --force                  Overwrite existing files without prompt
 *   --merge                  Append to existing files with incremented IDs
 *   --provider, -p <name>    Override LLM provider (openai, ollama)
 *   --help, -h               Show help
 *   --version, -v            Show version
 */

interface CliOptions {
  input?: string;
  output?: string;
  force?: boolean;
  merge?: boolean;
  provider?: string;
  help?: boolean;
  version?: boolean;
}

function parseArgs(args: string[]): CliOptions {
  const opts: CliOptions = {};
  let i = 0;

  while (i < args.length) {
    const arg = args[i];

    switch (arg) {
      case "--input":
      case "-i":
        opts.input = args[++i];
        break;
      case "--output":
      case "-o":
        opts.output = args[++i];
        break;
      case "--force":
        opts.force = true;
        break;
      case "--merge":
        opts.merge = true;
        break;
      case "--provider":
      case "-p":
        opts.provider = args[++i];
        break;
      case "--help":
      case "-h":
        opts.help = true;
        break;
      case "--version":
      case "-v":
        opts.version = true;
        break;
    }
    i++;
  }

  return opts;
}

function showHelp(): void {
  const help = `
KiroSpec Builder — AI-powered spec generation

Usage:
  kirospec generate [options]

Commands:
  generate        Generate .kiro/specs/ from input

Options:
  -i, --input <file>      Input file path (reads stdin if omitted)
  -o, --output <dir>      Output directory (default: .kiro/specs)
      --force             Overwrite existing files without prompt
      --merge             Append to existing files
  -p, --provider <name>   LLM provider override (openai, ollama)
  -h, --help              Show this help message
  -v, --version           Show version

Environment Variables:
  KIROSPEC_LLM_PROVIDER   Primary LLM provider (openai, ollama)
  OPENAI_API_KEY          OpenAI API key
  OPENAI_MODEL            OpenAI model (default: gpt-4o)
  OLLAMA_BASE_URL         Ollama URL (default: http://localhost:11434)
  OLLAMA_MODEL            Ollama model (default: llama3)
  OUTPUT_DIR              Default output directory
  LOG_LEVEL               Log level (trace, debug, info, warn, error)

Examples:
  kirospec generate -i feature.md
  cat idea.txt | kirospec generate
  kirospec generate -i prd.md -o ./specs --force
  kirospec generate -p ollama -i feature.txt
`;
  process.stdout.write(help.trim() + "\n");
}

function showVersion(): void {
  process.stdout.write("kirospec-builder v0.1.0\n");
}

async function readInput(inputPath?: string): Promise<string> {
  if (inputPath) {
    const resolved = resolve(inputPath);
    return readFileSync(resolved, "utf-8");
  }

  // Read from stdin
  return new Promise<string>((resolve, reject) => {
    const chunks: Buffer[] = [];
    process.stdin.setEncoding("utf-8");
    process.stdin.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    process.stdin.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
    process.stdin.on("error", reject);

    // If stdin is a TTY (interactive), show prompt
    if (process.stdin.isTTY) {
      process.stderr.write("Enter feature description (Ctrl+D to finish):\n");
    }
  });
}

export async function main(argv: string[] = process.argv.slice(2)): Promise<void> {
  const opts = parseArgs(argv);

  if (opts.help) {
    showHelp();
    return;
  }

  if (opts.version) {
    showVersion();
    return;
  }

  // Load config with optional provider override
  const envOverrides: Record<string, string> = {};
  if (opts.provider) {
    envOverrides.KIROSPEC_LLM_PROVIDER = opts.provider;
  }
  if (opts.output) {
    envOverrides.OUTPUT_DIR = opts.output;
  }

  let config;
  try {
    config = loadConfig({ ...process.env, ...envOverrides });
  } catch (error) {
    process.stderr.write(
      `Error: ${error instanceof Error ? error.message : "Configuration failed"}\n`,
    );
    process.exitCode = 1;
    return;
  }

  const outputDir = opts.output ?? config.outputDir;

  // TODO: Handle --force and --merge flags for existing specs

  // Read input
  let content: string;
  try {
    content = await readInput(opts.input);
  } catch (error) {
    process.stderr.write(
      `Error reading input: ${error instanceof Error ? error.message : "Unknown"}\n`,
    );
    process.exitCode = 1;
    return;
  }

  if (!content.trim()) {
    process.stderr.write("Error: No input provided. Use --input <file> or pipe via stdin.\n");
    process.exitCode = 1;
    return;
  }

  // Create container and run pipeline
  const container = createContainer(config);

  const rawInput = {
    id: randomUUID(),
    content: content.trim(),
    format: "text" as const,
    metadata: {
      timestamp: new Date().toISOString(),
      source: opts.input ?? "stdin",
      language: "en",
    },
  };

  process.stderr.write("🚀 Starting spec generation pipeline...\n");

  const result = await container.specGenerator.execute(rawInput, outputDir);

  if (result.success) {
    process.stderr.write("✅ Spec generation complete!\n");
    process.stderr.write(`   Output directory: ${outputDir}\n`);
    if (result.exports) {
      for (const exp of result.exports) {
        process.stderr.write(`   📄 ${exp.filePath} (${exp.sizeBytes} bytes)\n`);
      }
    }
    process.stderr.write(`   ⏱️  Total time: ${result.totalDurationMs}ms\n`);
  } else {
    process.stderr.write("❌ Spec generation failed.\n");
    for (const err of result.errors) {
      process.stderr.write(`   [${err.stage}] ${err.code}: ${err.message}\n`);
    }
    process.exitCode = 1;
  }
}

// Run if executed directly
const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  main().catch((error) => {
    process.stderr.write(`Fatal error: ${error instanceof Error ? error.message : error}\n`);
    process.exitCode = 1;
  });
}
