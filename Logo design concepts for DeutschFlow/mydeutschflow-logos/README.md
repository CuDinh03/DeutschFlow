# myDeutschFlow Logo Package

Package chứa 3 logo production-ready cho myDeutschFlow với đầy đủ variants và documentation.

## 📦 Nội dung Package

### Logo Components
1. **CompleteBauhausLogo** - Bauhaus Precision Engineering
2. **CompleteCircuitLogo** - System Circuit 
3. **CompleteAngularLogo** - Angular Breakthrough

Mỗi logo có 3 variants:
- `horizontal` - Cho header, navigation, wide layouts
- `vertical` - Cho sidebar, mobile menu, tall layouts  
- `icon-only` - Cho favicon, app icon, small spaces

## 🚀 Cài đặt

### Dependencies
```bash
npm install motion
# hoặc
pnpm add motion
```

### Import Components
```tsx
import { CompleteBauhausLogo } from './logo-complete/CompleteBauhausLogo';
import { CompleteCircuitLogo } from './logo-complete/CompleteCircuitLogo';
import { CompleteAngularLogo } from './logo-complete/CompleteAngularLogo';
```

## 💡 Sử dụng

### Basic Usage
```tsx
import { CompleteBauhausLogo } from './logo-complete/CompleteBauhausLogo';

function Header() {
  return (
    <div>
      <CompleteBauhausLogo 
        variant="horizontal" 
        size={200}
        animated={true}
      />
    </div>
  );
}
```

### Props Interface
```typescript
interface LogoProps {
  variant?: 'horizontal' | 'vertical' | 'icon-only';
  size?: number;           // Default: 200
  className?: string;      
  animated?: boolean;      // Default: true
}
```

### Variants Examples

#### Horizontal (Header)
```tsx
<CompleteBauhausLogo 
  variant="horizontal" 
  size={300}
  animated={false}
/>
```

#### Vertical (Sidebar)
```tsx
<CompleteBauhausLogo 
  variant="vertical" 
  size={180}
/>
```

#### Icon Only (Favicon)
```tsx
<CompleteBauhausLogo 
  variant="icon-only" 
  size={64}
  animated={false}
/>
```

## 🎨 Design Specifications

### Color Palette
- **Primary Black**: `#000000`
- **Vietnam Red**: `#DA291C`
- **Vietnam Gold**: `#FFCD00`

### Typography
- **"my"**: Light (300), 16px
- **"Deutsch"**: Bold (700), 24px, Black
- **"Flow"**: Bold (700), 24px, Red (#DA291C)
- **Tagline**: Regular (400), 9px, Gray (#666666)

### Font Stack
```css
font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
```

## 📐 Size Guidelines

### Horizontal Variant
- **Minimum**: 200px width
- **Recommended**: 300-400px width
- **Maximum**: 600px width

### Vertical Variant
- **Minimum**: 100px width
- **Recommended**: 150-200px width
- **Maximum**: 300px width

### Icon Only
- **Favicon**: 32px, 64px
- **App Icon**: 128px, 256px, 512px
- **Social Media**: 400px, 800px

## 🎯 Use Cases

### 1. Bauhaus Precision
```tsx
<CompleteBauhausLogo variant="horizontal" size={300} />
```
**Best for**: 
- Landing pages
- Professional presentations
- Documentation headers
- Corporate communications

**Tagline**: "GERMAN LANGUAGE LEARNING SYSTEM"

### 2. System Circuit
```tsx
<CompleteCircuitLogo variant="horizontal" size={300} />
```
**Best for**:
- App dashboards
- Tech features
- AI/ML sections
- Developer documentation

**Tagline**: "AI-POWERED LANGUAGE PLATFORM"

### 3. Angular Breakthrough
```tsx
<CompleteAngularLogo variant="horizontal" size={300} />
```
**Best for**:
- Marketing materials
- Social media
- Campaign headers
- Impact statements

**Tagline**: "BREAKTHROUGH LEARNING EXPERIENCE"

## 🌓 Dark Mode Support

Cho nền tối, sử dụng CSS filter:
```tsx
<div className="dark:invert">
  <CompleteBauhausLogo 
    variant="icon-only" 
    size={64}
  />
</div>
```

Hoặc trong CSS:
```css
.dark .logo {
  filter: invert(1);
}
```

## 📱 Responsive Usage

```tsx
function ResponsiveLogo() {
  const isMobile = window.innerWidth < 768;
  
  return (
    <CompleteBauhausLogo 
      variant={isMobile ? 'vertical' : 'horizontal'}
      size={isMobile ? 150 : 300}
    />
  );
}
```

## ⚡ Performance Tips

1. **Disable animation for static displays**:
```tsx
<CompleteBauhausLogo animated={false} />
```

2. **Use icon-only for small spaces**:
```tsx
<CompleteBauhausLogo variant="icon-only" size={48} animated={false} />
```

3. **Preload for hero sections**:
```tsx
// Animation plays once on mount
<CompleteBauhausLogo animated={true} />
```

## 📄 Export Formats

Ngoài React components, logos có thể export sang:
- SVG files (scalable, editable)
- PNG (với transparent background)
- Favicon formats (.ico, multiple sizes)
- Social media formats (OG images, Twitter cards)

## 🎓 Design Philosophy

Logo myDeutschFlow thể hiện:
- ⚡ **Đột phá** - Breakthrough innovation
- 🎯 **Chặt chẽ** - German precision
- ⚙️ **Logic** - Systematic thinking
- 🔧 **Hệ thống** - Engineered approach

Kết hợp văn hóa Việt Nam (Đỏ #DA291C, Vàng #FFCD00) với tính kỹ thuật của Đức.

## 📞 Support

Đối với câu hỏi về sử dụng hoặc customization, tham khảo:
- Component source code trong `/logo-complete/`
- Demo showcase trong `CompleteLogoShowcase.tsx`

---

**Version**: 1.0.0  
**Last Updated**: May 6, 2026  
**License**: Proprietary - myDeutschFlow DATN Project
