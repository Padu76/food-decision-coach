import "@/styles/globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Food Decision Coach — Scegli cosa mangiare in pochi secondi",
  description:
    "Assistente decisionale AI per il cibo: analizza menu del ristorante o confronta prodotti al supermercato. Un consiglio chiaro in pochi secondi.",
  metadataBase: new URL("https://food-decision-coach.vercel.app"),
  openGraph: {
    title: "Food Decision Coach — Scegli cosa mangiare in pochi secondi",
    description:
      "Ti aiuta a scegliere il piatto giusto al ristorante o il prodotto migliore al supermercato. Analisi AI istantanea.",
    locale: "it_IT",
    type: "website",
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
