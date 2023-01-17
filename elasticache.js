const dotenv = require("dotenv");
const redis = require("redis");
dotenv.config();

const REDIS_PORT = process.env.REDIS_PORT || 6379;
const client = redis.createClient(REDIS_PORT);

const result = { name: "test", age: 1 };

client.set("test-code", JSON.stringify(result), "EX", 300);
