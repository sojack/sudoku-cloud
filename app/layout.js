import "./globals.css";

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
      <body>
        {children}
      </body>
    </html>
  );
}
