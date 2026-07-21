import { readFile } from "fs/promises";
import path from "path";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Theile Riordan — Implementation Manager, Inteum",
  description:
    "Theile Riordan — Implementation Manager at Inteum Company, leading Minuet implementation and onboarding for universities, research institutions, and technology transfer offices.",
};

/**
 * Serve the personal portfolio HTML at `/` (same design as the former static index.html).
 */
export default async function PortfolioHome() {
  const filePath = path.join(process.cwd(), "content", "portfolio.html");
  const html = await readFile(filePath, "utf8");

  const styleMatch = html.match(/<style[^>]*>([\s\S]*?)<\/style>/i);
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  const fontLinks = [
    ...html.matchAll(
      /<link[^>]+href="(https:\/\/fonts\.(?:googleapis|gstatic)\.com[^"]+)"[^>]*>/gi
    ),
  ].map((m) => m[1]);

  const styles = styleMatch?.[1] ?? "";
  const body = bodyMatch?.[1] ?? "<p>Portfolio content missing.</p>";

  return (
    <>
      {fontLinks.includes("https://fonts.googleapis.com") ? null : (
        <>
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link
            rel="preconnect"
            href="https://fonts.gstatic.com"
            crossOrigin="anonymous"
          />
        </>
      )}
      <link
        href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&family=Inter:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap"
        rel="stylesheet"
      />
      <style dangerouslySetInnerHTML={{ __html: styles }} />
      <div dangerouslySetInnerHTML={{ __html: body }} />
    </>
  );
}
