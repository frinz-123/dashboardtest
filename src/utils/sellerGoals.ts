type GoalPeriod = 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18 | 19 | 20;

interface SellerGoal {
  [key: number]: number;
}

interface SellerGoals {
  [email: string]: SellerGoal;
}

const sellerGoals: SellerGoals = {
  'ventas1productoselrey@gmail.com': { // Ernesto
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
  },
  'ventas2productoselrey@gmail.com': { // Roel
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
  },
  'ventas3productoselrey@gmail.com': { // Lidia
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
  },
  'ventasmochisproductoselrey@gmail.com': { // Mochis
    11: 200000.00,
    12: 210000.00,
    13: 215000.00,
    14: 220000.00, //enero 2025
    15: 200000.00, //febrero 2025
    16: 190000.00, //marzo 2025
    17: 195000.00, //abril 2025
    18: 200000.00, //mayo 2025
    19: 180000.00, //junio 2025
    20: 185000.00, //julio 2025
  },
};

export function getSellerGoal(email: string, period: GoalPeriod): number {
  return sellerGoals[email]?.[period] || 0;
}

export function calculateGoalProgress(email: string, period: GoalPeriod, currentSales: number): number {
  const goal = getSellerGoal(email, period);
  if (goal === 0) return 0;
  return (currentSales / goal) * 100;
}
