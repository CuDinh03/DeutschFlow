import { useState } from "react";
import { motion } from "motion/react";
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { CompleteBauhausLogo } from "./logo-complete/CompleteBauhausLogo";
import { CompleteCircuitLogo } from "./logo-complete/CompleteCircuitLogo";
import { CompleteAngularLogo } from "./logo-complete/CompleteAngularLogo";

type LogoType = 'bauhaus' | 'circuit' | 'angular';
type LogoVariant = 'horizontal' | 'vertical' | 'icon-only';

const logos = [
  {
    id: 'bauhaus' as LogoType,
    name: 'Bauhaus Precision',
    description: 'Thiết kế Bauhaus chặt chẽ với grid hệ thống, thể hiện độ chính xác tuyệt đối.',
    usageContext: 'Phù hợp với: Landing page, Header, Professional contexts'
  },
  {
    id: 'circuit' as LogoType,
    name: 'System Circuit',
    description: 'Mạch logic hệ thống với AI nodes, thể hiện công nghệ và tư duy kết nối.',
    usageContext: 'Phù hợp với: App dashboard, Tech presentations, AI features'
  },
  {
    id: 'angular' as LogoType,
    name: 'Angular Breakthrough',
    description: 'Logo góc cạnh đột phá, thể hiện sự tiến bộ và vượt qua giới hạn.',
    usageContext: 'Phù hợp với: Marketing materials, Social media, Impact statements'
  }
];

export function CompleteLogoShowcase() {
  const [selectedLogo, setSelectedLogo] = useState<LogoType>('bauhaus');
  const [selectedVariant, setSelectedVariant] = useState<LogoVariant>('horizontal');
  const [animated, setAnimated] = useState(true);

  const renderLogo = (type: LogoType, variant: LogoVariant, size: number, animated: boolean) => {
    switch (type) {
      case 'bauhaus':
        return <CompleteBauhausLogo variant={variant} size={size} animated={animated} />;
      case 'circuit':
        return <CompleteCircuitLogo variant={variant} size={size} animated={animated} />;
      case 'angular':
        return <CompleteAngularLogo variant={variant} size={size} animated={animated} />;
    }
  };

  const selectedLogoData = logos.find(l => l.id === selectedLogo)!;

  return (
    <div className="w-full min-h-screen bg-gradient-to-br from-slate-50 via-stone-50 to-amber-50 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <Badge className="mb-4" variant="outline">Production Ready</Badge>
          <h1 className="mb-2 text-slate-900">myDeutschFlow</h1>
          <p className="text-slate-600 mb-4">
            Logo hoàn chỉnh với Icon + Typography - Sẵn sàng sử dụng
          </p>
          <div className="flex items-center justify-center gap-4 text-sm text-slate-500">
            <span>⚡ Đột phá</span>
            <span>•</span>
            <span>🎯 Chặt chẽ</span>
            <span>•</span>
            <span>⚙️ Hệ thống</span>
          </div>
        </div>

        {/* Main Preview Area */}
        <Card className="p-12 mb-8 backdrop-blur-xl bg-white/80 border-white/60 shadow-2xl">
          <div className="flex flex-col items-center">
            <Badge className="mb-6" variant="secondary">
              {selectedLogoData.name}
            </Badge>

            {/* Large Logo Preview */}
            <div className="mb-8 p-8 rounded-2xl bg-gradient-to-br from-white to-slate-50 border-2 border-slate-200 flex items-center justify-center min-h-[200px]">
              <motion.div
                key={`${selectedLogo}-${selectedVariant}-${animated}`}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3 }}
              >
                {renderLogo(selectedLogo, selectedVariant, 300, animated)}
              </motion.div>
            </div>

            {/* Variant Selector */}
            <div className="w-full max-w-2xl mb-6">
              <p className="text-sm text-slate-600 mb-3">Chọn biến thể:</p>
              <Tabs value={selectedVariant} onValueChange={(v) => setSelectedVariant(v as LogoVariant)}>
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="horizontal">Horizontal</TabsTrigger>
                  <TabsTrigger value="vertical">Vertical</TabsTrigger>
                  <TabsTrigger value="icon-only">Icon Only</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            {/* Animation Toggle */}
            <div className="flex items-center gap-2 mb-4">
              <input
                type="checkbox"
                id="animated"
                checked={animated}
                onChange={(e) => setAnimated(e.target.checked)}
                className="w-4 h-4"
              />
              <label htmlFor="animated" className="text-sm text-slate-600">
                Animation enabled
              </label>
            </div>

            {/* Usage Context */}
            <p className="text-sm text-slate-500 text-center max-w-lg">
              {selectedLogoData.usageContext}
            </p>
          </div>
        </Card>

        {/* Logo Selection Grid */}
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          {logos.map((logo) => (
            <motion.div
              key={logo.id}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <Card
                className={`p-6 cursor-pointer transition-all ${
                  selectedLogo === logo.id
                    ? 'bg-white border-black border-2 shadow-xl'
                    : 'bg-white/60 border-slate-200 hover:border-slate-400'
                }`}
                onClick={() => setSelectedLogo(logo.id)}
              >
                <div className="flex flex-col items-center text-center">
                  <div className="mb-4 p-4 rounded-lg bg-slate-50">
                    {renderLogo(logo.id, 'icon-only', 120, false)}
                  </div>
                  <h3 className="mb-2 text-slate-900">{logo.name}</h3>
                  <p className="text-sm text-slate-600">{logo.description}</p>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* All Variants Preview */}
        <Card className="p-8 mb-8 bg-white/80">
          <h3 className="mb-6 text-slate-900">Tất cả biến thể - {selectedLogoData.name}</h3>

          <div className="grid md:grid-cols-3 gap-8">
            {/* Horizontal */}
            <div className="flex flex-col items-center">
              <Badge className="mb-3" variant="outline">Horizontal</Badge>
              <div className="p-6 rounded-lg bg-slate-50 border border-slate-200 w-full flex items-center justify-center min-h-[120px]">
                {renderLogo(selectedLogo, 'horizontal', 280, false)}
              </div>
              <p className="text-xs text-slate-500 mt-2 text-center">
                Header, Navigation, Wide layouts
              </p>
            </div>

            {/* Vertical */}
            <div className="flex flex-col items-center">
              <Badge className="mb-3" variant="outline">Vertical</Badge>
              <div className="p-6 rounded-lg bg-slate-50 border border-slate-200 w-full flex items-center justify-center min-h-[120px]">
                {renderLogo(selectedLogo, 'vertical', 180, false)}
              </div>
              <p className="text-xs text-slate-500 mt-2 text-center">
                Sidebar, Mobile menu, Tall layouts
              </p>
            </div>

            {/* Icon Only */}
            <div className="flex flex-col items-center">
              <Badge className="mb-3" variant="outline">Icon Only</Badge>
              <div className="p-6 rounded-lg bg-slate-50 border border-slate-200 w-full flex items-center justify-center min-h-[120px]">
                {renderLogo(selectedLogo, 'icon-only', 180, false)}
              </div>
              <p className="text-xs text-slate-500 mt-2 text-center">
                Favicon, App icon, Small spaces
              </p>
            </div>
          </div>
        </Card>

        {/* Color Variations Preview */}
        <Card className="p-8 mb-8 bg-white/80">
          <h3 className="mb-6 text-slate-900">Logo trên nền khác nhau</h3>

          <div className="grid md:grid-cols-4 gap-4">
            {/* White Background */}
            <div className="flex flex-col">
              <Badge className="mb-2" variant="outline">White</Badge>
              <div className="p-6 rounded-lg bg-white border border-slate-200 flex items-center justify-center min-h-[100px]">
                {renderLogo(selectedLogo, 'icon-only', 120, false)}
              </div>
            </div>

            {/* Light Gray Background */}
            <div className="flex flex-col">
              <Badge className="mb-2" variant="outline">Light Gray</Badge>
              <div className="p-6 rounded-lg bg-slate-100 flex items-center justify-center min-h-[100px]">
                {renderLogo(selectedLogo, 'icon-only', 120, false)}
              </div>
            </div>

            {/* Dark Background */}
            <div className="flex flex-col">
              <Badge className="mb-2" variant="outline">Dark</Badge>
              <div className="p-6 rounded-lg bg-slate-800 flex items-center justify-center min-h-[100px]">
                <div className="filter invert">
                  {renderLogo(selectedLogo, 'icon-only', 120, false)}
                </div>
              </div>
            </div>

            {/* Black Background */}
            <div className="flex flex-col">
              <Badge className="mb-2" variant="outline">Black</Badge>
              <div className="p-6 rounded-lg bg-black flex items-center justify-center min-h-[100px]">
                <div className="filter invert">
                  {renderLogo(selectedLogo, 'icon-only', 120, false)}
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* Technical Specifications */}
        <Card className="p-8 bg-white/80">
          <h3 className="mb-6 text-slate-900">Thông số kỹ thuật</h3>

          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h4 className="mb-3 text-slate-800">Color Palette</h4>
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-lg bg-black border-2 border-white shadow" />
                  <div>
                    <p className="text-sm font-medium">#000000</p>
                    <p className="text-xs text-slate-500">Primary Black</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-lg bg-[#DA291C] border-2 border-white shadow" />
                  <div>
                    <p className="text-sm font-medium">#DA291C</p>
                    <p className="text-xs text-slate-500">Vietnam Red</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-lg bg-[#FFCD00] border-2 border-white shadow" />
                  <div>
                    <p className="text-sm font-medium">#FFCD00</p>
                    <p className="text-xs text-slate-500">Vietnam Gold</p>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <h4 className="mb-3 text-slate-800">Typography</h4>
              <div className="space-y-2 text-sm">
                <p><strong>Font Family:</strong> System UI / -apple-system / sans-serif</p>
                <p><strong>"my":</strong> Light (300) - 16px</p>
                <p><strong>"Deutsch":</strong> Bold (700) - 24px</p>
                <p><strong>"Flow":</strong> Bold (700) - 24px - Red</p>
                <p><strong>Tagline:</strong> Regular (400) - 9px - Gray</p>
              </div>

              <h4 className="mt-6 mb-3 text-slate-800">Export Formats</h4>
              <div className="flex gap-2 flex-wrap">
                <Badge variant="outline">SVG</Badge>
                <Badge variant="outline">PNG (Transparent)</Badge>
                <Badge variant="outline">React Component</Badge>
                <Badge variant="outline">Favicon</Badge>
              </div>
            </div>
          </div>
        </Card>

        {/* Action Buttons */}
        <div className="mt-8 flex justify-center gap-4">
          <Button size="lg" variant="outline">
            Download SVG Package
          </Button>
          <Button size="lg">
            Copy React Component
          </Button>
        </div>
      </div>
    </div>
  );
}
