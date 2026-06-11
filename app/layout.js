import "./globals.css";
import { Fraunces, Outfit } from 'next/font/google';
import { AuthProvider } from './AuthProvider';

// Outfit carries all UI text and the board digits (clean geometric sans,
// tabular-friendly); Fraunces is reserved for display moments — the wordmark
// and the win overlay title.
const outfit = Outfit({ subsets: ['latin'], variable: '--font-ui', display: 'swap' });
const fraunces = Fraunces({ subsets: ['latin'], variable: '--font-display', display: 'swap' });

export const metadata = {
  title: "Sudoku Cloud",
  description: "a sudoku playground",
};

// Runs before paint: if a valid saved theme exists, set data-theme so the
// correct palette applies immediately (no flash). Otherwise leave it unset so
// prefers-color-scheme decides. Mirrors resolveStoredTheme in app/lib/theme.js.
const themeScript = `(function(){try{var t=localStorage.getItem('sudoku-cloud:theme');if(t==='light'||t==='dark'){document.documentElement.dataset.theme=t;}}catch(e){}})();`;

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className={`${outfit.variable} ${fraunces.variable}`}>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
