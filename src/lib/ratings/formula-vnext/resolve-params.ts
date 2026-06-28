import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { FormulaVnextParams } from "./types";
import { DEFAULT_FORMULA_VNEXT_PARAMS, mergeFormulaVnextParams } from "./params";

const CALIBRATION_REPORT = join(process.cwd(), "scripts", "reports", "rating-reformulation-calibration.json");

type CalibrationReport = {
  validationGates?: { holdoutNotWorse?: boolean };
  calibratedParams?: Partial<Pick<FormulaVnextParams, "opponentSlope" | "playingUpPerYear">>;
};

/**
 * Shadow scripts use calibrated coefficients only when holdout validation passes.
 * Otherwise defaults are used (rank-stability-first rollout).
 */
export function resolveShadowFormulaParams(): FormulaVnextParams {
  if (!existsSync(CALIBRATION_REPORT)) {
    return DEFAULT_FORMULA_VNEXT_PARAMS;
  }

  try {
    const report = JSON.parse(readFileSync(CALIBRATION_REPORT, "utf8")) as CalibrationReport;
    if (!report.validationGates?.holdoutNotWorse) {
      return DEFAULT_FORMULA_VNEXT_PARAMS;
    }
    return mergeFormulaVnextParams(report.calibratedParams ?? {});
  } catch {
    return DEFAULT_FORMULA_VNEXT_PARAMS;
  }
}
