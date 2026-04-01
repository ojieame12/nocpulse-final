export {
  type SmapFieldReport,
  type SmapBacktestReport,
} from "./contracts/SmapValidationResult";
export {
  computeValidationMetrics,
  type ValidationPair,
  type ValidationMetrics,
} from "./application/computeValidationMetrics";
export {
  type SmapDataSource,
  type SmapObservation,
  createCsvFixtureSmapSource,
  createAppEearsSmapSource,
} from "./infrastructure/createAppEearsClient";
