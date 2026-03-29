/** Rate limit constants shared across all services */

/** Time-to-live for rate limit window (seconds) */
export const THROTTLE_TTL = 60;

/** Gateway: max requests per user per TTL window */
export const GATEWAY_LIMIT = 300;

/** Gateway auth routes: max requests per IP per TTL window */
export const GATEWAY_AUTH_LIMIT = 100;

/** Backend services: max requests per user per TTL window */
export const BACKEND_LIMIT = 500;

/** Header used for internal service-to-service calls (exempt from throttle) */
export const INTERNAL_CALL_HEADER = 'x-internal-call';
