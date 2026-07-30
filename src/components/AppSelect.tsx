"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { createPortal } from "react-dom";

export type AppSelectOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

type Props = {
  id?: string;
  value: string;
  options: AppSelectOption[];
  disabled?: boolean;
  className?: string;
  "aria-label"?: string;
  onChange: (value: string) => void;
};

/**
 * Select propio (no nativo Android).
 * Cierra en un solo toque: evita "ghost click" que reabre el menú en móvil.
 */
export function AppSelect({
  id,
  value,
  options,
  disabled,
  className,
  onChange,
  "aria-label": ariaLabel,
}: Props) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({});
  /** Ignora reabrir el menú tras elegir (ghost click ~300ms en Android). */
  const ignoreOpenUntil = useRef(0);
  const openRef = useRef(false);

  const label = useMemo(() => {
    const hit = options.find((o) => o.value === value);
    return hit?.label ?? value ?? "—";
  }, [options, value]);

  const selectedIndex = useMemo(
    () => Math.max(0, options.findIndex((o) => o.value === value)),
    [options, value],
  );

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    openRef.current = open;
  }, [open]);

  const placeMenu = useCallback(() => {
    const el = rootRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const gap = 6;
    const maxH = Math.min(280, Math.floor(window.innerHeight * 0.45));
    const spaceBelow = window.innerHeight - rect.bottom - gap - 12;
    const spaceAbove = rect.top - gap - 12;
    const openUp = spaceBelow < 160 && spaceAbove > spaceBelow;
    const height = Math.min(maxH, openUp ? spaceAbove : spaceBelow);
    const width = Math.max(rect.width, 160);
    const left = Math.min(
      Math.max(8, rect.left),
      window.innerWidth - width - 8,
    );

    setMenuStyle({
      position: "fixed",
      left,
      width,
      maxHeight: Math.max(120, height),
      zIndex: 80,
      ...(openUp
        ? { bottom: window.innerHeight - rect.top + gap, top: "auto" }
        : { top: rect.bottom + gap, bottom: "auto" }),
    });
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    openRef.current = false;
    // Bloquear reopen por ghost click / focus del trigger
    ignoreOpenUntil.current = Date.now() + 450;
  }, []);

  const openMenu = useCallback(() => {
    if (disabled) return;
    if (Date.now() < ignoreOpenUntil.current) return;
    placeMenu();
    setOpen(true);
    openRef.current = true;
  }, [disabled, placeMenu]);

  const toggle = useCallback(() => {
    if (disabled) return;
    if (Date.now() < ignoreOpenUntil.current) return;
    if (openRef.current) {
      close();
    } else {
      openMenu();
    }
  }, [close, disabled, openMenu]);

  // Cerrar al tocar fuera (no en la misma pulsación de una opción)
  useEffect(() => {
    if (!open) return;

    const onPointerDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (rootRef.current?.contains(t)) return;
      if (menuRef.current?.contains(t)) return;
      close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
      }
    };
    const onReposition = () => placeMenu();

    // pointerdown (no click): un solo evento en táctil, sin doble disparo
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", onReposition);
    window.addEventListener("scroll", onReposition, true);

    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onReposition);
      window.removeEventListener("scroll", onReposition, true);
    };
  }, [close, open, placeMenu]);

  const pick = useCallback(
    (opt: AppSelectOption, e?: ReactPointerEvent | React.MouseEvent) => {
      if (opt.disabled) return;
      e?.preventDefault();
      e?.stopPropagation();
      // Cerrar YA (antes de onChange) para que el re-render no deje el menú abierto
      ignoreOpenUntil.current = Date.now() + 450;
      setOpen(false);
      openRef.current = false;
      onChange(opt.value);
    },
    [onChange],
  );

  /** Touch ya abrió/cerró en pointerup; el click sintético se ignora. */
  const touchToggleAt = useRef(0);

  const onTriggerPointerUp = (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (e.pointerType === "touch" || e.pointerType === "pen") {
      e.preventDefault();
      touchToggleAt.current = Date.now();
      toggle();
    }
  };

  const onTriggerClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    // Ghost click tras touch (~300ms): no volver a toggle
    if (Date.now() - touchToggleAt.current < 500) {
      e.preventDefault();
      return;
    }
    toggle();
  };

  const onTriggerKeyDown = (e: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return;
    if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      openMenu();
    }
  };

  const onOptionKeyDown = (
    e: ReactKeyboardEvent<HTMLButtonElement>,
    index: number,
    opt: AppSelectOption,
  ) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      pick(opt);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      menuRef.current
        ?.querySelector<HTMLElement>(
          `[data-index="${Math.min(options.length - 1, index + 1)}"]`,
        )
        ?.focus();
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      menuRef.current
        ?.querySelector<HTMLElement>(`[data-index="${Math.max(0, index - 1)}"]`)
        ?.focus();
    }
  };

  const menu =
    open && mounted
      ? createPortal(
          <>
            <div
              className="app-select-backdrop"
              aria-hidden
              onPointerDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                close();
              }}
            />
            <ul
              ref={menuRef}
              id={listId}
              className="app-select-menu"
              role="listbox"
              aria-label={ariaLabel}
              style={menuStyle}
            >
              {options.map((o, i) => {
                const selected = o.value === value;
                return (
                  <li key={o.value} role="presentation">
                    <button
                      type="button"
                      role="option"
                      data-index={i}
                      aria-selected={selected}
                      disabled={o.disabled}
                      className={`app-select-option${
                        selected ? " is-selected" : ""
                      }`}
                      onPointerDown={(e) => {
                        // Un solo toque: elegir y cerrar (sin esperar click + ghost)
                        if (e.button !== 0 && e.pointerType === "mouse") return;
                        pick(o, e);
                      }}
                      onClick={(e) => {
                        // Ratón sin pointerdown previo / accesibilidad
                        e.preventDefault();
                        e.stopPropagation();
                        if (openRef.current) pick(o, e);
                      }}
                      onKeyDown={(e) => onOptionKeyDown(e, i, o)}
                    >
                      {o.label}
                    </button>
                  </li>
                );
              })}
            </ul>
          </>,
          document.body,
        )
      : null;

  return (
    <div
      ref={rootRef}
      className={`app-select ${open ? "is-open" : ""} ${
        disabled ? "is-disabled" : ""
      } ${className ?? ""}`}
    >
      <button
        type="button"
        id={id}
        className="app-select-trigger"
        disabled={disabled}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        onClick={onTriggerClick}
        onPointerUp={onTriggerPointerUp}
        onKeyDown={onTriggerKeyDown}
      >
        <span className="app-select-text">{label}</span>
        <span className="app-select-chevron" aria-hidden>
          ▾
        </span>
      </button>
      {menu}
    </div>
  );
}
