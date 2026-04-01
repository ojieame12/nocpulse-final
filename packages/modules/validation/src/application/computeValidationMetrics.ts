export type ValidationPair = {
  predicted: number;
  observed: number;
};

export type ValidationMetrics = {
  rmse: number;
  mae: number;
  pearsonR: number;
  bias: number;
};

/**
 * Compute standard validation metrics from paired predicted/observed values.
 *
 * - RMSE:     sqrt(mean((predicted - observed)^2))
 * - MAE:      mean(|predicted - observed|)
 * - Pearson r: correlation coefficient
 * - Bias:     mean(predicted - observed)
 *
 * Returns NaN for all metrics when fewer than 3 pairs are provided,
 * since correlation is undefined for < 3 data points and the other
 * metrics are unreliable.
 */
export function computeValidationMetrics(
  pairs: readonly ValidationPair[],
): ValidationMetrics {
  const nan = { rmse: NaN, mae: NaN, pearsonR: NaN, bias: NaN };

  if (pairs.length < 3) {
    return nan;
  }

  const n = pairs.length;

  let sumError = 0;
  let sumAbsError = 0;
  let sumSqError = 0;
  let sumPred = 0;
  let sumObs = 0;

  for (const { predicted, observed } of pairs) {
    const error = predicted - observed;
    sumError += error;
    sumAbsError += Math.abs(error);
    sumSqError += error * error;
    sumPred += predicted;
    sumObs += observed;
  }

  const bias = sumError / n;
  const mae = sumAbsError / n;
  const rmse = Math.sqrt(sumSqError / n);

  // Pearson correlation coefficient
  const meanPred = sumPred / n;
  const meanObs = sumObs / n;

  let sumCrossDeviation = 0;
  let sumPredSqDeviation = 0;
  let sumObsSqDeviation = 0;

  for (const { predicted, observed } of pairs) {
    const dp = predicted - meanPred;
    const do_ = observed - meanObs;
    sumCrossDeviation += dp * do_;
    sumPredSqDeviation += dp * dp;
    sumObsSqDeviation += do_ * do_;
  }

  const denominator = Math.sqrt(sumPredSqDeviation * sumObsSqDeviation);
  const pearsonR = denominator === 0 ? NaN : sumCrossDeviation / denominator;

  return { rmse, mae, pearsonR, bias };
}
