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

// 添加列表操作相关的 Schema 定义
const LPushArgumentsSchema = z.object({
    key: z.string(),
    value: z.string().or(z.array(z.string())),
});

const RPushArgumentsSchema = z.object({
    key: z.string(),
    value: z.string().or(z.array(z.string())),
});

const LPopArgumentsSchema = z.object({
    key: z.string(),
});

const RPopArgumentsSchema = z.object({
    key: z.string(),
});

const LRangeArgumentsSchema = z.object({
    key: z.string(),
    start: z.number(),
    stop: z.number(),
});

// 添加 ZSet 相关的 Schema 定义
const ZAddArgumentsSchema = z.object({
    key: z.string(),
    score: z.number(),
    member: z.string(),
});

const ZRangeArgumentsSchema = z.object({
    key: z.string(),
    min: z.number(),
    max: z.number(),
    withScores: z.boolean().optional(),
});

const ZRemArgumentsSchema = z.object({
    key: z.string(),
    member: z.string().or(z.array(z.string())),
});

const ZScoreArgumentsSchema = z.object({
    key: z.string(),
    member: z.string(),
});

const ZRankArgumentsSchema = z.object({
    key: z.string(),
    member: z.string(),
});

// 添加发布订阅相关的 Schema 定义
const PublishArgumentsSchema = z.object({
    channel: z.string(),
    message: z.string(),
});

const SubscribeArgumentsSchema = z.object({
    channel: z.string().or(z.array(z.string())),
});

const UnsubscribeArgumentsSchema = z.object({
    channel: z.string().or(z.array(z.string())).optional(),
});

const PubSubChannelsArgumentsSchema = z.object({
    pattern: z.string().optional(),
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
            // 添加列表操作相关的工具定义
            {
                name: "lpush",
                description: "Insert one or multiple values at the beginning of a list",
                inputSchema: {
                    type: "object",
                    properties: {
                        key: {
                            type: "string",
                            description: "Redis list key",
                        },
                        value: {
                            oneOf: [
                                { type: "string" },
                                { type: "array", items: { type: "string" } }
                            ],
                            description: "Value or array of values to push to the list",
                        },
                    },
                    required: ["key", "value"],
                },
            },
            {
                name: "rpush",
                description: "Insert one or multiple values at the end of a list",
                inputSchema: {
                    type: "object",
                    properties: {
                        key: {
                            type: "string",
                            description: "Redis list key",
                        },
                        value: {
                            oneOf: [
                                { type: "string" },
                                { type: "array", items: { type: "string" } }
                            ],
                            description: "Value or array of values to push to the list",
                        },
                    },
                    required: ["key", "value"],
                },
            },
            {
                name: "lpop",
                description: "Remove and get the first element in a list",
                inputSchema: {
                    type: "object",
                    properties: {
                        key: {
                            type: "string",
                            description: "Redis list key",
                        },
                    },
                    required: ["key"],
                },
            },
            {
                name: "rpop",
                description: "Remove and get the last element in a list",
                inputSchema: {
                    type: "object",
                    properties: {
                        key: {
                            type: "string",
                            description: "Redis list key",
                        },
                    },
                    required: ["key"],
                },
            },
            {
                name: "lrange",
                description: "Get a range of elements from a list",
                inputSchema: {
                    type: "object",
                    properties: {
                        key: {
                            type: "string",
                            description: "Redis list key",
                        },
                        start: {
                            type: "number",
                            description: "Start index (0-based)",
                        },
                        stop: {
                            type: "number",
                            description: "Stop index (inclusive)",
                        },
                    },
                    required: ["key", "start", "stop"],
                },
            },
            // 添加 ZSet 相关工具定义
            {
                name: "zadd",
                description: "Add a member with a score to a sorted set",
                inputSchema: {
                    type: "object",
                    properties: {
                        key: z.string(),
                        score: z.number(),
                        member: z.string(),
                    },
                    required: ["key", "score", "member"],
                },
            },
            {
                name: "zrange",
                description: "Return a range of members in a sorted set by index",
                inputSchema: {
                    type: "object",
                    properties: {
                        key: z.string(),
                        min: z.number(),
                        max: z.number(),
                        withScores: z.boolean().optional(),
                    },
                    required: ["key", "min", "max"],
                },
            },
            {
                name: "zrem",
                description: "Remove one or more members from a sorted set",
                inputSchema: {
                    type: "object",
                    properties: {
                        key: z.string(),
                        member: z.string().or(z.array(z.string())),
                    },
                    required: ["key", "member"],
                },
            },
            {
                name: "zscore",
                description: "Get the score of a member in a sorted set",
                inputSchema: {
                    type: "object",
                    properties: {
                        key: z.string(),
                        member: z.string(),
                    },
                    required: ["key", "member"],
                },
            },
            {
                name: "zrank",
                description: "Get the rank of a member in a sorted set (0-based)",
                inputSchema: {
                    type: "object",
                    properties: {
                        key: z.string(),
                        member: z.string(),
                    },
                    required: ["key", "member"],
                },
            },
            // 添加发布订阅相关工具定义
            {
                name: "publish",
                description: "Publish a message to a channel",
                inputSchema: {
                    type: "object",
                    properties: {
                        channel: {
                            type: "string",
                            description: "Channel to publish to",
                        },
                        message: {
                            type: "string",
                            description: "Message to publish",
                        },
                    },
                    required: ["channel", "message"],
                },
            },
            {
                name: "pubsub_channels",
                description: "List active channels (with at least one subscriber)",
                inputSchema: {
                    type: "object",
                    properties: {
                        pattern: {
                            type: "string",
                            description: "Pattern to filter channels (optional)",
                        },
                    },
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
        } 
        // 实现列表操作相关命令
        else if (name === "lpush") {
            const { key, value } = LPushArgumentsSchema.parse(args);
            let result;
        
            if (Array.isArray(value)) {
                result = await redisClient.lPush(key, value);
            } else {
                result = await redisClient.lPush(key, value);
            }
        
            return {
                content: [
                    {
                        type: "text",
                        text: `成功添加到列表开头，新长度: ${result}`,
                    },
                ],
            };
        } else if (name === "rpush") {
            const { key, value } = RPushArgumentsSchema.parse(args);
            let result;
        
            if (Array.isArray(value)) {
                result = await redisClient.rPush(key, value);
            } else {
                result = await redisClient.rPush(key, value);
            }
        
            return {
                content: [
                    {
                        type: "text",
                        text: `成功添加到列表末尾，新长度: ${result}`,
                    },
                ],
            };
        } else if (name === "lpop") {
            const { key } = LPopArgumentsSchema.parse(args);
            const result = await redisClient.lPop(key);
        
            if (result === null) {
                return {
                    content: [
                        {
                            type: "text",
                            text: `列表为空或不存在: ${key}`,
                        },
                    ],
                };
            }
        
            return {
                content: [
                    {
                        type: "text",
                        text: result,
                    },
                ],
            };
        } else if (name === "rpop") {
            const { key } = RPopArgumentsSchema.parse(args);
            const result = await redisClient.rPop(key);
        
            if (result === null) {
                return {
                    content: [
                        {
                            type: "text",
                            text: `列表为空或不存在: ${key}`,
                        },
                    ],
                };
            }
        
            return {
                content: [
                    {
                        type: "text",
                        text: result,
                    },
                ],
            };
        } else if (name === "lrange") {
            const { key, start, stop } = LRangeArgumentsSchema.parse(args);
            const result = await redisClient.lRange(key, start, stop);
        
            if (result.length === 0) {
                return {
                    content: [
                        {
                            type: "text",
                            text: `指定范围内没有元素或列表不存在: ${key}`,
                        },
                    ],
                };
            }
        
            return {
                content: [
                    {
                        type: "text",
                        text: result.join('\n'),
                    },
                ],
            };
        } 
        // 实现 ZSet 相关命令
        else if (name === "zadd") {
            const { key, score, member } = ZAddArgumentsSchema.parse(args);
            const result = await redisClient.zAdd(key, [{ score, value: member }]);

            return {
                content: [
                    {
                        type: "text",
                        text: `成功添加到有序集合，影响的成员数: ${result}`,
                    },
                ],
            };
        } else if (name === "zrange") {
            const { key, min, max, withScores } = ZRangeArgumentsSchema.parse(args);
            let result;
            
            if (withScores) {
                result = await redisClient.zRangeWithScores(key, min, max);
                
                if (result.length === 0) {
                    return {
                        content: [
                            {
                                type: "text",
                                text: `指定范围内没有成员或有序集合不存在: ${key}`,
                            },
                        ],
                    };
                }
                
                const formattedResult = result.map(item => `${item.value}: ${item.score}`).join('\n');
                
                return {
                    content: [
                        {
                            type: "text",
                            text: formattedResult,
                        },
                    ],
                };
            } else {
                result = await redisClient.zRange(key, min, max);
                
                if (result.length === 0) {
                    return {
                        content: [
                            {
                                type: "text",
                                text: `指定范围内没有成员或有序集合不存在: ${key}`,
                            },
                        ],
                    };
                }
                
                return {
                    content: [
                        {
                            type: "text",
                            text: result.join('\n'),
                        },
                    ],
                };
            }
        } else if (name === "zrem") {
            const { key, member } = ZRemArgumentsSchema.parse(args);
            let result;
            
            if (Array.isArray(member)) {
                result = await redisClient.zRem(key, member);
            } else {
                result = await redisClient.zRem(key, member);
            }
            
            return {
                content: [
                    {
                        type: "text",
                        text: `从有序集合中移除了 ${result} 个成员: ${key}`,
                    },
                ],
            };
        } else if (name === "zscore") {
            const { key, member } = ZScoreArgumentsSchema.parse(args);
            const result = await redisClient.zScore(key, member);
            
            if (result === null) {
                return {
                    content: [
                        {
                            type: "text",
                            text: `成员在有序集合中不存在: ${key}`,
                        },
                    ],
                };
            }
            
            return {
                content: [
                    {
                        type: "text",
                        text: `分数: ${result}`,
                    },
                ],
            };
        } else if (name === "zrank") {
            const { key, member } = ZRankArgumentsSchema.parse(args);
            const result = await redisClient.zRank(key, member);
            
            if (result === null) {
                return {
                    content: [
                        {
                            type: "text",
                            text: `成员在有序集合中不存在: ${key}`,
                        },
                    ],
                };
            }
            
            return {
                content: [
                    {
                        type: "text",
                        text: `排名: ${result}`,
                    },
                ],
            };
        } 
        // 实现发布订阅相关命令
        else if (name === "publish") {
            const { channel, message } = PublishArgumentsSchema.parse(args);
            const subscriberCount = await redisClient.publish(channel, message);
            
            return {
                content: [
                    {
                        type: "text",
                        text: `消息已发布到频道 ${channel}，有 ${subscriberCount} 个订阅者接收到消息`,
                    },
                ],
            };
        } else if (name === "pubsub_channels") {
            const { pattern } = PubSubChannelsArgumentsSchema.parse(args);
            const channels = await redisClient.pubSubChannels(pattern || "*");
            
            if (channels.length === 0) {
                return {
                    content: [
                        {
                            type: "text",
                            text: `没有找到活跃的频道${pattern ? `匹配模式 ${pattern}` : ''}`,
                        },
                    ],
                };
            }
            
            return {
                content: [
                    {
                        type: "text",
                        text: `活跃的频道:\n${channels.join('\n')}`,
                    },
                ],
            };
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
