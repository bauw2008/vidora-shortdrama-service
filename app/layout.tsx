import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Vidora 短剧管理后台',
  description: '短剧中转服务管理后台',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang='zh-CN'>
      <body className='antialiased'>{children}</body>
    </html>
  );
}
