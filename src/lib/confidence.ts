import type {
  ConfidenceResult,
  MeasurementServer,
  PreCheckResult,
  ThroughputResult,
} from "./types";
import { clamp } from "./stats";

export function computeConfidence(
  precheck: PreCheckResult,
  download: ThroughputResult,
  upload: ThroughputResult,
  server: MeasurementServer,
  notes: string[]
): ConfidenceResult {
  let score = 100;
  const factors: ConfidenceResult["factors"] = [];

  if (server.isLoopback) {
    score -= 55;
    factors.push({
      label: "Servidor loopback / localhost",
      impact: -55,
      detail:
        "Esta medición no refleja tu ISP. Despliega el nodo en Internet o usa Cloudflare.",
    });
    notes.push(
      "Servidor de medición en loopback: resultado no válido para CVM regulatorio."
    );
  }

  if (precheck.connectionType === "wifi") {
    score -= 18;
    factors.push({
      label: "Wi‑Fi detectado",
      impact: -18,
      detail: "Para CVM regulatorio mide preferentemente por cable Ethernet.",
    });
    notes.push(
      "Acceso Wi‑Fi: la medición puede subestimar la capacidad del enlace fijo."
    );
  } else if (precheck.connectionType === "ethernet") {
    factors.push({
      label: "Ethernet",
      impact: 0,
      detail: "Mejor escenario para medir el enlace fijo del operador.",
    });
  } else {
    score -= 8;
    factors.push({
      label: "Tipo de acceso desconocido",
      impact: -8,
      detail:
        "El navegador no reportó Ethernet/Wi‑Fi. Confirma que midas por cable.",
    });
  }

  if (precheck.saveData) {
    score -= 15;
    factors.push({
      label: "Ahorro de datos activo",
      impact: -15,
      detail: "Puede limitar el throughput del navegador.",
    });
    notes.push("Modo ahorro de datos activo.");
  }

  if (!precheck.online) {
    score -= 40;
    factors.push({
      label: "Sin conexión reportada",
      impact: -40,
      detail: "navigator.onLine = false al iniciar.",
    });
  }

  if (precheck.hardwareConcurrency < 4) {
    score -= 5;
    factors.push({
      label: "CPU limitada",
      impact: -5,
      detail: "Pocos hilos lógicos; el cliente puede no saturar el enlace.",
    });
  }

  const downSpread =
    download.medianMbps > 0
      ? (download.p90Mbps - download.p10Mbps) / download.medianMbps
      : 0;
  if (downSpread > 0.45) {
    score -= 12;
    factors.push({
      label: "Throughput inestable",
      impact: -12,
      detail: `Variación P10–P90 alta (${(downSpread * 100).toFixed(0)}% de la mediana).`,
    });
    notes.push("Velocidad de bajada inestable durante la prueba.");
  }

  if (download.durationMs < 8000) {
    score -= 8;
    factors.push({
      label: "Duración corta de descarga",
      impact: -8,
      detail: "Prueba más corta de lo ideal para régimen estable.",
    });
  }

  if (upload.bytesTransferred < 500_000 && upload.medianMbps < 5) {
    score -= 5;
    factors.push({
      label: "Poca muestra de subida",
      impact: -5,
      detail: "Pocos bytes transferidos en upload.",
    });
  }

  if (server.kind === "internet") {
    factors.push({
      label: "Ruta Internet (nodo externo)",
      impact: 0,
      detail: "Throughput medido fuera de la LAN del cliente.",
    });
  }

  score = clamp(Math.round(score), 0, 100);
  const level: ConfidenceResult["level"] =
    score >= 75 ? "alta" : score >= 50 ? "media" : "baja";

  const validForRegulatoryCvm =
    !server.isLoopback && score >= 50 && precheck.online;

  if (!validForRegulatoryCvm) {
    notes.push(
      "Marcado como no válido para CVM regulatorio (confianza/servidor/entorno)."
    );
  }

  return { score, level, factors, validForRegulatoryCvm };
}
