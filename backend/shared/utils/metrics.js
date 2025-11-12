import promClient from "prom-client";

// Create a Registry to register the metrics
export const register = new promClient.Registry();

// Add default metrics (CPU, memory, etc.)
promClient.collectDefaultMetrics({ register });

// HTTP request duration histogram
export const httpRequestDuration = new promClient.Histogram({
  name: "http_request_duration_seconds",
  help: "Duration of HTTP requests in seconds",
  labelNames: ["method", "route", "status_code"],
  buckets: [0.1, 0.5, 1, 2, 5],
  registers: [register],
});

// HTTP request total counter
export const httpRequestTotal = new promClient.Counter({
  name: "http_requests_total",
  help: "Total number of HTTP requests",
  labelNames: ["method", "route", "status_code"],
  registers: [register],
});

// Active connections gauge
export const activeConnections = new promClient.Gauge({
  name: "http_active_connections",
  help: "Number of active HTTP connections",
  registers: [register],
});

// Database query duration histogram
export const dbQueryDuration = new promClient.Histogram({
  name: "db_query_duration_seconds",
  help: "Duration of database queries in seconds",
  labelNames: ["operation", "collection"],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2],
  registers: [register],
});

// Redis operation duration histogram
export const redisOperationDuration = new promClient.Histogram({
  name: "redis_operation_duration_seconds",
  help: "Duration of Redis operations in seconds",
  labelNames: ["operation"],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1],
  registers: [register],
});

// Error counter
export const errorTotal = new promClient.Counter({
  name: "errors_total",
  help: "Total number of errors",
  labelNames: ["type", "code"],
  registers: [register],
});

/**
 * Metrics middleware to track HTTP requests
 */
export const metricsMiddleware = (req, res, next) => {
  const start = Date.now();
  const route = req.route?.path || req.path || "unknown";

  // Increment active connections
  activeConnections.inc();

  // Track response
  res.on("finish", () => {
    const duration = (Date.now() - start) / 1000;
    const labels = {
      method: req.method,
      route,
      status_code: res.statusCode,
    };

    httpRequestDuration.observe(labels, duration);
    httpRequestTotal.inc(labels);
    activeConnections.dec();
  });

  next();
};

/**
 * Get metrics in Prometheus format
 */
export const getMetrics = async () => {
  return register.metrics();
};

