import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

const title = "RINGWERK — Deutsch unter Druck";
const description =
  "Бодрая 2D-игра: отвечай на немецкие тесты, управляй вращающимися кольцами и активируй три терминала.";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = (
    requestHeaders.get("x-forwarded-host") ??
    requestHeaders.get("host") ??
    "localhost:3000"
  )
    .split(",")[0]
    .trim();
  const forwardedProtocol = requestHeaders
    .get("x-forwarded-proto")
    ?.split(",")[0]
    .trim();
  const protocol =
    forwardedProtocol === "http" || forwardedProtocol === "https"
      ? forwardedProtocol
      : host.startsWith("localhost")
        ? "http"
        : "https";
  const metadataBase = new URL(`${protocol}://${host}`);
  const socialImage = new URL("/og.webp", metadataBase);

  return {
    metadataBase,
    title,
    description,
    openGraph: {
      type: "website",
      locale: "ru_RU",
      url: metadataBase,
      title,
      description,
      images: [{ url: socialImage, width: 512, height: 341, alt: title }],
    },
    twitter: { card: "summary_large_image", title, description, images: [socialImage] },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
