import { BRAND } from "@/lib/brand";
import type { NetworkAccessKind } from "@/lib/isp";
import { serviceModeLabel } from "@/lib/isp";

export function BrandHeader({
  accessKind = "unknown",
}: {
  accessKind?: NetworkAccessKind;
}) {
  const mode = serviceModeLabel(accessKind);

  return (
    <div className="brand-chrome">
      {/* Franja institucional gob.pe */}
      <div className="gov-topbar">
        <div className="gov-topbar-inner">
          <a
            className="gov-topbar-brand"
            href={BRAND.urls.gobpe}
            target="_blank"
            rel="noopener noreferrer"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={BRAND.assets.escudo}
              alt="Escudo del Perú"
              className="gov-escudo"
              width={28}
              height={36}
            />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={BRAND.assets.gobpeText}
              alt="gob.pe"
              className="gov-wordmark"
              height={18}
            />
          </a>
          <span className="gov-topbar-label">Estado Peruano</span>
        </div>
      </div>

      {/* Cabecera OSIPTEL — compacta en móvil */}
      <header className="inst-header">
        <div className="inst-header-inner">
          <a
            className="inst-logo-link"
            href={BRAND.urls.institution}
            target="_blank"
            rel="noopener noreferrer"
            title={BRAND.fullName}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={BRAND.assets.osiptelLogo}
              alt={`Logo ${BRAND.name}`}
              className="inst-logo"
            />
          </a>

          <div className="inst-title-block">
            <p className="inst-kicker">{BRAND.name}</p>
            <h1 className="inst-title">{BRAND.productName}</h1>
            <p className="inst-subtitle desktop-only">{BRAND.productSubtitle}</p>
          </div>

          <div className="inst-badges desktop-only">
            <span className="inst-badge">MVP regulatorio</span>
            <span className="inst-badge inst-badge-soft">CVM 70%</span>
            <span className="inst-badge inst-badge-soft">{mode}</span>
          </div>
        </div>
        <p className="inst-tagline desktop-only">{BRAND.tagline}</p>
        <div className="inst-badges mobile-only inst-badges-mobile">
          <span className="inst-badge inst-badge-soft">CVM 70%</span>
          <span
            className={`inst-badge inst-badge-soft ${
              accessKind === "cellular" ? "inst-badge-mobile" : ""
            }`}
          >
            {mode}
          </span>
        </div>
      </header>
    </div>
  );
}
