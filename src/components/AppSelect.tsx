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
 * Select propio de la app (no el picker nativo de Android).
 * - Web: lista visible con tipografía de la app
 * - Móvil: panel anclado al control (no el picker nativo a pantalla completa)
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
    // Mismo ancho que el control (no full-screen Android)
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

  const close = useCallback(() => setOpen(false), []);

  const openMenu = useCallback(() => {
    if (disabled) return;
    placeMenu();
    setOpen(true);
  }, [disabled, placeMenu]);

  const toggle = useCallback(() => {
    if (disabled) return;
    if (open) close();
    else openMenu();
  }, [close, disabled, open, openMenu]);

  // Cerrar al click fuera / scroll / resize
  useEffect(() => {
    if (!open) return;

    const onPointer = (e: MouseEvent | TouchEvent) => {
      const t = e.target as Node;
      if (rootRef.current?.contains(t)) return;
      if (menuRef.current?.contains(t)) return;
      close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
        rootRef.current?.querySelector<HTMLElement>("button")?.focus();
      }
    };
    const onReposition = () => placeMenu();

    document.addEventListener("mousedown", onPointer);
    document.addEventListener("touchstart", onPointer, { passive: true });
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", onReposition);
    window.addEventListener("scroll", onReposition, true);

    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("touchstart", onPointer);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onReposition);
      window.removeEventListener("scroll", onReposition, true);
    };
  }, [close, open, placeMenu]);

  // Focus opción seleccionada al abrir
  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => {
      const item = menuRef.current?.querySelector<HTMLElement>(
        `[data-index="${selectedIndex}"]`,
      );
      item?.focus();
    }, 0);
    return () => window.clearTimeout(t);
  }, [open, selectedIndex]);

  const pick = (opt: AppSelectOption) => {
    if (opt.disabled) return;
    onChange(opt.value);
    close();
    rootRef.current?.querySelector<HTMLElement>("button")?.focus();
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
      const next = menuRef.current?.querySelector<HTMLElement>(
        `[data-index="${Math.min(options.length - 1, index + 1)}"]`,
      );
      next?.focus();
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      const prev = menuRef.current?.querySelector<HTMLElement>(
        `[data-index="${Math.max(0, index - 1)}"]`,
      );
      prev?.focus();
    }
    if (e.key === "Home") {
      e.preventDefault();
      menuRef.current
        ?.querySelector<HTMLElement>(`[data-index="0"]`)
        ?.focus();
    }
    if (e.key === "End") {
      e.preventDefault();
      menuRef.current
        ?.querySelector<HTMLElement>(`[data-index="${options.length - 1}"]`)
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
              onClick={close}
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
                      onClick={() => pick(o)}
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
        onClick={toggle}
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
