# Rate Limiting Guide

## Current Configuration

Rate limiting has been configured to be very permissive during development:

- **Gateway**: 10,000 requests per minute (effectively disabled)
- **Login**: 1,000 attempts per minute
- **Register**: 1,000 attempts per minute

## Automatic Bypass in Development

Rate limiting is automatically bypassed when:
- `NODE_ENV=development` is set, OR
- `DISABLE_RATE_LIMIT=true` is set in your `.env` file

## If You Still Get Rate Limited

1. **Clear existing rate limits:**
   ```bash
   npm run clear-rate-limits
   ```

2. **Restart your services** - Rate limit changes require service restart

3. **Set environment variable** (recommended for development):
   Add to your `.env` file:
   ```
   NODE_ENV=development
   ```
   OR
   ```
   DISABLE_RATE_LIMIT=true
   ```

## Troubleshooting

If rate limiting keeps happening:
1. Check if services are running and restart them
2. Clear Redis rate limit keys: `npm run clear-rate-limits`
3. Verify Redis is running: `redis-cli ping` (should return "PONG")
4. Check service logs for rate limit warnings





