/** Paddle price ID ↔ internal plan ID mapping */

export const PADDLE_PRICE_TO_PLAN: Record<string, string> = {
  "pri_01kjnyfp7wa70y2ww5drqm2zdb": "pro",
  "pri_01kjnyg56cx8ejas6k4q1jm75f": "agency",
};

export const PLAN_TO_PADDLE_PRICE: Record<string, string> = {
  pro: "pri_01kjnyfp7wa70y2ww5drqm2zdb",
  agency: "pri_01kjnyg56cx8ejas6k4q1jm75f",
};
