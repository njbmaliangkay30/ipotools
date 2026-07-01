export function calculatePriceGapRatio(founderPrice: number, ipoPrice: number): number {
  if (!founderPrice || founderPrice <= 0) return 0;
  return ipoPrice / founderPrice;
}

export type RiskLevel = 'low' | 'moderate' | 'high' | 'extreme';

export function determineInsiderRisk(
  priceGapRatio: number,
  freeFloatPct: number,
  fundUsage: string,
  hasLockup: boolean
): RiskLevel {
  // Extreme risk: gap > 30x OR high gap + divestment
  if (priceGapRatio >= 30 || (priceGapRatio >= 15 && fundUsage === 'divestasi')) {
    return 'extreme';
  }
  
  // High risk: gap 15-30x OR low float + no lockup
  if (priceGapRatio >= 15 || (!hasLockup && freeFloatPct < 15)) {
    return 'high';
  }
  
  // Moderate risk: gap 5-15x OR no lockup at all
  if (priceGapRatio >= 5 || (!hasLockup)) {
    return 'moderate';
  }
  
  // Low risk: gap < 5x and locked up
  return 'low';
}
