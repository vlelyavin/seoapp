/** Paddle price ID ↔ internal plan ID mapping */

export const PADDLE_PRICE_TO_PLAN: Record<string, string> = {
  pri_01kjnyn5yrnhysp9wr7sf215yg: "pro",
  pri_01kjnyngnn6jax3t2x25e7ss9h: "agency",
};

export const PLAN_TO_PADDLE_PRICE: Record<string, string> = {
  pro: "pri_01kjnyn5yrnhysp9wr7sf215yg",
  agency: "pri_01kjnyngnn6jax3t2x25e7ss9h",
};
