type GoalPeriod =
  | 11
  | 12
  | 13
  | 14
  | 15
  | 16
  | 17
  | 18
  | 19
  | 20
  | 21
  | 22
  | 23
  | 24
  | 25
  | 26
  | 27
  | 28
  | 29
  | 30
  | 31
  | 32
  | 33
  | 34
  | 35
  | 36
  | 37;

interface SellerGoal {
  [key: number]: number;
}

interface SellerGoals {
  [email: string]: SellerGoal;
}

const sellerGoals: SellerGoals = {
  "ventas1productoselrey@gmail.com": {
    // Christian
    11: 205826.71,
    12: 234314.28,
    13: 250245.79,
    14: 242226.01, //enero 2025
    15: 218937.01, //febrero 2025
    16: 201558.01, //marzo 2025
    17: 199445.01, //abril 2025
    18: 205536.79, //mayo 2025
    19: 186289.01, //junio 2025
    20: 195887.01, //julio 2025
    21: 200000.01, //agosto 2025
    22: 200000.01, //septiembre 2025
    23: 209073.0, //octubre 2025
    24: 200000.01, //noviembre 2025
    25: 216404.0, //diciembre 2025
    26: 230128.0, //enero 2026
    27: 210630.0, //febrero 2026
    28: 200000.01, //marzo 2026
    29: 200000.01, //abril 2026
    30: 200000.01, //mayo 2026
    31: 200000.01, //junio 2026
    32: 200000.01, //julio 2026
    33: 200000.01, //agosto 2026
    34: 200000.01, //septiembre 2026
    35: 200000.01, //octubre 2026
    36: 200000.01, //noviembre 2026
    37: 200000.01, //diciembre 2026
  },
  "ventas2productoselrey@gmail.com": {
    // Roel
    11: 205426.29,
    12: 212210.14,
    13: 220461.01,
    14: 220453.01, //enero 2025
    15: 215131.01, //febrero 2025
    16: 198798.01, //marzo 2025
    17: 199258.01, //abril 2025
    18: 200198.01, //mayo 2025
    19: 184211.01, //junio 2025
    20: 191687.01, //julio 2025
    21: 200000.01, //agosto 2025
    22: 200000.01, //septiembre 2025
    23: 207070.0, //octubre 2025
    24: 200000.01, //noviembre 2025
    25: 200000.01, //diciembre 2025
    26: 200000.01, //enero 2026
    27: 200000.01, //febrero 2026
    28: 200000.01, //marzo 2026
    29: 200000.01, //abril 2026
    30: 200000.01, //mayo 2026
    31: 200000.01, //junio 2026
    32: 200000.01, //julio 2026
    33: 200000.01, //agosto 2026
    34: 200000.01, //septiembre 2026
    35: 200000.01, //octubre 2026
    36: 200000.01, //noviembre 2026
    37: 200000.01, //diciembre 2026
  },
  "ventas3productoselrey@gmail.com": {
    // Lidia
    11: 214002.03,
    12: 257520.55,
    13: 219610.47,
    14: 223736.01, //enero 2025
    15: 203082.01, //febrero 2025
    16: 193826.01, //marzo 2025
    17: 199594.01, //abril 2025
    18: 203741.01, //mayo 2025
    19: 183979.01, //junio 2025
    20: 187215.01, //julio 2025
    21: 200000.01, //agosto 2025
    22: 200000.01, //septiembre 2025
    23: 165796.0, //octubre 2025
    24: 200000.01, //noviembre 2025
    25: 179944.0, //diciembre 2025
    26: 177555.0, //enero 2026
    27: 183613.0, //febrero 2026
    28: 200000.01, //marzo 2026
    29: 200000.01, //abril 2026
    30: 200000.01, //mayo 2026
    31: 200000.01, //junio 2026
    32: 200000.01, //julio 2026
    33: 200000.01, //agosto 2026
    34: 200000.01, //septiembre 2026
    35: 200000.01, //octubre 2026
    36: 200000.01, //noviembre 2026
    37: 200000.01, //diciembre 2026
  },
  "ventasmochisproductoselrey@gmail.com": {
    // Mochis
    11: 200000.0,
    12: 210000.0,
    13: 215000.0,
    14: 220000.0, //enero 2025
    15: 200000.0, //febrero 2025
    16: 190000.0, //marzo 2025
    17: 195000.0, //abril 2025
    18: 200000.0, //mayo 2025
    19: 180000.0, //junio 2025
    20: 185000.0, //julio 2025
    21: 200000.01, //agosto 2025
    22: 200000.01, //septiembre 2025
    23: 200000.01, //octubre 2025
    24: 200000.01, //noviembre 2025
    25: 200000.01, //diciembre 2025
    26: 210000.0, //enero 2026
    27: 210000.0, //febrero 2026
    28: 200000.01, //marzo 2026
    29: 200000.01, //abril 2026
    30: 200000.01, //mayo 2026
    31: 200000.01, //junio 2026
    32: 200000.01, //julio 2026
    33: 200000.01, //agosto 2026
    34: 200000.01, //septiembre 2026
    35: 200000.01, //octubre 2026
    36: 200000.01, //noviembre 2026
    37: 200000.01, //diciembre 2026
  },
  "ventasmztproductoselrey.com@gmail.com": {
    // Mazatlan
    11: 200000.0,
    12: 210000.0,
    13: 215000.0,
    14: 220000.0, //enero 2025
    15: 200000.0, //febrero 2025
    16: 190000.0, //marzo 2025
    17: 195000.0, //abril 2025
    18: 200000.0, //mayo 2025
    19: 180000.0, //junio 2025
    20: 185000.0, //julio 2025
    21: 200000.01, //agosto 2025
    22: 200000.01, //septiembre 2025
    23: 200000.01, //octubre 2025
    24: 200000.01, //noviembre 2025
    25: 200000.01, //diciembre 2025
    26: 120000.0, //enero 2026
    27: 130000.0, //febrero 2026
    28: 200000.01, //marzo 2026
    29: 200000.01, //abril 2026
    30: 200000.01, //mayo 2026
    31: 200000.01, //junio 2026
    32: 200000.01, //julio 2026
    33: 200000.01, //agosto 2026
    34: 200000.01, //septiembre 2026
    35: 200000.01, //octubre 2026
    36: 200000.01, //noviembre 2026
    37: 200000.01, //diciembre 2026
  },
  "alopezelrey@gmail.com": {
    // Arlyn
    11: 180000.0,
    12: 190000.0,
    13: 195000.0,
    14: 200000.0, //enero 2025
    15: 190000.0, //febrero 2025
    16: 185000.0, //marzo 2025
    17: 190000.0, //abril 2025
    18: 195000.0, //mayo 2025
    19: 175000.0, //junio 2025
    20: 180000.0, //julio 2025
    21: 200000.01, //agosto 2025
    22: 200000.01, //septiembre 2025
    23: 200000.01, //octubre 2025
    24: 200000.01, //noviembre 2025
    25: 200000.01, //diciembre 2025
    26: 200000.01, //enero 2026
    27: 200000.01, //febrero 2026
    28: 200000.01, //marzo 2026
    29: 200000.01, //abril 2026
    30: 200000.01, //mayo 2026
    31: 200000.01, //junio 2026
    32: 200000.01, //julio 2026
    33: 200000.01, //agosto 2026
    34: 200000.01, //septiembre 2026
    35: 200000.01, //octubre 2026
    36: 200000.01, //noviembre 2026
    37: 200000.01, //diciembre 2026
  },
  "promotoriaelrey@gmail.com": {
    // Karla - Placeholder goals
    11: 150000.0,
    12: 160000.0,
    13: 165000.0,
    14: 170000.0, //enero 2025
    15: 160000.0, //febrero 2025
    16: 155000.0, //marzo 2025
    17: 160000.0, //abril 2025
    18: 165000.0, //mayo 2025
    19: 150000.0, //junio 2025
    20: 155000.0, //julio 2025
    21: 200000.01, //agosto 2025
    22: 200000.01, //septiembre 2025
    23: 120299.0, //octubre 2025
    24: 200000.01, //noviembre 2025
    25: 123719.0, //diciembre 2025
    26: 133157.0, //enero 2026
    27: 180651.0, //febrero 2026
    28: 200000.01, //marzo 2026
    29: 200000.01, //abril 2026
    30: 200000.01, //mayo 2026
    31: 200000.01, //junio 2026
    32: 200000.01, //julio 2026
    33: 200000.01, //agosto 2026
    34: 200000.01, //septiembre 2026
    35: 200000.01, //octubre 2026
    36: 200000.01, //noviembre 2026
    37: 200000.01, //diciembre 2026
  },
  "franzcharbell@gmail.com": {
    // Franz
    11: 200000.0,
    12: 210000.0,
    13: 215000.0,
    14: 220000.0, //enero 2025
    15: 200000.0, //febrero 2025
    16: 190000.0, //marzo 2025
    17: 195000.0, //abril 2025
    18: 200000.0, //mayo 2025
    19: 180000.0, //junio 2025
    20: 185000.0, //julio 2025
    21: 200000.01, //agosto 2025
    22: 200000.01, //septiembre 2025
    23: 200000.01, //octubre 2025
    24: 200000.01, //noviembre 2025
    25: 200000.01, //diciembre 2025
  },
  "ventas4productoselrey@gmail.com": {
    // Reyna
    11: 200000.0,
    12: 210000.0,
    13: 215000.0,
    14: 220000.0, //enero 2025
    15: 200000.0, //febrero 2025
    16: 190000.0, //marzo 2025
    17: 195000.0, //abril 2025
    18: 200000.0, //mayo 2025
    19: 180000.0, //junio 2025
    20: 185000.0, //julio 2025
    21: 200000.01, //agosto 2025
    22: 200000.01, //septiembre 2025
    23: 200000.01, //octubre 2025
    24: 200000.01, //noviembre 2025
    25: 212699.0, //diciembre 2025
    26: 220461.0, //enero 2026
    27: 210372.0, //febrero 2026
    28: 200000.01, //marzo 2026
    29: 200000.01, //abril 2026
    30: 200000.01, //mayo 2026
    31: 200000.01, //junio 2026
    32: 200000.01, //julio 2026
    33: 200000.01, //agosto 2026
    34: 200000.01, //septiembre 2026
    35: 200000.01, //octubre 2026
    36: 200000.01, //noviembre 2026
    37: 200000.01, //diciembre 2026
  },
};

export function getSellerGoal(email: string, period: GoalPeriod): number {
  return sellerGoals[email]?.[period] || 0;
}

export function calculateGoalProgress(
  email: string,
  period: GoalPeriod,
  currentSales: number,
): number {
  const goal = getSellerGoal(email, period);
  if (goal === 0) return 0;
  return (currentSales / goal) * 100;
}

export function getSellersWithGoals(): string[] {
  return Object.keys(sellerGoals);
}

export type { GoalPeriod };
