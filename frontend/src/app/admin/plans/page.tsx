'use client'

import { useState } from 'react'
import AdminShell from '@/components/admin/AdminShell'
import useAdminData from '@/hooks/useAdminData'
import api from '@/lib/api'
import { motion } from 'framer-motion'
import { Zap, Crown, ShieldCheck, Database, Rocket, XCircle } from 'lucide-react'

type PlanRow = {
  code: string
  name: string
  monthlyTokenLimit: number
  isActive: boolean
  featuresJson?: string
  createdAt?: string
}

// Helper to define styles based on plan code
const getPlanStyle = (code: string) => {
  const c = code.toUpperCase()
  if (c === 'ULTRA') {
    return {
      gradient: 'from-amber-400 to-orange-600',
      bgLight: 'bg-orange-50',
      border: 'border-orange-500/30',
      icon: <Crown className="text-orange-500" size={24} />,
      textColor: 'text-orange-600',
      shadow: 'hover:shadow-orange-500/20',
      badgeBg: 'bg-gradient-to-r from-amber-500 to-orange-600',
    }
  }
  if (c === 'PRO') {
    return {
      gradient: 'from-violet-500 to-purple-600',
      bgLight: 'bg-purple-50',
      border: 'border-purple-500/30',
      icon: <Rocket className="text-purple-500" size={24} />,
      textColor: 'text-purple-600',
      shadow: 'hover:shadow-purple-500/20',
      badgeBg: 'bg-gradient-to-r from-violet-500 to-purple-600',
    }
  }
  if (c === 'INTERNAL') {
    return {
      gradient: 'from-emerald-400 to-green-600',
      bgLight: 'bg-emerald-50',
      border: 'border-emerald-500/30',
      icon: <ShieldCheck className="text-emerald-500" size={24} />,
      textColor: 'text-emerald-600',
      shadow: 'hover:shadow-emerald-500/20',
      badgeBg: 'bg-gradient-to-r from-emerald-500 to-green-600',
    }
  }
  // FREE / DEFAULT
  return {
    gradient: 'from-slate-400 to-slate-600',
    bgLight: 'bg-slate-50',
    border: 'border-slate-300',
    icon: <Database className="text-slate-500" size={24} />,
    textColor: 'text-slate-600',
    shadow: 'hover:shadow-slate-500/10',
    badgeBg: 'bg-slate-500',
  }
}

export default function AdminPlansPage() {
  const { data, loading, refreshing, error, lastSyncedAt, reload } = useAdminData<PlanRow[]>({
    initialData: [],
    errorMessage: 'Không thể tải danh sách gói.',
    fetchData: async () => {
      const res = await api.get('/admin/plans')
      return (res.data ?? []) as PlanRow[]
    },
  })

  // Container variants for stagger animation
  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  }

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 300, damping: 24 } },
  }

  if (loading) {
    return (
      <AdminShell
        title="Gói đăng ký & hạn mức token"
        subtitle="Dữ liệu từ bảng subscription_plans"
        activeNav="plans"
        error={error}
        refreshing={refreshing}
        onRefresh={() => reload({ silent: true })}
        lastSyncedAt={lastSyncedAt}
      >
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 rounded-full border-4 border-slate-200 border-t-violet-500 animate-spin"></div>
        </div>
      </AdminShell>
    )
  }

  return (
    <AdminShell
      title="Gói đăng ký & hạn mức token"
      subtitle="Quản lý và theo dõi các gói đăng ký trên toàn hệ thống"
      activeNav="plans"
      error={error}
      refreshing={refreshing}
      onRefresh={() => reload({ silent: true })}
      lastSyncedAt={lastSyncedAt}
    >
      <div className="mb-6 flex justify-between items-center">
        <p className="text-sm text-slate-500 font-medium">
          Hiển thị tổng cộng <span className="font-bold text-slate-800">{data.length}</span> gói
        </p>
        <div className="text-xs text-slate-400 bg-slate-100 px-3 py-1.5 rounded-full font-mono">
          GET /api/admin/plans
        </div>
      </div>

      {data.length === 0 ? (
        <div className="py-20 text-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50">
          <p className="text-slate-500 font-medium">Không có gói nào được cấu hình trong hệ thống.</p>
        </div>
      ) : (
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
        >
          {data.map((p) => {
            const style = getPlanStyle(p.code)
            const tokenFormatted = p.monthlyTokenLimit > 0 
                ? Number(p.monthlyTokenLimit).toLocaleString('vi-VN') 
                : "Không giới hạn"

            return (
              <motion.div
                key={p.code}
                variants={itemVariants}
                whileHover={{ scale: 1.02, y: -4 }}
                className={`relative bg-white rounded-3xl p-6 border ${style.border} shadow-sm transition-all duration-300 ${style.shadow}`}
              >
                {/* Active Badge */}
                <div className="absolute top-4 right-4 flex items-center gap-1.5">
                  <span className="relative flex h-2.5 w-2.5">
                    {p.isActive && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>}
                    <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${p.isActive ? 'bg-emerald-500' : 'bg-slate-300'}`}></span>
                  </span>
                  <span className={`text-[10px] font-bold uppercase tracking-wider ${p.isActive ? 'text-emerald-600' : 'text-slate-400'}`}>
                    {p.isActive ? 'Hoạt động' : 'Đã tắt'}
                  </span>
                </div>

                {/* Header Icon & Title */}
                <div className="flex items-center gap-4 mb-6">
                  <div className={`w-12 h-12 rounded-2xl ${style.bgLight} flex items-center justify-center shadow-inner`}>
                    {style.icon}
                  </div>
                  <div>
                    <h3 className="font-extrabold text-lg text-slate-900 tracking-tight">{p.name}</h3>
                    <div className={`bg-gradient-to-r ${style.gradient} text-white px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest shadow-sm inline-block mt-0.5`}>
                      {p.code}
                    </div>
                  </div>
                </div>

                {/* Tokens Metric */}
                <div className="mb-6 p-4 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-between group">
                  <div>
                    <p className="text-[10px] uppercase font-bold text-slate-400 mb-1">Token / Tháng (UTC)</p>
                    <div className="flex items-baseline gap-1">
                      <span className={`text-2xl font-black ${p.monthlyTokenLimit > 0 ? style.textColor : 'text-slate-700'}`}>
                        {tokenFormatted}
                      </span>
                    </div>
                  </div>
                  <div className={`w-10 h-10 rounded-full ${style.bgLight} flex items-center justify-center opacity-50 group-hover:opacity-100 transition-opacity`}>
                    <Zap size={18} className={style.textColor} />
                  </div>
                </div>

                {/* Footer/Features Placeholder */}
                <div className="pt-4 border-t border-slate-100 flex justify-between items-center text-xs font-medium text-slate-400">
                  <span>Dữ liệu từ CSDL</span>
                  {p.createdAt && <span>{new Date(p.createdAt).toLocaleDateString('vi-VN')}</span>}
                </div>
              </motion.div>
            )
          })}
        </motion.div>
      )}
    </AdminShell>
  )
}
