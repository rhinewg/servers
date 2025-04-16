import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
    CallToolRequestSchema,
    ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { createClient } from 'redis';

// Configuration
const REDIS_URL = process.argv[2] || "redis://localhost:6379";
const MAX_RETRIES = 5;
const MIN_RETRY_DELAY = 1000; // 1 second
const MAX_RETRY_DELAY = 30000; // 30 seconds

// Create Redis client with retry strategy
const redisClient = createClient({
    url: REDIS_URL,
    socket: {
        reconnectStrategy: (retries) => {
            if (retries >= MAX_RETRIES) {
                console.error(`Maximum retries (${MAX_RETRIES}) reached. Giving up.`);
                return new Error('Max retries reached');
            }
            const delay = Math.min(Math.pow(2, retries) * MIN_RETRY_DELAY, MAX_RETRY_DELAY);
            console.error(`Reconnection attempt ${retries + 1}/${MAX_RETRIES} in ${delay}ms`);
            return delay;
        }
    }
});

// Define Zod schemas for validation
const SetArgumentsSchema = z.object({
    key: z.string(),
    value: z.string(),
    expireSeconds: z.number().optional(),
});

const GetArgumentsSchema = z.object({
    key: z.string(),
});

const DeleteArgumentsSchema = z.object({
    key: z.string().or(z.array(z.string())),
});

const ListArgumentsSchema = z.object({
    pattern: z.string().default("*"),
});

// 新增的 Schema 定义
const HSetArgumentsSchema = z.object({
    key: z.string(),
    field: z.string(),
    value: z.string(),
});

const HGetArgumentsSchema = z.object({
    key: z.string(),
    field: z.string(),
});

const HGetAllArgumentsSchema = z.object({
    key: z.string(),
});

const IncrArgumentsSchema = z.object({
    key: z.string(),
});

const ExpireArgumentsSchema = z.object({
    key: z.string(),
    seconds: z.number(),
});

// Create server instance
const server = new Server(
    {
        name: "redis",
        version: "0.0.1"
    },
    {
        capabilities: {
            tools: {}
        }
    }
);

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
        tools: [
            {
                name: "set",
                description: "Set a Redis key-value pair with optional expiration",
                inputSchema: {
                    type: "object",
                    properties: {
                        key: {
                            type: "string",
                            description: "Redis key",
                        },
                        value: {
                            type: "string",
                            description: "Value to store",
                        },
                        expireSeconds: {
                            type: "number",
                            description: "Optional expiration time in seconds",
                        },
                    },
                    required: ["key", "value"],
                },
            },
            {
                name: "get",
                description: "Get value by key from Redis",
                inputSchema: {
                    type: "object",
                    properties: {
                        key: {
                            type: "string",
                            description: "Redis key to retrieve",
                        },
                    },
                    required: ["key"],
                },
            },
            {
                name: "delete",
                description: "Delete one or more keys from Redis",
                inputSchema: {
                    type: "object",
                    properties: {
                        key: {
                            oneOf: [
                                { type: "string" },
                                { type: "array", items: { type: "string" } }
                            ],
                            description: "Key or array of keys to delete",
                        },
                    },
                    required: ["key"],
                },
            },
            {
                name: "list",
                description: "List Redis keys matching a pattern",
                inputSchema: {
                    type: "object",
                    properties: {
                        pattern: {
                            type: "string",
                            description: "Pattern to match keys (default: *)",
                        },
                    },
                },
            },
            // 新增的工具定义
            {
                name: "hset",
                description: "Set field in a hash stored at key to value",
                inputSchema: {
                    type: "object",
                    properties: {
                        key: {
                            type: "string",
                            description: "Redis hash key",
                        },
                        field: {
                            type: "string",
                            description: "Hash field name",
                        },
                        value: {
                            type: "string",
                            description: "Value to store",
                        },
                    },
                    required: ["key", "field", "value"],
                },
            },
            {
                name: "hget",
                description: "Get the value of a hash field stored at key",
                inputSchema: {
                    type: "object",
                    properties: {
                        key: {
                            type: "string",
                            description: "Redis hash key",
                        },
                        field: {
                            type: "string",
                            description: "Hash field name to retrieve",
                        },
                    },
                    required: ["key", "field"],
                },
            },
            {
                name: "hgetall",
                description: "Get all fields and values in a hash",
                inputSchema: {
                    type: "object",
                    properties: {
                        key: {
                            type: "string",
                            description: "Redis hash key",
                        },
                    },
                    required: ["key"],
                },
            },
            {
                name: "incr",
                description: "Increment the integer value of a key by one",
                inputSchema: {
                    type: "object",
                    properties: {
                        key: {
                            type: "string",
                            description: "Redis key to increment",
                        },
                    },
                    required: ["key"],
                },
            },
            {
                name: "expire",
                description: "Set a key's time to live in seconds",
                inputSchema: {
                    type: "object",
                    properties: {
                        key: {
                            type: "string",
                            description: "Redis key",
                        },
                        seconds: {
                            type: "number",
                            description: "Expiration time in seconds",
                        },
                    },
                    required: ["key", "seconds"],
                },
            },
        ],
    };
});

// Handle tool execution
server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
        if (name === "set") {
            const { key, value, expireSeconds } = SetArgumentsSchema.parse(args);
            
            if (expireSeconds) {
                await redisClient.setEx(key, expireSeconds, value);
            } else {
                await redisClient.set(key, value);
            }

            return {
                content: [
                    {
                        type: "text",
                        text: `Successfully set key: ${key}`,
                    },
                ],
            };
        } else if (name === "get") {
            const { key } = GetArgumentsSchema.parse(args);
            const value = await redisClient.get(key);

            if (value === null) {
                return {
                    content: [
                        {
                            type: "text",
                            text: `Key not found: ${key}`,
                        },
                    ],
                };
            }

            return {
                content: [
                    {
                        type: "text",
                        text: `${value}`,
                    },
                ],
            };
        } else if (name === "delete") {
            const { key } = DeleteArgumentsSchema.parse(args);
            
            if (Array.isArray(key)) {
                await redisClient.del(key);
                return {
                    content: [
                        {
                            type: "text",
                            text: `Successfully deleted ${key.length} keys`,
                        },
                    ],
                };
            } else {
                await redisClient.del(key);
                return {
                    content: [
                        {
                            type: "text",
                            text: `Successfully deleted key: ${key}`,
                        },
                    ],
                };
            }
        } else if (name === "list") {
            const { pattern } = ListArgumentsSchema.parse(args);
            const keys = await redisClient.keys(pattern);

            return {
                content: [
                    {
                        type: "text",
                        text: keys.length > 0 
                            ? `Found keys:\n${keys.join('\n')}`
                            : "No keys found matching pattern",
                    },
                ],
            };
        } 
        // 新增的工具处理逻辑
        else if (name === "hset") {
            const { key, field, value } = HSetArgumentsSchema.parse(args);
            await redisClient.hSet(key, field, value);
            
            return {
                content: [
                    {
                        type: "text",
                        text: `Successfully set hash field ${field} in key: ${key}`,
                    },
                ],
            };
        } else if (name === "hget") {
            const { key, field } = HGetArgumentsSchema.parse(args);
            const value = await redisClient.hGet(key, field);

            if (value === null) {
                return {
                    content: [
                        {
                            type: "text",
                            text: `Field ${field} not found in hash key: ${key}`,
                        },
                    ],
                };
            }

            return {
                content: [
                    {
                        type: "text",
                        text: `${value}`,
                    },
                ],
            };
        } else if (name === "hgetall") {
            const { key } = HGetAllArgumentsSchema.parse(args);
            const hashData = await redisClient.hGetAll(key);

            if (Object.keys(hashData).length === 0) {
                return {
                    content: [
                        {
                            type: "text",
                            text: `Hash key not found or empty: ${key}`,
                        },
                    ],
                };
            }

            const formattedData = Object.entries(hashData)
                .map(([field, value]) => `${field}: ${value}`)
                .join('\n');

            return {
                content: [
                    {
                        type: "text",
                        text: formattedData,
                    },
                ],
            };
        } else if (name === "incr") {
            const { key } = IncrArgumentsSchema.parse(args);
            const newValue = await redisClient.incr(key);

            return {
                content: [
                    {
                        type: "text",
                        text: `Incremented key: ${key}, new value: ${newValue}`,
                    },
                ],
            };
        } else if (name === "expire") {
            const { key, seconds } = ExpireArgumentsSchema.parse(args);
            const result = await redisClient.expire(key, seconds);

            if (result) {
                return {
                    content: [
                        {
                            type: "text",
                            text: `Successfully set expiration of ${seconds} seconds for key: ${key}`,
                        },
                    ],
                };
            } else {
                return {
                    content: [
                        {
                            type: "text",
                            text: `Failed to set expiration: key ${key} does not exist`,
                        },
                    ],
                };
            }
        } else {
            throw new Error(`Unknown tool: ${name}`);
        }
    } catch (error) {
        if (error instanceof z.ZodError) {
            throw new Error(
                `Invalid arguments: ${error.errors
                    .map((e) => `${e.path.join(".")}: ${e.message}`)
                    .join(", ")}`
            );
        }
        throw error;
    }
});

// Start the server
async function main() {
    try {
        // Set up Redis event handlers
        redisClient.on('error', (err: Error) => {
            console.error('Redis Client Error:', err);
        });

        redisClient.on('connect', () => {
            console.error(`Connected to Redis at ${REDIS_URL}`);
        });

        redisClient.on('reconnecting', () => {
            console.error('Attempting to reconnect to Redis...');
        });

        redisClient.on('end', () => {
            console.error('Redis connection closed');
        });

        // Connect to Redis
        await redisClient.connect();

        // Set up MCP server
        const transport = new StdioServerTransport();
        await server.connect(transport);
        console.error("Redis MCP Server running on stdio");
    } catch (error) {
        console.error("Error during startup:", error);
        await cleanup();
    }
}

// Cleanup function
async function cleanup() {
    try {
        await redisClient.quit();
    } catch (error) {
        console.error("Error during cleanup:", error);
    }
    process.exit(1);
}

// Handle process termination
process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

main().catch((error) => {
    console.error("Fatal error in main():", error);
    cleanup();
});
