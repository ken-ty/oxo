import './globals.css';
import Script from 'next/script';

export const metadata = {
  title: 'OXO Game',
  description: 'OXO - オンライン対戦ボードゲーム',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <head />
      <body>
        {children}
        
        {/* Firebase SDK */}
        <Script src="https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js" strategy="beforeInteractive" />
        <Script src="https://www.gstatic.com/firebasejs/9.22.0/firebase-database-compat.js" strategy="beforeInteractive" />
      </body>
    </html>
  );
}
