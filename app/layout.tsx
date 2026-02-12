import './globals.css';
import 'leaflet/dist/leaflet.css';

export const metadata = {
  title: 'Situation Monitor',
  description: 'Live world map of recent events powered by GDELT.'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
