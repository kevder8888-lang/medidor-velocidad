import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { BRAND } from "@/lib/brand";
import { DeviceClass } from "@/components/DeviceClass";
import "./globals.css";

export const metadata: Metadata = {
  title: `${BRAND.productName} · ${BRAND.name}`,
  description: `${BRAND.productSubtitle}. ${BRAND.fullName}.`,
  applicationName: `${BRAND.name} ${BRAND.productName}`,
  authors: [{ name: BRAND.name, url: BRAND.urls.institution }],
  keywords: [
    "OSIPTEL",
    "medidor de velocidad",
    "CVM",
    "velocidad mínima",
    "internet fija",
    "Perú",
    "Android",
  ],
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Medidor OSIPTEL",
  },
  formatDetection: {
    telephone: false,
    email: false,
    address: false,
  },
  openGraph: {
    title: `${BRAND.productName} · ${BRAND.name}`,
    description: BRAND.productSubtitle,
    locale: "es_PE",
    type: "website",
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#0056AC" },
    { media: "(prefers-color-scheme: dark)", color: "#003D7A" },
  ],
  colorScheme: "light",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body>
        {/* Honor: zoom global antes del paint en Medir/Mapa/Historial/Admin */}
        <Script
          id="honor-ui-scale"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var ua=navigator.userAgent||"";if(/XiaoMi|Xiaomi|Redmi|POCO|MIUI|HyperOS/i.test(ua))return;if(!/Honor|HONOR|Huawei|HUAWEI|HarmonyOS|MagicUI|MagicOS/i.test(ua))return;var s="0.75";try{var k=sessionStorage.getItem("osiptel-honor-ui-scale");if(k&&+k>=0.72&&+k<=0.95)s=k;}catch(e){}var r=document.documentElement;r.classList.add("is-honor");r.style.setProperty("--honor-ui-scale",s);r.style.zoom=s;}catch(e){}})();`,
          }}
        />
        <DeviceClass />
        {children}
      </body>
    </html>
  );
}
