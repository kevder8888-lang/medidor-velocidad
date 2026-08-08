# Identidad visual — Medidor de Velocidad OSIPTEL

**Proyecto definitivo** de la familia en `D:\01 KEVIN\Bitácora\`.  
Documento de referencia para **replicar la UI** en proyectos hermanos (misma marca gob.pe / OSIPTEL, otro producto).

| Campo | Valor |
|--------|--------|
| App | Medidor de Velocidad OSIPTEL |
| Repo | `medidor-velocidad` |
| Stack UI | Next.js + Tailwind v4 + shadcn/base-ui + CSS institucional |
| Fecha de captura | 2026-08-07 |
| Última actualización UX | 2026-08-07 — footer oculto si hay menú inferior |

---

## 1. Marca y copy

Fuente de verdad en código: `src/lib/brand.ts`.

```ts
name: "OSIPTEL"
fullName: "Organismo Supervisor de Inversión Privada en Telecomunicaciones"
tagline: "Promovemos la competencia, empoderamos al usuario"
productName: "Medidor de velocidad"          // ← cambiar por proyecto hermano
productSubtitle: "Internet fija · Cumplimiento de velocidad mínima \(CVM\)"
urls.institution: "https://www.gob.pe/osiptel"
urls.gobpe: "https://www.gob.pe"
```

**Al clonar la identidad en un hermano:** conservar colores, chrome gob.pe y layout; **solo** cambiar `productName`, `productSubtitle` y splash/iconos del producto.

---

## 2. Paleta de colores

### 2.1 Institucional (CSS variables)

Definidas en `src/app/globals.css` → `:root`:

| Token | Hex | Uso |
|--------|-----|-----|
| `--osiptel-blue` / `--primary` | `#0056AC` | Primario, nav inferior, botones, enlaces, focus ring |
| `--osiptel-blue-dark` / `--brand-navy` | `#003D7A` | Sombra/nav, texto secundario fuerte |
| `--osiptel-blue-mid` | `#0079C1` | Acento medio |
| `--osiptel-blue-light` | `#1081C6` | Gráficos secundarios, primary dark-mode |
| `--osiptel-sky` | `#74BDEA` | Acento cielo |
| `--osiptel-surface` | `#EFF5FC` | Fondo degradado body (arriba) |
| `--peru-red` | `#BF0909` | Barra superior gob.pe |
| `--inst-border` | `#D5E3F2` | Bordes suaves, chrome |
| `--inst-border-strong` | `#A8C6E8` | Bordes énfasis |
| `--inst-text` | `#26292E` | Texto principal |
| `--inst-text-muted` | `#5A6570` | Texto secundario |
| `--inst-text-dim` | `#6F777B` | Texto terciario |
| `--inst-success` | `#1B9D6B` | OK / operativo |
| `--inst-warning` | `#C47F00` | Aviso / taller |
| `--inst-danger` | `#C81E1E` | Error, pánico, destructivo fuerte |
| `--brand-orange` | `#F98E11` | Acento (combustible, charts) |

### 2.2 Superficies (shadcn)

| Token | Claro | Uso |
|--------|--------|-----|
| `--background` | blanco `#fff` | Página, header, footer |
| `--card` | blanco | Tarjetas / listas |
| `--muted` | gris muy claro | Fondos suaves |
| `--border` / `--input` | gris claro | Inputs y bordes genéricos |
| `--radius` | `0.875rem` (14px) | Radio base del sistema |

### 2.3 Fondo de página

```css
body {
  background: linear-gradient(180deg, var(--osiptel-surface) 0%, var(--background) 220px);
}
```

Secciones de contenido: **tarjetas blancas** (`bg-card` + `border-border` + `rounded-xl` + sombra suave).

### 2.4 Charts (Recharts en dashboard)

| Serie | Color |
|--------|--------|
| Horas / primario | `#0056AC` |
| Km / secundario | `#1081C6` |
| Combustible | `#F98E11` |
| Pie flota | success / warning / danger / blue / slate |

---

## 3. Tipografía

- **Familia:** Geist Sans (Next `next/font/google`), mono Geist Mono.
- **Antialiasing** en `<html>`.
- **Mobile (≤768px):** escala de texto Tailwind × **0.85** (`--text-xs` … `--text-lg`).
- Títulos de página: `text-lg font-semibold`.
- Descripciones: `text-sm text-muted-foreground`.
- Labels de filtros: `text-xs text-muted-foreground`.
- Nav inferior: `11px`, `font-weight: 700`.

---

## 4. Layout y contenedores

| Concepto | Valor |
|----------|--------|
| Ancho máximo chrome / contenido | **1120px** (header, footer, bottom-nav) |
| Contenido de pantallas de app | **`max-w-2xl`** (~672px) centrado |
| Login | centrado `min-h-svh`, sin bottom-nav |
| Padding horizontal página | `px-4` (16px) |
| Padding vertical página | `py-6` típico |
| Safe areas | `--safe-top/bottom/left/right` = `env(safe-area-inset-*)` |

---

## 5. Splash (pantalla de carga)

**Componente:** `src/components/SplashScreen.tsx`  
**Asset:** `public/branding/splash.png`

| Propiedad | Valor |
|-----------|--------|
| Fondo | `linear-gradient` Tailwind: `from-white to-[#0056AC]` (arriba → abajo) |
| Imagen | `fill`, `object-cover` móvil / `object-contain` desktop (`md:`) |
| Duración visible | **1200 ms** |
| Fade out | **400 ms** |
| z-index | **100** |
| Cuándo | Cada carga completa de la app (layout root) |

**Replicar:** copiar `SplashScreen` + generar `splash.png` con el mismo degradado y logo del producto hermano.

---

## 6. Login

**Ruta:** `/login` — sin `BrandHeader` / sin bottom-nav (`AppChrome` omite chrome en login).

Estructura:
1. Título: `BRAND.productName` (`text-lg font-semibold`)
2. Subtítulo: `BRAND.productSubtitle` (`text-sm muted`)
3. Formulario `max-w-sm`, campos apilados `gap-3`
4. Email + contraseña (input con **ojito** mostrar/ocultar)
5. Botón submit **primary** `size="lg"` `h-12` full width del form
6. Nota pie: cuentas las crea admin + teléfono soporte

Inputs: componente shadcn `Input` (`h-8`, `rounded-lg`).  
En formularios de app a veces se usa `h-9` custom (selects dashboard).

---

## 7. Header (chrome institucional)

**Componentes:** `BrandHeader` + clases en `globals.css`  
**Bloque:** `.brand-chrome`  
**Margen inferior:** 22px desktop / 12px mobile  

### 7.1 Barra gob.pe (roja)

| Propiedad | Valor |
|-----------|--------|
| Clase | `.gov-topbar` |
| Fondo | `--peru-red` `#BF0909` |
| Padding inner | 4px vertical + safe laterales |
| Escudo | `public/brand/escudo-peru.svg`, altura **20px** |
| Wordmark gob.pe | `gobpe-text.svg`, altura **11px**, filtro blanco |
| Gap marca | 10px |
| Label derecha | “Estado Peruano”, 12px, weight 600, blanco 95% |

### 7.2 Banda institucional blanca

| Propiedad | Valor |
|-----------|--------|
| Clase | `.inst-header-band` / `.inst-header` |
| Fondo | blanco |
| Padding | 8px vertical |
| Logo OSIPTEL | `osiptel-logo.png`, altura **32px**, max-width 140px |
| Kicker | “OSIPTEL”, 10px, bold, uppercase, letter-spacing 0.08em, color primary |
| Título producto | clamp 1–1.2rem, weight 750, letter-spacing -0.02em |
| Subtítulo | 0.78rem, muted; **oculto en mobile** (`.desktop-only`) |
| Borde inferior chrome | 1px `--inst-border` |
| Sombra chrome | `0 2px 10px rgba(0, 61, 122, 0.06)` |

### 7.3 Sesión (derecha del header)

- Nombre corto + `(admin)` si aplica (`formatProfileLabel`)
- Botón salir: círculo **32px** (`size-8`), fondo **destructive**, icono LogOut blanco

---

## 8. Footer

**Componente:** `BrandFooter`  
**Clases:** `.brand-footer`

| Propiedad | Valor |
|-----------|--------|
| Borde superior | **2px** solid `--osiptel-blue` |
| Fondo | blanco |
| Margin-top | 12px |
| Padding inner | 10px 16px 12px |
| Logo footer | altura **26px**, max 110px |
| Texto | 11px muted; strong 11.5px |
| Enlaces | weight 600, color primary |

### 8.1 Regla UX: footer vs menú inferior (obligatoria)

> **No mostrar el footer institucional cuando hay `BottomNav`.**

| Contexto | Header | Footer | BottomNav |
|----------|--------|--------|-----------|
| Login | No | No | No |
| App autenticada (casi todas las pantallas) | Sí | **No** | Sí |
| Pantalla con header pero **sin** menú (caso futuro) | Sí | Sí | No |
| Mapa full-bleed (p. ej. DriveTest grabación) | No | No | No |

**Por qué:** el footer repite marca (logo/OSIPTEL ya van en el header) y compite visualmente con el menú fijo azul. En PWA de campo la identidad basta con **header gob.pe + nav inferior**.

**Implementación:** en `AppChrome.tsx`:

```tsx
{!showBottomNav && <BrandFooter />}
{showBottomNav && <BottomNav />}
```

**Proyectos que ya aplican la regla:**  
- `medidor-velocidad`  
- `Drivetest-map` (drivetest-route-planner)

El componente `BrandFooter` **se mantiene** en el código por si hace falta en pantallas sin nav o en una página “Acerca de”; no se elimina del kit, solo se **no renderiza** junto al menú.

---

## 9. Menú inferior (BottomNav)

**Componente:** `BottomNav`  
**Clases:** `.bottom-nav`, `.bottom-nav-item`

| Propiedad | Valor |
|-----------|--------|
| Posición | `fixed` bottom, z-index **60** |
| Altura útil | `--bottom-nav-h: 60px` + safe-bottom |
| Max-width | 1120px centrado |
| Fondo | `--osiptel-blue` |
| Sombra | `0 -4px 20px rgba(0, 61, 122, 0.24)` |
| Layout | CSS grid columnas iguales |
| Item | columna icono + label, gap 2px |
| Color item | blanco 72% opacidad |
| Font | 11px / 700 |
| Icono | Lucide **18px** |
| **Activo** | fondo **blanco**, color primary, margin 6px 4px, radius **14px** |
| Padding contenido app | `.has-bottom-nav` → padding-bottom = nav-h + safe |

**Ítems típicos Bitácora (referencia de densidad):**  
User: Registros, Bitácora, Mantenim., Anexos, Dashboard  
Admin +: Mapa, Vehículos, Admin  

---

## 10. Botón de pánico (FAB)

**Componente:** `EmergenciaButton`

| Propiedad | Valor |
|-----------|--------|
| Posición | fixed right 16px, encima del nav |
| Bottom | `bottom-nav-h + safe-bottom + 16px` |
| Tamaño | **56×56px** (`size-14`), círculo |
| Fondo | `--inst-danger` `#C81E1E` |
| Icono | Lucide `TriangleAlert`, 24px, blanco |
| Interacción | hold **2 s** + barra de progreso **centrada en pantalla** (panel max-w-xs) |
| z-index FAB | 50; overlay progreso | 60 |

---

## 11. Componentes de UI recurrentes

### 11.1 Tarjetas / listas

```
rounded-xl border border-border bg-card p-3|p-4 shadow-sm
```

- Listas de ítems: `flex flex-col gap-2`
- Ítem clicable: hover `border-primary/40` o `hover:bg-accent`
- Vacío: `border-dashed` + texto centrado muted

### 11.2 Botones (shadcn)

| Variante | Uso |
|----------|-----|
| `default` | Primary `#0056AC`, texto blanco |
| `outline` | Borde, fondo background |
| `destructive` | Texto/rojo suave |
| Tamaños | default h-8; sm h-7; lg h-9; en CTAs de form a veces `h-12` |
| Radius | `rounded-lg` |

### 11.3 Inputs y selects

- Input base: h-8, rounded-lg, border-input, focus ring primary/50  
- Select dashboard/filtros:

```
h-9 w-full rounded-lg border border-input bg-background px-3 text-sm
focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40
```

- **SearchableSelect:** combobox con búsqueda, lista `max-h-64`, popover, item hover `bg-accent`, highlight  
  Archivo: `src/components/ui/searchable-select.tsx`

### 11.4 Diálogos

- Modal centrado, `rounded-xl`, ring suave  
- Confirm destructivo: botón rojo + “Cancelar” outline  
  `src/components/ui/confirm-dialog.tsx`

### 11.5 Toasts

- `sonner` (Toaster en layout)

### 11.6 Badges de estado (vehículo)

- Operativo: success bg 10% + texto success  
- En taller: warning  
- Inoperativo: danger  
  (ver `ESTADO_BADGE` en listas de vehículos)

### 11.7 Status cards genéricas

Clases `.status-card.ok|.warn|.bad` + `.status-dot` en `globals.css`.

---

## 12. Assets a copiar

```
public/brand/
  escudo-peru.svg | .png
  gobpe-text.svg
  osiptel-logo.png

public/branding/
  splash.png          # splash producto
  osiptel-icon.png

public/icons/
  icon-192.png
  icon-512.png
  icon-maskable-512.png

public/vehicle/       # solo si el hermano usa mapa con camioneta
  camioneta.png
```

---

## 13. Shell de aplicación (`AppChrome`)

Orden de capas (app autenticada con navegación):

```
BrandHeader
  └─ main / children (contenido)
BottomNav          ← fijo
EmergenciaButton   ← no aplica en Medidor
```

**No incluir** `BrandFooter` en este modo.

Orden login:

```
children (login centrado)  ← sin header, sin footer, sin nav
```

---

## 14. Archivos clave a portar

| Qué | Ruta en este proyecto |
|-----|------------------------|
| Tokens + chrome CSS | `src/app/globals.css` (bloques institucional + bottom-nav) |
| Constantes marca | `src/lib/brand.ts` |
| Header | `src/components/brand/BrandHeader.tsx` |
| Footer | `src/components/brand/BrandFooter.tsx` (componente sí; ver regla §8.1) |
| Shell | `src/components/brand/AppChrome.tsx` |
| Nav | `src/components/brand/BottomNav.tsx` |
| Splash | `src/components/SplashScreen.tsx` |
| Login form | `src/features/authentication/LoginForm.tsx` |
| Sesión header | `src/features/authentication/SignOutButton.tsx` |
| UI kit | `src/components/ui/*` (button, input, dialog, searchable-select…) |
| Theme Tailwind | `@theme inline` + shadcn en `globals.css` |

---

## 15. Checklist al crear un proyecto hermano

1. [ ] Copiar `public/brand/*` y ajustar splash/iconos del **producto**  
2. [ ] Copiar `globals.css` (tokens + chrome + bottom-nav) o extraer a paquete compartido  
3. [ ] Copiar `brand.ts` y renombrar `productName` / subtítulo  
4. [ ] Montar `AppChrome` = Header + children + **BottomNav** (+ FAB si aplica)  
5. [ ] **No renderizar Footer cuando `showBottomNav`** (§8.1)  
6. [ ] Login sin chrome, mismo layout centrado  
7. [ ] Splash con mismos tiempos y degradado blanco → `#0056AC`  
8. [ ] Contenido de pantallas `max-w-2xl`, tarjetas `rounded-xl border bg-card`  
9. [ ] Bottom nav azul + ítem activo blanco/píldora (visible en todo ancho)  
10. [ ] Primary / danger / success / warning alineados a la tabla de §2  
11. [ ] Probar safe-area en iOS y Android (Xiaomi/Honor tienen ajustes extra en CSS)

---

## 16. Qué NO es identidad visual (no copiar ciego)

- Lógica de negocio (bitácora, anexos, pánico con email concreto)  
- Rutas y permisos admin  
- Colores de gráficos de un dashboard concreto (salvo la paleta base)  
- Teléfono de soporte del login (puede ser por producto)

---

## 17. Resumen de “firma visual”

> **Rojo gob.pe arriba → blanco institucional con logo OSIPTEL y sesión → contenido en tarjetas sobre cielo `#EFF5FC` → azul `#0056AC` en acciones y menú inferior con pestaña activa blanca → sin footer cuando hay nav → acentos naranja/semáforo para datos y alertas.**

Si en el futuro se extrae un paquete monorepo (`@osiptel/ui` o carpeta `shared-brand/`), este documento es la especificación; los archivos de la tabla §14 son la implementación de referencia.

