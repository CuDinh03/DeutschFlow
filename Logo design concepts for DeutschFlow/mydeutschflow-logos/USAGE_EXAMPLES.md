# myDeutschFlow Logo - Usage Examples

## 📚 Table of Contents
- [Header Navigation](#header-navigation)
- [Sidebar](#sidebar)
- [Favicon](#favicon)
- [Loading Screen](#loading-screen)
- [Footer](#footer)
- [Email Signature](#email-signature)

---

## Header Navigation

### Desktop Header
```tsx
import { CompleteBauhausLogo } from './mydeutschflow-logos';

function Header() {
  return (
    <header className="flex items-center justify-between px-8 py-4 bg-white border-b">
      <CompleteBauhausLogo 
        variant="horizontal" 
        size={280}
        animated={false}
      />
      <nav>
        {/* Navigation items */}
      </nav>
    </header>
  );
}
```

### Mobile Header
```tsx
import { CompleteBauhausLogo } from './mydeutschflow-logos';

function MobileHeader() {
  return (
    <header className="flex items-center justify-between px-4 py-3 bg-white">
      <CompleteBauhausLogo 
        variant="icon-only" 
        size={40}
        animated={false}
      />
      <button>Menu</button>
    </header>
  );
}
```

---

## Sidebar

### Vertical Sidebar Logo
```tsx
import { CompleteCircuitLogo } from './mydeutschflow-logos';

function Sidebar() {
  return (
    <aside className="w-64 h-screen bg-slate-50 p-6">
      <div className="mb-8">
        <CompleteCircuitLogo 
          variant="vertical" 
          size={180}
          animated={false}
        />
      </div>
      
      <nav className="space-y-2">
        {/* Sidebar navigation */}
      </nav>
    </aside>
  );
}
```

---

## Favicon

### Generate Favicon
```tsx
import { CompleteBauhausLogo } from './mydeutschflow-logos';

function FaviconGenerator() {
  return (
    <div className="bg-white p-4">
      {/* 16x16 */}
      <CompleteBauhausLogo 
        variant="icon-only" 
        size={16}
        animated={false}
      />
      
      {/* 32x32 */}
      <CompleteBauhausLogo 
        variant="icon-only" 
        size={32}
        animated={false}
      />
      
      {/* 64x64 */}
      <CompleteBauhausLogo 
        variant="icon-only" 
        size={64}
        animated={false}
      />
    </div>
  );
}
```

### HTML Head
```html
<head>
  <link rel="icon" type="image/svg+xml" href="/favicon.svg">
  <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">
  <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">
</head>
```

---

## Loading Screen

### Animated Loading
```tsx
import { CompleteAngularLogo } from './mydeutschflow-logos';
import { useEffect, useState } from 'react';

function LoadingScreen() {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simulate loading
    setTimeout(() => setLoading(false), 2000);
  }, []);

  if (!loading) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-white z-50">
      <CompleteAngularLogo 
        variant="vertical" 
        size={200}
        animated={true}
      />
    </div>
  );
}
```

---

## Footer

### Full Footer
```tsx
import { CompleteBauhausLogo } from './mydeutschflow-logos';

function Footer() {
  return (
    <footer className="bg-slate-900 text-white py-12">
      <div className="container mx-auto px-8">
        <div className="grid grid-cols-4 gap-8">
          {/* Logo Column */}
          <div>
            <div className="invert mb-4">
              <CompleteBauhausLogo 
                variant="vertical" 
                size={150}
                animated={false}
              />
            </div>
            <p className="text-sm text-slate-400">
              German Language Learning System
            </p>
          </div>

          {/* Links Columns */}
          <div>
            <h3 className="font-bold mb-4">Product</h3>
            {/* Links */}
          </div>
          
          {/* More columns... */}
        </div>
      </div>
    </footer>
  );
}
```

---

## Email Signature

### HTML Email Signature
```html
<table style="font-family: sans-serif;">
  <tr>
    <td style="padding-right: 20px;">
      <!-- Use icon-only variant as image -->
      <img 
        src="https://yourdomain.com/logo-icon.png" 
        width="60" 
        height="60" 
        alt="myDeutschFlow"
      />
    </td>
    <td>
      <div style="font-size: 16px; font-weight: bold; color: #000;">
        Your Name
      </div>
      <div style="font-size: 14px; color: #DA291C;">
        myDeutschFlow Team
      </div>
      <div style="font-size: 12px; color: #666; margin-top: 4px;">
        email@mydeutschflow.com
      </div>
    </td>
  </tr>
</table>
```

---

## Auth Pages

### Login Page
```tsx
import { CompleteBauhausLogo } from './mydeutschflow-logos';

function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <CompleteBauhausLogo 
            variant="horizontal" 
            size={300}
            animated={true}
          />
        </div>
        
        <div className="bg-white p-8 rounded-lg shadow-lg">
          <h2 className="text-2xl font-bold mb-6">Đăng nhập</h2>
          {/* Login form */}
        </div>
      </div>
    </div>
  );
}
```

---

## Dashboard

### Dashboard Header
```tsx
import { CompleteCircuitLogo } from './mydeutschflow-logos';

function DashboardHeader() {
  return (
    <div className="flex items-center justify-between p-6 bg-white border-b">
      <div className="flex items-center gap-4">
        <CompleteCircuitLogo 
          variant="icon-only" 
          size={48}
          animated={false}
        />
        <div>
          <h1 className="text-xl font-bold">Dashboard</h1>
          <p className="text-sm text-slate-600">Welcome back!</p>
        </div>
      </div>
      
      {/* User menu */}
    </div>
  );
}
```

---

## Marketing Landing Page

### Hero Section
```tsx
import { CompleteAngularLogo } from './mydeutschflow-logos';

function HeroSection() {
  return (
    <section className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-amber-50">
      <div className="text-center">
        <div className="mb-8">
          <CompleteAngularLogo 
            variant="horizontal" 
            size={400}
            animated={true}
          />
        </div>
        
        <h1 className="text-5xl font-bold mb-4">
          Master German with AI
        </h1>
        <p className="text-xl text-slate-600 mb-8">
          Breakthrough learning experience powered by intelligent technology
        </p>
        
        <button className="px-8 py-4 bg-red-600 text-white rounded-lg text-lg font-bold hover:bg-red-700">
          Start Learning Now
        </button>
      </div>
    </section>
  );
}
```

---

## Responsive Logo Hook

```tsx
import { useState, useEffect } from 'react';
import { CompleteBauhausLogo } from './mydeutschflow-logos';

function useResponsiveLogo() {
  const [variant, setVariant] = useState<'horizontal' | 'vertical' | 'icon-only'>('horizontal');
  const [size, setSize] = useState(300);

  useEffect(() => {
    function handleResize() {
      const width = window.innerWidth;
      
      if (width < 640) {
        // Mobile
        setVariant('icon-only');
        setSize(40);
      } else if (width < 1024) {
        // Tablet
        setVariant('horizontal');
        setSize(200);
      } else {
        // Desktop
        setVariant('horizontal');
        setSize(300);
      }
    }

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return { variant, size };
}

// Usage
function ResponsiveHeader() {
  const { variant, size } = useResponsiveLogo();
  
  return (
    <header className="p-4">
      <CompleteBauhausLogo 
        variant={variant}
        size={size}
        animated={false}
      />
    </header>
  );
}
```

---

## Social Media Previews

### Open Graph Image
```tsx
import { CompleteBauhausLogo } from './mydeutschflow-logos';

function OGImageGenerator() {
  return (
    <div className="w-[1200px] h-[630px] bg-gradient-to-br from-white to-slate-100 flex items-center justify-center">
      <CompleteBauhausLogo 
        variant="horizontal" 
        size={600}
        animated={false}
      />
    </div>
  );
}
```

### Meta Tags
```html
<meta property="og:image" content="https://yourdomain.com/og-image.png" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:image" content="https://yourdomain.com/twitter-card.png" />
```
