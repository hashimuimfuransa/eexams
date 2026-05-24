const cacheService = require('../utils/cacheService');

// Generic cache middleware factory
const cacheMiddleware = (options = {}) => {
  const {
    prefix = 'api',
    ttl = 300, // 5 minutes default
    keyGenerator = null
  } = options;

  return async (req, res, next) => {
    // Skip caching for non-GET requests
    if (req.method !== 'GET') {
      return next();
    }

    // Skip caching if user is authenticated and the endpoint requires fresh data
    if (req.user && options.skipForAuth) {
      return next();
    }

    try {
      // Generate cache key
      const key = keyGenerator 
        ? keyGenerator(req)
        : cacheService.generateKey(prefix, req.originalUrl, JSON.stringify(req.query));

      // Try to get from cache
      const cached = await cacheService.get(key);
      
      if (cached) {
        return res.json(cached);
      }

      // Store original json method
      const originalJson = res.json;

      // Override json method to cache response
      res.json = function(data) {
        // Only cache successful responses
        if (res.statusCode === 200) {
          cacheService.set(key, data, ttl).catch(err => {
            console.error('Cache set error:', err);
          });
        }
        
        // Call original json method
        return originalJson.call(this, data);
      };

      next();
    } catch (error) {
      console.error('Cache middleware error:', error);
      next();
    }
  };
};

// Cache invalidation middleware factory
const invalidateCache = (options = {}) => {
  const {
    prefix = 'api',
    keyGenerator = null
  } = options;

  return async (req, res, next) => {
    // Store original json method
    const originalJson = res.json;

    // Override json method to invalidate cache after successful operation
    res.json = function(data) {
      // Only invalidate on successful operations (2xx status)
      if (res.statusCode >= 200 && res.statusCode < 300) {
        try {
          if (keyGenerator) {
            const keys = keyGenerator(req, data);
            if (Array.isArray(keys)) {
              keys.forEach(key => cacheService.del(key));
            } else {
              cacheService.del(keys);
            }
          } else {
            // Invalidate all keys with the prefix
            cacheService.delPattern(`${prefix}:*`);
          }
        } catch (error) {
          console.error('Cache invalidation error:', error);
        }
      }
      
      return originalJson.call(this, data);
    };

    next();
  };
};

// Specific cache middleware for exams
const cacheExam = cacheMiddleware({
  prefix: 'exam',
  ttl: 600, // 10 minutes for exams
  keyGenerator: (req) => {
    return cacheService.generateKey('exam', req.params.id, req.user?.role);
  }
});

// Specific cache middleware for exam lists
const cacheExamList = cacheMiddleware({
  prefix: 'exams',
  ttl: 300, // 5 minutes for exam lists
  keyGenerator: (req) => {
    return cacheService.generateKey('exams', req.user?._id, JSON.stringify(req.query));
  }
});

// Cache invalidation for exam updates
const invalidateExamCache = invalidateCache({
  prefix: 'exam',
  keyGenerator: (req) => {
    const keys = [
      cacheService.generateKey('exam', req.params.id),
      cacheService.generateKey('exams', req.user?._id)
    ];
    return keys;
  }
});

// Cache middleware for questions
const cacheQuestion = cacheMiddleware({
  prefix: 'question',
  ttl: 600,
  keyGenerator: (req) => {
    return cacheService.generateKey('question', req.params.id);
  }
});

// Cache invalidation for question updates
const invalidateQuestionCache = invalidateCache({
  prefix: 'question',
  keyGenerator: (req) => {
    return cacheService.generateKey('question', req.params.id);
  }
});

module.exports = {
  cacheMiddleware,
  invalidateCache,
  cacheExam,
  cacheExamList,
  invalidateExamCache,
  cacheQuestion,
  invalidateQuestionCache
};
