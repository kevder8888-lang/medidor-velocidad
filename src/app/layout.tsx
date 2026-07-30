import type { Metadata } from "next";
import { BRAND } from "@/lib/brand";
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
  ],
  openGraph: {
    title: `${BRAND.productName} · ${BRAND.name}`,
    description: BRAND.productSubtitle,
    locale: "es_PE",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
