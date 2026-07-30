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

export type AccessType = "ethernet" | "wifi" | "unknown";

export type ServerKind = "internet" | "self_hosted" | "custom";

export interface PreCheckResult {
  online: boolean;
  connectionType: AccessType;
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
  /** Mbps samples per ~1s window after ramp-up discard */
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

export interface ResultSignature {
  algorithm: "SHA-256";
  hash: string;
  signedAt: string;
  payloadVersion: string;
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
  progress: number; // 0-100 overall
  liveMbps?: number;
  liveLatencyMs?: number;
  message: string;
}

export interface UserPlan {
  downMbps: number;
  upMbps: number | null;
  operator: string;
  technology: "ftth" | "hfc" | "wireless_fixed" | "other" | "";
  planLabel?: string;
}

export interface MeasurementServer {
  id: string;
  name: string;
  region: string;
  kind: ServerKind;
  /** Absolute or same-origin relative base not needed if URLs fully provided */
  downloadUrl: (bytes: number) => string;
  uploadUrl: string;
  pingUrl: string;
  metaUrl?: string;
  /** True when measuring only loopback/LAN of the client machine */
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
  byOperator: { operator: string; count: number; passRate: number | null; avgDown: number }[];
  byDay: { day: string; count: number; avgDown: number; cvmPassRate: number | null }[];
  recentTrend: "up" | "down" | "stable" | "n/a";
}
