import { BRAND } from "@/lib/brand";

export function BrandFooter() {
  return (
    <footer className="brand-footer">
      <div className="brand-footer-inner">
        <div className="brand-footer-logos">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={BRAND.assets.escudo}
            alt="Escudo del Perú"
            width={22}
            height={28}
          />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={BRAND.assets.osiptelLogo}
            alt={BRAND.name}
            className="brand-footer-osiptel"
          />
        </div>
        <div className="brand-footer-text">
          <strong>{BRAND.fullName}</strong>
          <p>
            Herramienta de medición de calidad de internet fija con enfoque en el
            Cumplimiento de Velocidad Mínima (Ley N.º 31207). Uso orientativo /
            MVP — no sustituye por sí sola un procedimiento oficial de
            fiscalización.
          </p>
          <p className="brand-footer-links">
            <a href={BRAND.urls.institution} target="_blank" rel="noopener noreferrer">
              gob.pe/osiptel
            </a>
            <span aria-hidden>·</span>
            <a href={BRAND.urls.gobpe} target="_blank" rel="noopener noreferrer">
              gob.pe
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}
