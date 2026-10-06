local key = KEYS[1]
local now = tonumber(ARGV[1])
local window = tonumber(ARGV[2])
local limit = tonumber(ARGV[3])
local member = ARGV[4]

local window_start = now - window

-- Clear elements older than the current window
redis.call('ZREMRANGEBYSCORE', key, '-inf', window_start)

-- Fetch the cardinality of the set
local current_count = redis.call('ZCARD', key)

if current_count < limit then
    -- Under limit: add the current timestamp
    redis.call('ZADD', key, now, member)
    
    -- Extend key lifecycle to avoid memory leaks
    redis.call('PEXPIRE', key, window)
    
    local remaining = limit - (current_count + 1)
    return {1, remaining}
else
    -- Over limit
    return {0, 0}
end
