import type { CvmResult, ThroughputResult } from "./types";
import { ASYMMETRY_MIN_RATIO, CVM_THRESHOLD_PCT } from "./servers";
import { round } from "./stats";

export function computeCvm(
  download: ThroughputResult,
  upload: ThroughputResult,
  contractedDownMbps: number,
  contractedUpMbps: number | null
): CvmResult {
  const measuredDown = download.medianMbps;
  const measuredUp = upload.medianMbps;
  const minGuaranteed = (CVM_THRESHOLD_PCT / 100) * contractedDownMbps;
  const cvmPct = contractedDownMbps > 0 ? (measuredDown / contractedDownMbps) * 100 : 0;

  const asymmetryContractRatio =
    contractedUpMbps != null && contractedDownMbps > 0
      ? contractedUpMbps / contractedDownMbps
      : null;

  return {
    contractedDownMbps,
    contractedUpMbps,
    minGuaranteedDownMbps: round(minGuaranteed, 2),
    measuredDownMbps: round(measuredDown, 2),
    measuredUpMbps: round(measuredUp, 2),
    cvmPct: round(cvmPct, 1),
    meetsCvm: measuredDown >= minGuaranteed,
    asymmetryContractRatio:
      asymmetryContractRatio != null ? round(asymmetryContractRatio, 3) : null,
    asymmetryMeasuredRatio:
      measuredDown > 0 ? round(measuredUp / measuredDown, 3) : 0,
    meetsAsymmetryContract:
      asymmetryContractRatio != null
        ? asymmetryContractRatio >= ASYMMETRY_MIN_RATIO - 1e-9
        : null,
    thresholdPct: CVM_THRESHOLD_PCT,
  };
}
