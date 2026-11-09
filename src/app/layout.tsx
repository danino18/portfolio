import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Syne } from "next/font/google";
import "./globals.css";
import { site, siteUrl } from "@/content/site";
import { activeLocale } from "@/content/locale";
import SmoothScroll from "@/components/shell/SmoothScroll";
import Cursor from "@/components/shell/Cursor";
import Nav from "@/components/shell/Nav";
import Pipeline from "@/components/shell/Pipeline";
import { PageTransitionProvider } from "@/components/shell/PageTransition";

const syne = Syne({ subsets: ["latin"], variable: "--font-syne", weight: ["600", "700", "800"], display: "swap" });
const geist = Geist({ subsets: ["latin"], variable: "--font-geist", display: "swap" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: site.title, template: `%s — ${site.name}` },
  description: site.description,
  applicationName: `${site.name} — Portfolio`,
  authors: [{ name: site.name, url: site.links.linkedin }],
  creator: site.name,
  keywords: ["Eyal Danino", "Technion", "Computer Engineering", "CUDA", "GPU computing", "FPGA", "SystemVerilog", "ROS 2", "robotics", "physical AI", "portfolio"],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: `${site.name} — Portfolio`,
    title: site.title,
    description: site.description,
    url: "/",
    locale: "en_US",
  },
  twitter: { card: "summary_large_image", title: site.title, description: site.description },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#05060a",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "Person",
  name: site.name,
  jobTitle: "Computer Engineering Student",
  affiliation: { "@type": "CollegeOrUniversity", name: "Technion — Israel Institute of Technology" },
  url: siteUrl,
  sameAs: [site.links.github, site.links.linkedin],
  knowsAbout: ["GPU computing", "CUDA", "FPGA", "Computer architecture", "Robotics", "ROS 2"],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang={activeLocale.lang} dir={activeLocale.dir} className={`${syne.variable} ${geist.variable} ${geistMono.variable}`}>
      <body>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
        <a href="#main" className="skip-link">
          Skip to content
        </a>
        <SmoothScroll>
          <PageTransitionProvider>
            <Nav />
            <Pipeline />
            <main id="main">{children}</main>
          </PageTransitionProvider>
          <Cursor />
        </SmoothScroll>
        <div aria-hidden className="grain" />
        <div aria-hidden className="vignette" />
      </body>
    </html>
  );
}
