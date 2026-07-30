"use client";

/**
 * Modal flotante de consentimiento GPS.
 * - Autorizar → granted
 * - Continuar sin GPS / cerrar → denied (modo sin GPS automático)
 */
export function GpsConsentModal({
  open,
  onGrant,
  onDeny,
}: {
  open: boolean;
  onGrant: () => void;
  onDeny: () => void;
}) {
  if (!open) return null;

  return (
    <div
      className="gps-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="gps-modal-title"
    >
      <div className="gps-modal-card">
        <h2 id="gps-modal-title" className="gps-modal-title">
          Ubicación GPS
        </h2>
        <p className="gps-modal-text">
          ¿Autorizas capturar la <strong>ubicación del dispositivo</strong>{" "}
          (coordenadas) junto a cada medición? Se usa para el registro y el mapa.
        </p>
        <p className="gps-modal-hint">
          Si no autorizas, la medición continúa <strong>sin GPS</strong>{" "}
          automáticamente.
        </p>
        <div className="gps-modal-actions">
          <button
            type="button"
            className="btn btn-primary"
            onClick={onGrant}
          >
            Autorizar y continuar
          </button>
          <button type="button" className="btn btn-ghost" onClick={onDeny}>
            Continuar sin GPS
          </button>
        </div>
      </div>
    </div>
  );
}
