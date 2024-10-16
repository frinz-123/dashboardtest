type GoalPeriod = 11 | 12 | 13;

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
  },
  'ventas2productoselrey@gmail.com': { // Roel
    11: 205426.29,
    12: 212210.14,
    13: 220461.01,
  },
  'ventas3productoselrey@gmail.com': { // Lidia
    11: 214002.03,
    12: 257520.55,
    13: 219610.47,
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
