import Link from 'next/link';

import './globals.css';

export const metadata = {
  title: 'Open Tune',
  description: 'Open Tune - your music player app',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <header
          className="site-header"
          style={{ backdropFilter: 'blur(20px) saturate(150%)' }}
        >
          <Link href="/" className="site-title">
            <span className="brand-mark" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none">
                <path
                  d="M9 18V5l12-2v13"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <circle cx="6" cy="18" r="3" fill="currentColor" />
                <circle cx="18" cy="16" r="3" fill="currentColor" />
                <path d="m9 9 12-2" stroke="currentColor" strokeWidth="1.8" />
              </svg>
            </span>
            <span>Open Tune</span>
          </Link>
          <nav>
            <Link href="/login">Log In</Link>
            <Link href="/signup">Sign Up</Link>
          </nav>
        </header>
        <main>{children}</main>
        <footer>
          <p>Open Tune &mdash; the Open Tune music player.</p>
        </footer>
      </body>
    </html>
  );
}
