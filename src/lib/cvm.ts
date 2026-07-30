import type {
  CvmResult,
  RadioTech,
  ServiceMode,
  ThroughputResult,
  UserPlan,
} from "./types";
import { ASYMMETRY_MIN_RATIO, CVM_THRESHOLD_PCT } from "./servers";
import { radioTechLabel } from "./mobilePlans";
import { round } from "./stats";

/**
 * Velocidad de referencia para CVM según modo de servicio.
 * - Fijo: plan.downMbps contratado
 * - Móvil: plan.mobileDownMbps (operador × 3G/4G/5G, editable)
 */
export function referenceDownMbps(plan: UserPlan): number {
  if (plan.serviceMode === "mobile") {
    return plan.mobileDownMbps > 0 ? plan.mobileDownMbps : plan.downMbps;
  }
  return plan.downMbps;
}

export function referenceUpMbps(plan: UserPlan): number | null {
  if (plan.serviceMode === "mobile") {
    return plan.mobileUpMbps ?? plan.upMbps;
  }
  return plan.upMbps;
}

export function computeCvmFromPlan(
  download: ThroughputResult,
  upload: ThroughputResult,
  plan: UserPlan
): CvmResult {
  const contractedDown = referenceDownMbps(plan);
  const contractedUp = referenceUpMbps(plan);
  return computeCvm(
    download,
    upload,
    contractedDown,
    contractedUp,
    plan.serviceMode,
    plan.serviceMode === "mobile" ? plan.radioTech : null,
    plan
  );
}

export function computeCvm(
  download: ThroughputResult,
  upload: ThroughputResult,
  contractedDownMbps: number,
  contractedUpMbps: number | null,
  serviceMode: ServiceMode = "fixed",
  radioTech: RadioTech | null = null,
  plan?: UserPlan
): CvmResult {
  const measuredDown = download.medianMbps;
  const measuredUp = upload.medianMbps;
  const minGuaranteed = (CVM_THRESHOLD_PCT / 100) * contractedDownMbps;
  const cvmPct =
    contractedDownMbps > 0 ? (measuredDown / contractedDownMbps) * 100 : 0;

  const asymmetryContractRatio =
    contractedUpMbps != null && contractedDownMbps > 0
      ? contractedUpMbps / contractedDownMbps
      : null;

  let basisNote = `Umbral ${CVM_THRESHOLD_PCT}% de la velocidad de referencia de bajada.`;
  if (serviceMode === "mobile") {
    const op = plan?.operator || "operador";
    const tech = radioTechLabel(radioTech ?? plan?.radioTech);
    basisNote = `Móvil · ${op} · ${tech}: referencia ${contractedDownMbps} Mbps ↓; mínimo garantizado ${CVM_THRESHOLD_PCT}% = ${round(minGuaranteed, 2)} Mbps. (Cada operador define la velocidad de referencia por tecnología; editable en el plan.)`;
  } else {
    basisNote = `Fijo: plan ${contractedDownMbps} Mbps ↓; mínimo garantizado ${CVM_THRESHOLD_PCT}% = ${round(minGuaranteed, 2)} Mbps.`;
  }

  return {
    contractedDownMbps: round(contractedDownMbps, 2),
    contractedUpMbps:
      contractedUpMbps != null ? round(contractedUpMbps, 2) : null,
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
    serviceMode,
    radioTech,
    basisNote,
  };
}
