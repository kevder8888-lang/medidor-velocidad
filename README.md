# Medidor de velocidad OSIPTEL (MVP 0.2)

Aplicación web moderna para medir la calidad de **internet fija**, con enfoque regulatorio (CVM 70 %, multi-servidor, firma SHA-256, PDF y agregados).

## Arranque local

```bash
npm install
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000).

## Despliegue (GitHub + Vercel)

### 1. Publicar en GitHub

```bash
# si aún no hay remoto
gh auth login
gh repo create medidor-velocidad --public --source=. --remote=origin --push
```

### 2. Desplegar en Vercel

**Opción A — Dashboard (recomendada)**  
1. Entra a [vercel.com/new](https://vercel.com/new)  
2. Importa el repositorio de GitHub  
3. Framework: **Next.js** (auto)  
4. Deploy  

**Opción B — CLI**

```bash
npx vercel login
npx vercel          # preview
npx vercel --prod   # producción
```

Cada `git push` a `main` redeploya automáticamente si el proyecto está vinculado a GitHub.

### Variables opcionales

| Variable | Descripción |
|----------|-------------|
| `NEXT_PUBLIC_EXTRA_SERVERS` | JSON de nodos extra de medición (ver `.env.example`) |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | Google Maps Embed (opcional; si no, OSM) |
| `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Anon key de Supabase |

### Supabase (mediciones multi-dispositivo + admin)

1. Crea un proyecto en [supabase.com](https://supabase.com).
2. Ejecuta `supabase/schema.sql` en **SQL Editor**.
3. **Authentication → Users → Add user** (email/password del admin).
4. Copia **Project URL** y **anon key** a `.env.local` y a Vercel.
5. Redeploy. Al medir, cada dispositivo sube la prueba; en **Acceso admin** inicias sesión, ves tabla, mapa y descargas CSV/JSON.

El historial local del teléfono sigue existiendo; la nube es el panel central.

## Qué incluye (v0.2)

| Capacidad | Detalle |
|-----------|---------|
| Pre-chequeo | Online, Wi‑Fi/Ethernet (si el navegador lo expone), origen de la app |
| Multi-servidor | Cloudflare + nodo propio (`/api/measure/*`) + extras por env |
| Selección | Automática por menor RTT (evita loopback) o manual |
| Latencia / jitter / pérdida | ~20 muestras RTT |
| Bajada / subida | Multi-stream, mediana de ventanas 1 s tras ramp-up |
| Latencia bajo carga | Bufferbloat |
| CVM 70 % | Semáforo vs plan + flag de validez regulatoria |
| Firma | SHA-256 del payload canónico de la prueba |
| Export | PDF (print) + JSON firmado + historial JSON |
| Agregados | Tasa CVM, promedios, por día y por operador |

## Nodos propios

La app es también un **nodo de medición**:

- `GET  /api/measure/download?bytes=`
- `POST /api/measure/upload`
- `GET  /api/measure/echo`
- `GET  /api/measure/meta`

En **localhost** ese nodo solo calibra (loopback ≠ ISP). Para medir de verdad con tu infra:

1. Despliega la app en un VPS/datacenter (idealmente Perú).
2. Opcional: define más nodos en `.env`:

```env
NEXT_PUBLIC_EXTRA_SERVERS=[{"id":"lima-1","name":"Nodo Lima","region":"Lima, PE","baseUrl":"https://tu-nodo.example.com"}]
```

## Stack

- Next.js 15 + React 19 + TypeScript
- Motor en el cliente (`src/lib/measure.ts`)
- Historial en `localStorage` (v2)

## Limitaciones

- La firma es integridad SHA-256, no PKI con certificado de OSIPTEL
- Network Information API es best-effort en navegadores
- Aún no sustituye un procedimiento oficial de fiscalización
