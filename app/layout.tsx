import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "BIAI · Smart CRM",
  description:
    "A thoughtful workspace for enquiries, AI-assisted replies and sales follow-up.",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{document.documentElement.dataset.theme=localStorage.getItem('biai-theme')==='dark'?'dark':'light'}catch(e){document.documentElement.dataset.theme='light'}})();`,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
