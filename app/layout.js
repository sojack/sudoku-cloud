import "./globals.css";

export const metadata = {
  title: "Sudoku Cloud",
  description: "a sudoku playground",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  );
}
