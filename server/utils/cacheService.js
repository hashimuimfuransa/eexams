const NodeCache = require('node-cache');

// In-memory cache with TTL (Time To Live)
// Falls back to memory if Redis is not available
class CacheService {
  constructor() {
    // Standard TTL: 5 minutes, checkperiod: 2 minutes
    this.cache = new NodeCache({ stdTTL: 300, checkperiod: 120 });
    this.redis = null;
    this.useRedis = false;
    
    // Initialize Redis if available
    this.initializeRedis();
  }

  async initializeRedis() {
    try {
      if (process.env.REDIS_URL) {
        const Redis = require('ioredis');
        this.redis = new Redis(process.env.REDIS_URL, {
          maxRetriesPerRequest: 3,
          retryStrategy: (times) => {
            const delay = Math.min(times * 50, 2000);
            return delay;
          },
          enableReadyCheck: true
        });

        this.redis.on('connect', () => {
          console.log('Redis connected successfully');
          this.useRedis = true;
        });

        this.redis.on('error', (err) => {
          console.warn('Redis connection error, falling back to memory cache:', err.message);
          this.useRedis = false;
        });

        // Test connection
        await this.redis.ping();
      }
    } catch (error) {
      console.warn('Redis initialization failed, using memory cache:', error.message);
      this.useRedis = false;
    }
  }

  // Generate cache key with prefix
  generateKey(prefix, ...parts) {
    return `${prefix}:${parts.join(':')}`;
  }

  // Get value from cache
  async get(key) {
    try {
      if (this.useRedis && this.redis) {
        const value = await this.redis.get(key);
        return value ? JSON.parse(value) : null;
      }
      return this.cache.get(key) || null;
    } catch (error) {
      console.error('Cache get error:', error);
      return null;
    }
  }

  // Set value in cache with optional TTL
  async set(key, value, ttl = 300) {
    try {
      const serialized = JSON.stringify(value);
      
      if (this.useRedis && this.redis) {
        await this.redis.setex(key, ttl, serialized);
      } else {
        this.cache.set(key, value, ttl);
      }
      return true;
    } catch (error) {
      console.error('Cache set error:', error);
      return false;
    }
  }

  // Delete key from cache
  async del(key) {
    try {
      if (this.useRedis && this.redis) {
        await this.redis.del(key);
      } else {
        this.cache.del(key);
      }
      return true;
    } catch (error) {
      console.error('Cache delete error:', error);
      return false;
    }
  }

  // Delete multiple keys by pattern
  async delPattern(pattern) {
    try {
      if (this.useRedis && this.redis) {
        const keys = await this.redis.keys(pattern);
        if (keys.length > 0) {
          await this.redis.del(...keys);
        }
      } else {
        // For memory cache, we need to iterate through keys
        const keys = this.cache.keys();
        const regex = new RegExp(pattern.replace(/\*/g, '.*'));
        const keysToDelete = keys.filter(key => regex.test(key));
        this.cache.del(keysToDelete);
      }
      return true;
    } catch (error) {
      console.error('Cache delete pattern error:', error);
      return false;
    }
  }

  // Clear all cache
  async flush() {
    try {
      if (this.useRedis && this.redis) {
        await this.redis.flushdb();
      } else {
        this.cache.flushAll();
      }
      return true;
    } catch (error) {
      console.error('Cache flush error:', error);
      return false;
    }
  }

  // Get or set pattern - fetch from cache if exists, otherwise compute and cache
  async getOrSet(key, fetchFn, ttl = 300) {
    try {
      const cached = await this.get(key);
      if (cached !== null) {
        return cached;
      }

      const value = await fetchFn();
      await this.set(key, value, ttl);
      return value;
    } catch (error) {
      console.error('Cache getOrSet error:', error);
      // If cache fails, still return the fetched value
      return await fetchFn();
    }
  }

  // Cache statistics
  getStats() {
    if (this.useRedis && this.redis) {
      return { type: 'redis', connected: true };
    }
    return {
      type: 'memory',
      keys: this.cache.keys().length,
      stats: this.cache.getStats()
    };
  }
}

// Singleton instance
const cacheService = new CacheService();

module.exports = cacheService;
