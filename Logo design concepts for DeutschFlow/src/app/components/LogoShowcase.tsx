import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { FluidDLogo } from "./logo-concepts/FluidDLogo";
import { GlassBubbleLogo } from "./logo-concepts/GlassBubbleLogo";
import { InteractivePersonaLogo } from "./logo-concepts/PersonaMentorLogo";
import { RoadmapFlowLogo } from "./logo-concepts/RoadmapFlowLogo";
import { BauhausPrecisionLogo } from "./logo-concepts/BauhausPrecisionLogo";
import { CircuitSystemLogo } from "./logo-concepts/CircuitSystemLogo";
import { ModularGridLogo } from "./logo-concepts/ModularGridLogo";
import { AngularBreakthroughLogo } from "./logo-concepts/AngularBreakthroughLogo";

type LogoConcept = 'fluid' | 'bubble' | 'persona' | 'roadmap' | 'bauhaus' | 'circuit' | 'modular' | 'angular';

const concepts = [
  {
    id: 'fluid' as LogoConcept,
    name: 'Dòng chảy Ngôn ngữ',
    subtitle: 'The Fluid D',
    description: 'Chữ "D" uốn lượn với sao vàng Việt Nam và gradient Đỏ-Vàng-Xanh, thể hiện cầu nối văn hóa.',
    color: 'from-red-600 via-yellow-500 to-indigo-600',
    category: 'cultural'
  },
  {
    id: 'bubble' as LogoConcept,
    name: 'Bong bóng Việt-Đức',
    subtitle: 'The Glass Bubble',
    description: 'Bong bóng hội thoại kết hợp cờ Việt Nam (đỏ-sao vàng) và cờ Đức (đen-đỏ-vàng).',
    color: 'from-red-600 via-yellow-500 to-indigo-500',
    category: 'cultural'
  },
  {
    id: 'persona' as LogoConcept,
    name: 'Persona đa sắc',
    subtitle: 'The Cultural Mentors',
    description: 'Logo đổi màu theo Persona với màu sắc Việt Nam (Đỏ cho Klaus, Vàng cho Hanna).',
    color: 'from-yellow-500 to-red-600',
    category: 'cultural'
  },
  {
    id: 'roadmap' as LogoConcept,
    name: 'Lộ trình Vươn cao',
    subtitle: 'The Roadmap Flow',
    description: 'Mũi tên hướng lên với họa tiết Việt Nam và sao vàng, tượng trưng sự phát triển.',
    color: 'from-red-600 via-yellow-500 to-indigo-600',
    category: 'cultural'
  },
  {
    id: 'bauhaus' as LogoConcept,
    name: 'Bauhaus Chặt chẽ',
    subtitle: 'Precision Engineering',
    description: 'Thiết kế Bauhaus góc cạnh với grid chặt chẽ, thể hiện độ chính xác của tiếng Đức.',
    color: 'from-black via-red-600 to-yellow-500',
    category: 'engineering'
  },
  {
    id: 'circuit' as LogoConcept,
    name: 'Mạch Logic Hệ thống',
    subtitle: 'System Circuit',
    description: 'Mạch điện tử với nodes logic, thể hiện tư duy hệ thống và công nghệ AI.',
    color: 'from-red-600 to-yellow-500',
    category: 'engineering'
  },
  {
    id: 'modular' as LogoConcept,
    name: 'Module Chặt chẽ',
    subtitle: 'Modular Grid',
    description: 'Hệ thống module grid 5x5 chặt chẽ, thể hiện cấu trúc logic và tính hệ thống.',
    color: 'from-black via-red-600 to-yellow-500',
    category: 'engineering'
  },
  {
    id: 'angular' as LogoConcept,
    name: 'Đột phá Góc cạnh',
    subtitle: 'Angular Breakthrough',
    description: 'Logo góc cạnh sắc bén với các mảnh vỡ bay ra, thể hiện sự đột phá mạnh mẽ.',
    color: 'from-black via-red-600 to-yellow-400',
    category: 'engineering'
  }
];

export function LogoShowcase() {
  const [selected, setSelected] = useState<LogoConcept>('bauhaus');

  const renderLogo = (concept: LogoConcept, size: number) => {
    switch (concept) {
      case 'fluid':
        return <FluidDLogo size={size} />;
      case 'bubble':
        return <GlassBubbleLogo size={size} />;
      case 'persona':
        return <InteractivePersonaLogo size={size} />;
      case 'roadmap':
        return <RoadmapFlowLogo size={size} />;
      case 'bauhaus':
        return <BauhausPrecisionLogo size={size} />;
      case 'circuit':
        return <CircuitSystemLogo size={size} />;
      case 'modular':
        return <ModularGridLogo size={size} />;
      case 'angular':
        return <AngularBreakthroughLogo size={size} />;
    }
  };

  const selectedConcept = concepts.find(c => c.id === selected)!;

  return (
    <div className="w-full min-h-screen bg-gradient-to-br from-red-50 via-yellow-50 to-indigo-50 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="mb-2 text-slate-900">DeutschFlow Logo Concepts</h1>
          <div className="flex items-center justify-center gap-2 mb-2">
            <span className="text-2xl">🇻🇳</span>
            <span className="text-slate-400">×</span>
            <span className="text-2xl">🇩🇪</span>
          </div>
          <p className="text-slate-600">
            Kết hợp văn hóa Việt-Đức trong thiết kế hiện đại
          </p>
        </div>

        {/* Main showcase area */}
        <div className="grid lg:grid-cols-2 gap-8 mb-12">
          {/* Large preview */}
          <Card className="p-8 backdrop-blur-xl bg-white/70 border-white/40 shadow-2xl">
            <div className="flex flex-col items-center">
              <Badge className="mb-4" variant="secondary">
                {selectedConcept.subtitle}
              </Badge>

              <AnimatePresence mode="wait">
                <motion.div
                  key={selected}
                  initial={{ opacity: 0, scale: 0.8, rotate: -10 }}
                  animate={{ opacity: 1, scale: 1, rotate: 0 }}
                  exit={{ opacity: 0, scale: 0.8, rotate: 10 }}
                  transition={{ duration: 0.5 }}
                  className="mb-6"
                >
                  {renderLogo(selected, 240)}
                </motion.div>
              </AnimatePresence>

              <h2 className="mb-2 text-slate-900">
                {selectedConcept.name}
              </h2>
              <p className="text-center text-slate-600 max-w-md">
                {selectedConcept.description}
              </p>
            </div>
          </Card>

          {/* Info & Style Guide */}
          <Card className="p-8 backdrop-blur-xl bg-white/70 border-white/40 shadow-xl">
            <h3 className="mb-4 text-slate-900">Style Guide</h3>

            <div className="space-y-4">
              <div>
                <p className="mb-2 text-slate-500">Phong cách thiết kế</p>
                <Badge variant="outline">Flat Geometric + Glassmorphism</Badge>
              </div>

              <div>
                <p className="mb-2 text-slate-500">Typography</p>
                <div className="flex gap-2 flex-wrap">
                  <Badge variant="outline">Inter</Badge>
                  <Badge variant="outline">Montserrat</Badge>
                  <Badge variant="outline">Gilroy</Badge>
                </div>
              </div>

              <div>
                <p className="mb-2 text-slate-500">Color Palette (Việt-Đức)</p>
                <div className="flex gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-[#DA291C] border-2 border-white shadow" />
                    <span className="text-sm text-slate-600">Đỏ VN</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-[#FFCD00] border-2 border-white shadow" />
                    <span className="text-sm text-slate-600">Vàng VN</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-indigo-600 border-2 border-white shadow" />
                    <span className="text-sm text-slate-600">Xanh Đức</span>
                  </div>
                </div>
              </div>

              <div>
                <p className="mb-2 text-slate-500">Hiệu ứng</p>
                <div className="p-4 rounded-lg backdrop-blur-md bg-white/40 border border-white/60">
                  <code className="text-sm text-slate-700">backdrop-filter: blur(10px)</code>
                </div>
              </div>

              <div>
                <p className="mb-2 text-slate-500">Yếu tố cốt lõi</p>
                <div className="flex gap-2 flex-wrap">
                  {selectedConcept.category === 'cultural' ? (
                    <>
                      <Badge>🇻🇳 Vietnam</Badge>
                      <Badge>🇩🇪 Germany</Badge>
                      <Badge>⭐ Sao Vàng</Badge>
                      <Badge>💧 Flow</Badge>
                    </>
                  ) : (
                    <>
                      <Badge variant="outline">⚡ Đột phá</Badge>
                      <Badge variant="outline">🎯 Chặt chẽ</Badge>
                      <Badge variant="outline">⚙️ Logic</Badge>
                      <Badge variant="outline">🔧 Hệ thống</Badge>
                    </>
                  )}
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* Category sections */}
        <div className="space-y-8">
          {/* Cultural Designs */}
          <div>
            <h3 className="mb-4 text-slate-900 flex items-center gap-2">
              <span>🇻🇳🇩🇪</span> Thiết kế Văn hóa
            </h3>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {concepts.filter(c => c.category === 'cultural').map((concept) => (
                <motion.div
                  key={concept.id}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Card
                    className={`p-6 cursor-pointer transition-all backdrop-blur-md ${
                      selected === concept.id
                        ? 'bg-white/90 border-red-600 border-2 shadow-xl'
                        : 'bg-white/60 border-white/40 hover:bg-white/75'
                    }`}
                    onClick={() => setSelected(concept.id)}
                  >
                    <div className="flex flex-col items-center text-center">
                      <div className="mb-3">
                        {renderLogo(concept.id, 80)}
                      </div>
                      <h4 className="mb-1 text-slate-900">
                        {concept.name}
                      </h4>
                      <p className="text-sm text-slate-500">
                        {concept.subtitle}
                      </p>
                    </div>
                  </Card>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Engineering Designs */}
          <div>
            <h3 className="mb-4 text-slate-900 flex items-center gap-2">
              <span>⚙️</span> Thiết kế Kỹ thuật - Logic & Đột phá
            </h3>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {concepts.filter(c => c.category === 'engineering').map((concept) => (
                <motion.div
                  key={concept.id}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Card
                    className={`p-6 cursor-pointer transition-all backdrop-blur-md ${
                      selected === concept.id
                        ? 'bg-white/90 border-black border-2 shadow-xl'
                        : 'bg-white/60 border-white/40 hover:bg-white/75'
                    }`}
                    onClick={() => setSelected(concept.id)}
                  >
                    <div className="flex flex-col items-center text-center">
                      <div className="mb-3">
                        {renderLogo(concept.id, 80)}
                      </div>
                      <h4 className="mb-1 text-slate-900">
                        {concept.name}
                      </h4>
                      <p className="text-sm text-slate-500">
                        {concept.subtitle}
                      </p>
                    </div>
                  </Card>
                </motion.div>
              ))}
            </div>
          </div>
        </div>

        {/* Export options */}
        <Card className="mt-8 p-6 backdrop-blur-md bg-white/70 border-white/40">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h4 className="mb-1 text-slate-900">Sẵn sàng xuất file?</h4>
              <p className="text-sm text-slate-600">
                Chọn concept yêu thích và xuất ra SVG, PNG hoặc tích hợp vào code
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline">Xuất SVG</Button>
              <Button>Tích hợp vào App</Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
