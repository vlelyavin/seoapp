/** Mirrors Prisma Plan model */
export interface Plan {
  id: string;
  name: string;
  auditsPerMonth: number;
  maxPages: number;
  whiteLabel: boolean;
  price: number;
}
