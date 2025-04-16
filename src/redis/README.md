# Redis

A Model Context Protocol server that provides access to Redis databases. This server enables LLMs to interact with Redis key-value stores through a set of standardized tools.

## Prerequisites

1. Redis server must be installed and running
   - [Download Redis](https://redis.io/download)
   - For Windows users: Use [Windows Subsystem for Linux (WSL)](https://redis.io/docs/getting-started/installation/install-redis-on-windows/) or [Memurai](https://www.memurai.com/) (Redis-compatible Windows server)
   - Default port: 6379

## Common Issues & Solutions

### Connection Errors

**ECONNREFUSED**
  - **Cause**: Redis server is not running or unreachable
  - **Solution**: 
    - Verify Redis is running: `redis-cli ping` should return "PONG"
    - Check Redis service status: `systemctl status redis` (Linux) or `brew services list` (macOS)
    - Ensure correct port (default 6379) is not blocked by firewall
    - Verify Redis URL format: `redis://hostname:port`

### Server Behavior

- The server implements exponential backoff with a maximum of 5 retries
- Initial retry delay: 1 second, maximum delay: 30 seconds
- Server will exit after max retries to prevent infinite reconnection loops

## Components

### Tools

#### 字符串操作

- **set**
  - 设置 Redis 键值对，可选过期时间
  - 输入:
    - `key` (string): Redis 键
    - `value` (string): 要存储的值
    - `expireSeconds` (number, 可选): 过期时间（秒）

- **get**
  - 通过键从 Redis 获取值
  - 输入: `key` (string): 要检索的 Redis 键

- **delete**
  - 从 Redis 删除一个或多个键
  - 输入: `key` (string | string[]): 要删除的键或键数组

- **list**
  - 列出匹配模式的 Redis 键
  - 输入: `pattern` (string, 可选): 匹配键的模式（默认: *）

- **incr**
  - 将键的整数值加一
  - 输入: `key` (string): 要递增的 Redis 键

- **expire**
  - 设置键的生存时间（秒）
  - 输入:
    - `key` (string): Redis 键
    - `seconds` (number): 过期时间（秒）

#### 哈希表操作

- **hset**
  - 在存储在指定键的哈希表中设置字段的值
  - 输入:
    - `key` (string): Redis 哈希表键
    - `field` (string): 哈希表字段名
    - `value` (string): 要存储的值

- **hget**
  - 获取存储在指定键的哈希表中字段的值
  - 输入:
    - `key` (string): Redis 哈希表键
    - `field` (string): 要检索的哈希表字段名

- **hgetall**
  - 获取哈希表中的所有字段和值
  - 输入: `key` (string): Redis 哈希表键

#### 列表操作

- **lpush**
  - 在列表头部插入一个或多个值
  - 输入:
    - `key` (string): Redis 列表键
    - `value` (string | string[]): 要推入列表的值或值数组

- **rpush**
  - 在列表尾部插入一个或多个值
  - 输入:
    - `key` (string): Redis 列表键
    - `value` (string | string[]): 要推入列表的值或值数组

- **lpop**
  - 移除并获取列表的第一个元素
  - 输入: `key` (string): Redis 列表键

- **rpop**
  - 移除并获取列表的最后一个元素
  - 输入: `key` (string): Redis 列表键

- **lrange**
  - 获取列表中指定范围的元素
  - 输入:
    - `key` (string): Redis 列表键
    - `start` (number): 起始索引（从0开始）
    - `stop` (number): 结束索引（包含）

#### 有序集合操作

- **zadd**
  - 向有序集合添加一个带有分数的成员
  - 输入:
    - `key` (string): Redis 有序集合键
    - `score` (number): 成员的分数
    - `member` (string): 要添加到有序集合的成员

- **zrange**
  - 按索引返回有序集合中的一系列成员
  - 输入:
    - `key` (string): Redis 有序集合键
    - `min` (number): 最小索引（从0开始）
    - `max` (number): 最大索引（包含）
    - `withScores` (boolean, 可选): 是否返回成员的分数

- **zrem**
  - 从有序集合中移除一个或多个成员
  - 输入:
    - `key` (string): Redis 有序集合键
    - `member` (string | string[]): 要移除的成员或成员数组

- **zscore**
  - 获取有序集合中成员的分数
  - 输入:
    - `key` (string): Redis 有序集合键
    - `member` (string): 要获取分数的成员

- **zrank**
  - 获取有序集合中成员的排名（从0开始）
  - 输入:
    - `key` (string): Redis 有序集合键
    - `member` (string): 要获取排名的成员

#### 发布订阅操作

- **publish**
  - 向频道发布消息
  - 输入:
    - `channel` (string): 要发布到的频道
    - `message` (string): 要发布的消息

- **pubsub_channels**
  - 列出活跃的频道（至少有一个订阅者）
  - 输入:
    - `pattern` (string, 可选): 过滤频道的模式

#### 集合操作

- **sadd**
  - 向集合添加一个或多个成员
  - 输入:
    - `key` (string): Redis 集合键
    - `member` (string | string[]): 要添加到集合的成员或成员数组

- **smembers**
  - 获取集合中的所有成员
  - 输入: `key` (string): Redis 集合键

- **sismember**
  - 判断成员是否在集合中
  - 输入:
    - `key` (string): Redis 集合键
    - `member` (string): 要检查的成员

- **srem**
  - 从集合中移除一个或多个成员
  - 输入:
    - `key` (string): Redis 集合键
    - `member` (string | string[]): 要从集合中移除的成员或成员数组

- **scard**
  - 获取集合中成员的数量
  - 输入: `key` (string): Redis 集合键

## Usage with Claude Desktop

To use this server with the Claude Desktop app, add the following configuration to the "mcpServers" section of your `claude_desktop_config.json`:

### Docker

* when running docker on macos, use host.docker.internal if the server is running on the host network (eg localhost)
* Redis URL can be specified as an argument, defaults to "redis://localhost:6379"

```json
{
  "mcpServers": {
    "redis": {
      "command": "docker",
      "args": [
        "run", 
        "-i", 
        "--rm", 
        "mcp/redis", 
        "redis://host.docker.internal:6379"]
    }
  }
}
```

### NPX

```json
{
  "mcpServers": {
    "redis": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-redis",
        "redis://localhost:6379"
      ]
    }
  }
}
```

## Building

Docker:

```sh
docker build -t mcp/redis -f src/redis/Dockerfile . 
```

## License

This MCP server is licensed under the MIT License. This means you are free to use, modify, and distribute the software, subject to the terms and conditions of the MIT License. For more details, please see the LICENSE file in the project repository.
