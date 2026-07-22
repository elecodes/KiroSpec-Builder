/**
 * Infrastructure Layer — Central export point.
 */

export { loadConfig, AppConfigSchema, type AppConfig } from "./config/app.config.js";
export { createContainer, type Container } from "./di/container.js";
export { StructuredLogger } from "./logging/structured-logger.js";
export { createServer } from "./web/server.js";
export { startStdioServer, getToolDefinition } from "./mcp/server.js";
