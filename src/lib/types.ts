export type TestPhase =
  | "idle"
  | "precheck"
  | "server_select"
  | "latency"
  | "download"
  | "upload"
  | "loaded_latency"
  | "done"
  | "error";

export type AccessType = "ethernet" | "wifi" | "cellular" | "unknown";

export type ServerKind = "internet" | "self_hosted" | "custom";

export type ServiceMode = "fixed" | "mobile";

export type RadioTech = "3g" | "4g" | "5g";

export type FixedTechnology =
  | "ftth"
  | "hfc"
  | "wireless_fixed"
  | "other"
  | "";

export interface PreCheckResult {
  online: boolean;
  connectionType: AccessType;
  /** Raw Network Information API type string */
  networkTypeRaw: string | null;
  effectiveType: string | null;
  downlinkMbpsHint: number | null;
  rttHintMs: number | null;
  saveData: boolean;
  hardwareConcurrency: number;
  deviceMemoryGb: number | null;
  vpnHint: boolean;
  userAgent: string;
  timestamp: string;
  pageOrigin: string;
  isLocalhostApp: boolean;
  isAndroid: boolean;
  isMobileUa: boolean;
}

export interface LatencyResult {
  samplesMs: number[];
  medianMs: number;
  meanMs: number;
  minMs: number;
  maxMs: number;
  jitterMs: number;
  packetLossPct: number;
  server: string;
}

export interface ThroughputResult {
  mbps: number;
  medianMbps: number;
  p10Mbps: number;
  p90Mbps: number;
  meanMbps: number;
  samplesMbps: number[];
  bytesTransferred: number;
  durationMs: number;
  streams: number;
  server: string;
  windowsMbps: number[];
}

export interface ConfidenceResult {
  score: number;
  level: "alta" | "media" | "baja";
  factors: { label: string; impact: number; detail: string }[];
  validForRegulatoryCvm: boolean;
}

export interface CvmResult {
  contractedDownMbps: number;
  contractedUpMbps: number | null;
  minGuaranteedDownMbps: number;
  measuredDownMbps: number;
  measuredUpMbps: number;
  cvmPct: number;
  meetsCvm: boolean;
  asymmetryContractRatio: number | null;
  asymmetryMeasuredRatio: number;
  meetsAsymmetryContract: boolean | null;
  thresholdPct: number;
  /** fixed | mobile */
  serviceMode: ServiceMode;
  /** 3g | 4g | 5g when mobile */
  radioTech: RadioTech | null;
  /** Human note for reports */
  basisNote: string;
}

export interface ServerProbe {
  serverId: string;
  name: string;
  region: string;
  kind: ServerKind;
  rttMs: number | null;
  ok: boolean;
  isLoopback: boolean;
  warning?: string;
}

export interface ServerMetaInfo {
  clientIp?: string;
  colo?: string;
  city?: string;
  country?: string;
  asn?: number | string;
  asOrganization?: string;
  latitude?: string | number;
  longitude?: string | number;
  raw?: Record<string, unknown>;
}

export interface NetworkIdentity {
  access: "ethernet" | "wifi" | "cellular" | "unknown";
  accessLabel: string;
  isp: {
    brand: string | null;
    organization: string | null;
    asn: number | null;
    clientIp: string | null;
    country: string | null;
    city: string | null;
    colo: string | null;
    source: string;
    category: string;
    displayName: string;
    confidence: "alta" | "media" | "baja";
    notes: string[];
  };
  likelyMobileData: boolean;
  likelyWifi: boolean;
  simReadable: false;
  disclaimer: string;
}

export interface ResultSignature {
  algorithm: "SHA-256";
  hash: string;
  signedAt: string;
  payloadVersion: string;
}

export interface ResultGeo {
  latitude: number;
  longitude: number;
  accuracyM: number | null;
  altitudeM: number | null;
  timestamp: string;
  source: string;
}

/**
 * Plan del usuario.
 * - fixed: velocidad contratada del plan fijo
 * - mobile: velocidad de referencia del operador según 3G/4G/5G (editable)
 */
export interface UserPlan {
  serviceMode: ServiceMode;
  /** Operador (red o declarado) */
  operator: string;
  /** Fijo: Mbps contratados */
  downMbps: number;
  upMbps: number | null;
  /** Fijo: tecnología de acceso */
  technology: FixedTechnology;
  /** Móvil: tecnología de radio del plan/red al medir */
  radioTech: RadioTech;
  /** Móvil: velocidad de bajada de referencia (operador × tech) */
  mobileDownMbps: number;
  /** Móvil: subida de referencia */
  mobileUpMbps: number | null;
  planLabel?: string;
}

export interface SpeedTestResult {
  id: string;
  protocolVersion: string;
  clientVersion: string;
  startedAt: string;
  finishedAt: string;
  precheck: PreCheckResult;
  selectedServer: {
    id: string;
    name: string;
    region: string;
    kind: ServerKind;
    isLoopback: boolean;
  };
  serverProbes: ServerProbe[];
  serverMeta: ServerMetaInfo | null;
  networkIdentity: NetworkIdentity | null;
  geo: ResultGeo | null;
  runIndex?: number;
  runTotal?: number;
  plan: UserPlan;
  latency: LatencyResult;
  download: ThroughputResult;
  upload: ThroughputResult;
  loadedLatency: LatencyResult | null;
  bufferbloatMs: number | null;
  confidence: ConfidenceResult;
  cvm: CvmResult | null;
  signature: ResultSignature;
  notes: string[];
}

export interface ProgressEvent {
  phase: TestPhase;
  progress: number;
  liveMbps?: number;
  liveLatencyMs?: number;
  message: string;
}

export interface MeasurementServer {
  id: string;
  name: string;
  region: string;
  kind: ServerKind;
  downloadUrl: (bytes: number) => string;
  uploadUrl: string;
  pingUrl: string;
  metaUrl?: string;
  isLoopback: boolean;
  warning?: string;
}

export interface AggregateStats {
  totalTests: number;
  validCvmTests: number;
  cvmPassCount: number;
  cvmFailCount: number;
  cvmPassRatePct: number | null;
  avgDownMbps: number | null;
  avgUpMbps: number | null;
  avgLatencyMs: number | null;
  avgConfidence: number | null;
  medianDownMbps: number | null;
  lastTestAt: string | null;
  byOperator: {
    operator: string;
    count: number;
    passRate: number | null;
    avgDown: number;
  }[];
  byDay: {
    day: string;
    count: number;
    avgDown: number;
    cvmPassRate: number | null;
  }[];
  recentTrend: "up" | "down" | "stable" | "n/a";
}
