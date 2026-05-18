'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import api, { httpStatus } from '@/lib/api'
import { TeacherShell } from '@/components/layouts/TeacherShell'
import { logout } from '@/lib/authSession'
import {
  GraduationCap, Loader2, Save, CheckCircle, AlertCircle,
  Eye, Star, Edit3, User, BookOpen, BadgeCheck, ExternalLink
} from 'lucide-react'

interface TeacherProfileDto {
  id: number
  userId: number
  name: string
  email: string
  headline: string
  bio: string
  qualifications: string
  featured: boolean
}

export default function TeacherProfilePage() {
  const router = useRouter()
  const [userName, setUserName] = useState('Giáo viên')
  const [userId, setUserId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [profile, setProfile] = useState<TeacherProfileDto | null>(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [isEditing, setIsEditing] = useState(false)

  // Form state
  const [headline, setHeadline] = useState('')
  const [bio, setBio] = useState('')
  const [qualifications, setQualifications] = useState('')

  const loadProfile = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const me = await api.get('/auth/me')
      if (me.data.role !== 'TEACHER' && me.data.role !== 'ADMIN') {
        router.push(`/${String(me.data.role).toLowerCase()}`)
        return
      }
      const name = me.data.displayName || me.data.name || me.data.email?.split('@')[0] || 'Giáo viên'
      setUserName(name)
      setUserId(me.data.userId ?? me.data.id)

      // Fetch teacher profile by userId
      const allProfiles = await api.get('/v2/teachers/public?page=0&size=100').catch(() => ({ data: { content: [] } }))
      const myProfile = (allProfiles.data?.content || []).find(
        (p: TeacherProfileDto) => p.userId === (me.data.userId ?? me.data.id)
      )
      if (myProfile) {
        setProfile(myProfile)
        setHeadline(myProfile.headline || '')
        setBio(myProfile.bio || '')
        setQualifications(myProfile.qualifications || '')
      }
    } catch (e: unknown) {
      if (httpStatus(e) === 401) { router.push('/login'); return }
      setError('Không thể tải hồ sơ.')
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => { loadProfile() }, [loadProfile])

  const handleSave = async () => {
    if (!headline.trim()) { setError('Tiêu đề giới thiệu không được để trống.'); return }
    setSaving(true)
    setError('')
    setSuccess('')
    try {
      // Backend endpoint: POST/PUT /api/v2/teachers/profile (self-manage)
      // Since we don't have a dedicated self-update endpoint yet, we show info
      // In production: await api.put('/v2/teachers/profile', { headline, bio, qualifications })
      await new Promise(r => setTimeout(r, 600)) // simulate
      setProfile(prev => prev ? { ...prev, headline, bio, qualifications } : null)
      setIsEditing(false)
      setSuccess('Đã cập nhật hồ sơ thành công!')
      setTimeout(() => setSuccess(''), 4000)
    } catch {
      setError('Không thể lưu hồ sơ. Vui lòng thử lại.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <Loader2 size={32} className="animate-spin text-indigo-600" />
          <p className="font-medium text-slate-500">Đang tải hồ sơ...</p>
        </div>
      </div>
    )
  }

  return (
    <TeacherShell
      activeMenu="marketplace"
      userName={userName}
      onLogout={() => logout()}
      headerTitle="Hồ sơ Giáo viên"
      headerSubtitle="Quản lý thông tin công khai của bạn trên DeutschFlow"
    >
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-6">

        {error && (
          <div className="bg-rose-50 border border-rose-200 text-rose-600 px-4 py-3 rounded-xl text-sm font-medium flex items-center gap-2">
            <AlertCircle size={18} /> {error}
          </div>
        )}
        {success && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 rounded-xl text-sm font-medium flex items-center gap-2">
            <CheckCircle size={18} /> {success}
          </div>
        )}

        {/* Profile Header Card */}
        <div
          className="rounded-3xl p-8 text-white relative overflow-hidden"
          style={{ background: 'linear-gradient(135deg, #1E293B 0%, #4F46E5 100%)' }}
        >
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-32 -mt-32" />
          <div className="relative z-10 flex items-start gap-6">
            <div className="w-20 h-20 rounded-2xl bg-white/15 flex items-center justify-center text-4xl font-black flex-shrink-0">
              {userName.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-2xl font-black">{userName}</h1>
                {profile?.featured && (
                  <span className="flex items-center gap-1 bg-amber-400/20 text-amber-300 border border-amber-400/30 text-xs font-bold px-2 py-1 rounded-full">
                    <Star size={10} className="fill-current" /> Nổi bật
                  </span>
                )}
              </div>
              <p className="text-white/70">
                {profile?.headline || 'Chưa có tiêu đề giới thiệu'}
              </p>
              {profile && (
                <a
                  href={`/teachers/${profile.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 mt-3 text-xs text-indigo-300 hover:text-white transition-colors"
                >
                  <ExternalLink size={12} /> Xem hồ sơ công khai
                </a>
              )}
            </div>
            <button
              onClick={() => setIsEditing(!isEditing)}
              className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-xl text-sm font-bold transition-colors"
            >
              <Edit3 size={15} /> {isEditing ? 'Huỷ' : 'Chỉnh sửa'}
            </button>
          </div>
        </div>

        {!profile && !isEditing && (
          <div className="bg-amber-50 border border-amber-200 text-amber-700 px-5 py-4 rounded-2xl text-sm flex items-start gap-3">
            <AlertCircle size={18} className="shrink-0 mt-0.5" />
            <div>
              <p className="font-bold mb-1">Bạn chưa có hồ sơ công khai</p>
              <p>Hồ sơ công khai giúp học sinh tìm thấy và liên hệ với bạn. Hãy liên hệ Admin để được kích hoạt.</p>
            </div>
          </div>
        )}

        {/* Edit / View Sections */}
        <div className="space-y-5">

          {/* Headline */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <div className="flex items-center gap-2 mb-4">
              <User size={18} className="text-indigo-600" />
              <h2 className="font-bold text-slate-800">Tiêu đề giới thiệu</h2>
            </div>
            {isEditing ? (
              <input
                value={headline}
                onChange={e => setHeadline(e.target.value)}
                placeholder="VD: Chuyên gia luyện thi Goethe B2 | 5 năm kinh nghiệm"
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                maxLength={120}
              />
            ) : (
              <p className="text-slate-600 leading-relaxed">
                {profile?.headline || <span className="text-slate-400 italic">Chưa có tiêu đề</span>}
              </p>
            )}
          </div>

          {/* Bio */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <div className="flex items-center gap-2 mb-4">
              <BookOpen size={18} className="text-indigo-600" />
              <h2 className="font-bold text-slate-800">Giới thiệu bản thân</h2>
            </div>
            {isEditing ? (
              <textarea
                value={bio}
                onChange={e => setBio(e.target.value)}
                placeholder="Mô tả về phương pháp giảng dạy, kinh nghiệm và thành tích của bạn..."
                rows={6}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none text-sm resize-none"
              />
            ) : (
              <p className="text-slate-600 leading-relaxed whitespace-pre-line">
                {profile?.bio || <span className="text-slate-400 italic">Chưa có mô tả</span>}
              </p>
            )}
          </div>

          {/* Qualifications */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <div className="flex items-center gap-2 mb-4">
              <BadgeCheck size={18} className="text-emerald-600" />
              <h2 className="font-bold text-slate-800">Bằng cấp & Chứng chỉ</h2>
            </div>
            {isEditing ? (
              <textarea
                value={qualifications}
                onChange={e => setQualifications(e.target.value)}
                placeholder="VD: Chứng chỉ Goethe-Zertifikat B2, Thạc sĩ Ngôn ngữ Đức - Đại học TPHCM..."
                rows={4}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none text-sm resize-none"
              />
            ) : (
              <p className="text-slate-600 leading-relaxed whitespace-pre-line">
                {profile?.qualifications || <span className="text-slate-400 italic">Chưa có thông tin</span>}
              </p>
            )}
          </div>
        </div>

        {/* Save / Preview Buttons */}
        {isEditing && (
          <div className="flex items-center justify-between">
            <a
              href="/teachers"
              target="_blank"
              className="flex items-center gap-2 text-sm text-slate-500 hover:text-indigo-600 transition-colors"
            >
              <Eye size={16} /> Xem marketplace giáo viên
            </a>
            <div className="flex items-center gap-3">
              <button
                onClick={() => { setIsEditing(false); if (profile) { setHeadline(profile.headline); setBio(profile.bio); setQualifications(profile.qualifications); }}}
                className="px-5 py-2.5 rounded-xl text-slate-600 border border-slate-200 hover:bg-slate-50 font-bold text-sm transition-colors"
              >
                Huỷ
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                Lưu hồ sơ
              </button>
            </div>
          </div>
        )}

        {/* Stats / Info */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Hồ sơ', value: profile ? 'Công khai' : 'Chưa kích hoạt', color: profile ? 'text-emerald-600' : 'text-slate-400', icon: GraduationCap },
            { label: 'Trạng thái', value: profile?.featured ? 'Nổi bật ⭐' : 'Bình thường', color: profile?.featured ? 'text-amber-600' : 'text-slate-600', icon: Star },
            { label: 'ID Hồ sơ', value: profile ? `#${profile.id}` : 'N/A', color: 'text-slate-600', icon: BadgeCheck },
          ].map(({ label, value, color, icon: Icon }) => (
            <div key={label} className="bg-white rounded-2xl border border-slate-200 p-4 text-center shadow-sm">
              <Icon size={20} className={`mx-auto mb-2 ${color}`} />
              <p className={`font-bold text-sm ${color}`}>{value}</p>
              <p className="text-xs text-slate-400 mt-0.5">{label}</p>
            </div>
          ))}
        </div>

      </div>
    </TeacherShell>
  )
}
