'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { ArrowLeft, Clock, ExternalLink, Loader2, Newspaper, Search, AlertTriangle, RefreshCw } from 'lucide-react'
import { DeutschFlowLogo } from '@/components/ui/DeutschFlowLogo'
import api from '@/lib/api'
import { getAccessToken } from '@/lib/authSession'

interface NewsItem {
  title: string;
  summary: string;
  url: string;
  publishedAt: string;
  sourceName: string;
  sourceType: 'DW_LEARN' | 'DW_VI' | 'TAGESSCHAU' | 'SPIEGEL';
}

export default function NewsPage() {
  const router = useRouter()
  const [mounted, setMounted] = useState(false)
  const [loading, setLoading] = useState(true)
  const [news, setNews] = useState<NewsItem[]>([])
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    setMounted(true)
    if (!getAccessToken()) {
      router.replace('/login?next=/news')
    } else {
      fetchNews()
    }
  }, [router])

  const fetchNews = async () => {
    setLoading(true)
    setError(null)
    try {
      const { data } = await api.get('/news')
      setNews(data)
      setLoading(false)
    } catch (err) {
      setError('Không thể tải tin tức. Vui lòng thử lại sau.')
      setLoading(false)
    }
  }

  const getSourceColor = (type: string) => {
    switch (type) {
      case 'DW_LEARN': return 'bg-blue-100 text-blue-700'
      case 'TAGESSCHAU': return 'bg-indigo-100 text-indigo-700'
      case 'SPIEGEL': return 'bg-orange-100 text-orange-700'
      case 'DW_VI': return 'bg-emerald-100 text-emerald-700'
      default: return 'bg-gray-100 text-gray-700'
    }
  }

  const filteredNews = news.filter(item => 
    item.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
    item.summary.toLowerCase().includes(searchQuery.toLowerCase())
  )

  if (!mounted) return null

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="w-10 h-10 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-600 transition-colors">
              <ArrowLeft size={20} />
            </Link>
            <DeutschFlowLogo variant="horizontal" size={130} animated={false} />
          </div>
          <Link href="/dashboard" className="text-sm font-bold text-gray-600 hover:text-gray-900">
            Về Dashboard
          </Link>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-extrabold text-gray-900 flex items-center gap-3">
            <Newspaper className="text-blue-600" /> Tin tức & Đời sống Đức
          </h1>
          <p className="text-gray-500 mt-2">Cập nhật tin tức hàng ngày từ các nguồn báo chí uy tín của Đức.</p>
        </div>

        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row gap-4 mb-8">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Tìm kiếm bài báo..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white border border-gray-200 rounded-xl py-3 pl-11 pr-4 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
            />
          </div>
          <button 
            onClick={fetchNews}
            className="flex items-center justify-center gap-2 px-6 py-3 bg-white border border-gray-200 rounded-xl font-medium text-gray-700 hover:bg-gray-50 hover:text-gray-900 transition-colors"
          >
            <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
            Làm mới
          </button>
        </div>

        {/* Content Area */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <Loader2 size={32} className="animate-spin text-blue-600" />
            <p className="text-gray-500 font-medium">Đang tổng hợp tin tức mới nhất...</p>
          </div>
        ) : error ? (
          <div className="bg-red-50 text-red-600 p-6 rounded-2xl flex flex-col items-center text-center">
            <AlertTriangle size={32} className="mb-3" />
            <p className="font-bold mb-1">Lỗi tải dữ liệu</p>
            <p className="text-sm opacity-80">{error}</p>
          </div>
        ) : filteredNews.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl border border-gray-200">
            <Newspaper size={48} className="mx-auto text-gray-300 mb-4" />
            <p className="text-gray-500 font-medium">Không tìm thấy bài báo nào phù hợp.</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-6">
            {filteredNews.map((item, idx) => (
              <motion.a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                key={idx}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                className="group bg-white rounded-2xl p-6 border border-gray-200 hover:border-blue-300 hover:shadow-xl hover:shadow-blue-900/5 transition-all flex flex-col h-full"
              >
                <div className="flex items-start justify-between mb-4 gap-4">
                  <span className={`text-[11px] font-bold px-3 py-1 rounded-full uppercase tracking-wide ${getSourceColor(item.sourceType)}`}>
                    {item.sourceName}
                  </span>
                  <span className="flex items-center gap-1.5 text-xs text-gray-400 whitespace-nowrap">
                    <Clock size={12} />
                    {new Date(item.publishedAt).toLocaleDateString('vi-VN')}
                  </span>
                </div>
                
                <h2 className="text-xl font-bold text-gray-900 mb-3 group-hover:text-blue-600 transition-colors line-clamp-2">
                  {item.title}
                </h2>
                
                <p className="text-gray-600 text-sm leading-relaxed mb-6 flex-1 line-clamp-3">
                  {item.summary}
                </p>
                
                <div className="mt-auto pt-4 border-t border-gray-100 flex items-center justify-between text-sm">
                  <span className="font-bold text-blue-600">Đọc toàn bộ bài báo</span>
                  <ExternalLink size={16} className="text-blue-400 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                </div>
              </motion.a>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
