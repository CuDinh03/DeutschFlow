import api from '@/lib/api'

/**
 * Góp ý về phần mềm (đặc tả gopycapnhat, GĐ1). Backend: FeedbackController + AdminFeedbackController.
 * Nội dung góp ý và lời trả lời là CHỮ THUẦN — luôn render bằng text node, không bao giờ như HTML.
 */

export type FeedbackType = 'BUG' | 'IDEA' | 'USABILITY' | 'GENERAL'
export type FeedbackStatus = 'NEW' | 'READ' | 'IN_PROGRESS' | 'SHIPPED' | 'DECLINED'
export type FeedbackSource = 'IN_APP' | 'RATING_INVITE' | 'AFTER_MOCK'
export type FeedbackAudience = 'STUDENT' | 'TEACHER' | 'ORG'
export type FeedbackArea =
  | 'EXAM' | 'SPEAKING' | 'INTERVIEW' | 'VOCABULARY' | 'ROADMAP' | 'BILLING' | 'IOS_APP'
  | 'CLASSES' | 'GRADING' | 'SCHEDULE' | 'MATERIALS'
  | 'STUDENTS' | 'REPORTS'
  | 'OTHER'

/** Thứ tự hiện trên form, theo từng nhóm người gửi (FBK-04, FBK-13). Server kiểm lại. */
export const AREAS_BY_AUDIENCE: Record<FeedbackAudience, FeedbackArea[]> = {
  STUDENT: ['EXAM', 'SPEAKING', 'INTERVIEW', 'VOCABULARY', 'ROADMAP', 'BILLING', 'IOS_APP', 'OTHER'],
  TEACHER: ['CLASSES', 'GRADING', 'SCHEDULE', 'MATERIALS', 'OTHER'],
  ORG: ['STUDENTS', 'CLASSES', 'REPORTS', 'BILLING', 'OTHER'],
}

export const FEEDBACK_TYPES: FeedbackType[] = ['BUG', 'IDEA', 'USABILITY', 'GENERAL']
export const CONTENT_MIN = 10
export const CONTENT_MAX = 2000
export const MAX_ATTACHMENTS = 3
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024

export interface FeedbackTechInfo {
  page?: string
  browser?: string
  os?: string
  device?: string
  build?: string
  locale?: string
  screen?: string
}

export interface FeedbackReply {
  id: number
  body: string
  createdAt: string
}

export interface MyFeedback {
  id: number
  type: FeedbackType
  area: FeedbackArea
  source: FeedbackSource
  satisfaction: number | null
  title: string
  content: string
  status: FeedbackStatus
  attachmentCount: number
  createdAt: string
  statusChangedAt: string | null
  replies: FeedbackReply[]
}

export interface CreateFeedbackBody {
  type: FeedbackType
  area: FeedbackArea
  satisfaction: number | null
  content: string
  allowContact: boolean
  techInfo: FeedbackTechInfo | null
  attachmentIds: number[]
  clientRequestId: string
}

export interface AdminFeedbackListItem {
  id: number
  type: FeedbackType
  area: FeedbackArea
  source: FeedbackSource
  satisfaction: number | null
  lowScore: boolean
  title: string
  excerpt: string
  status: FeedbackStatus
  authorName: string | null
  authorRole: string
  authorLevel: string | null
  attachmentCount: number
  replyCount: number
  createdAt: string
}

export interface AdminFeedbackPage {
  items: AdminFeedbackListItem[]
  total: number
  page: number
  size: number
  statusCounts: Record<FeedbackStatus, number>
}

export interface AdminFeedbackDetail {
  id: number
  type: FeedbackType
  area: FeedbackArea
  source: FeedbackSource
  satisfaction: number | null
  lowScore: boolean
  title: string
  content: string
  status: FeedbackStatus
  createdAt: string
  readAt: string | null
  statusChangedAt: string | null
  authorId: number
  authorName: string | null
  authorRole: string
  authorLevel: string | null
  authorPlan: string | null
  authorSince: string | null
  orgName: string | null
  allowContact: boolean
  authorEmail: string | null
  techInfo: FeedbackTechInfo | null
  attachments: { id: number; url: string | null; width: number; height: number }[]
  replies: FeedbackReply[]
  internalNote: string | null
}

export type AdminFeedbackSort = 'NEWEST' | 'LOW_SCORE'

export interface AdminFeedbackFilter {
  status?: FeedbackStatus
  type?: FeedbackType
  area?: FeedbackArea
  role?: 'STUDENT' | 'TEACHER' | 'ORG'
  q?: string
  sort?: AdminFeedbackSort
  page?: number
}

export const feedbackApi = {
  form: () => api.get<{ audience: FeedbackAudience; areas: FeedbackArea[] }>('/feedback/form'),
  mine: () => api.get<MyFeedback[]>('/feedback/mine'),
  submit: (body: CreateFeedbackBody) => api.post<MyFeedback>('/feedback', body),
  upload: (file: Blob, name: string) => {
    const form = new FormData()
    form.append('file', file, name)
    return api.post<{ id: number; width: number; height: number; sizeBytes: number }>(
      '/feedback/attachments', form, { headers: { 'Content-Type': 'multipart/form-data' } })
  },
  removeAttachment: (id: number) => api.delete<void>(`/feedback/attachments/${id}`),
}

export const adminFeedbackApi = {
  list: (filter: AdminFeedbackFilter) => {
    const params: Record<string, string | number> = {}
    for (const [k, v] of Object.entries(filter)) {
      if (v !== undefined && v !== '' && v !== null) params[k] = v as string | number
    }
    return api.get<AdminFeedbackPage>('/admin/feedback', { params })
  },
  unreadCount: () => api.get<{ count: number }>('/admin/feedback/unread-count'),
  detail: (id: number) => api.get<AdminFeedbackDetail>(`/admin/feedback/${id}`),
  markRead: (id: number) => api.post<{ updated: number }>(`/admin/feedback/${id}/mark-read`),
  markManyRead: (ids: number[]) => api.post<{ updated: number }>('/admin/feedback/mark-read', { ids }),
  changeStatus: (ids: number[], status: FeedbackStatus, explanation?: string) =>
    api.post<{ updated: number; unchanged: number }>('/admin/feedback/status', { ids, status, explanation }),
  reply: (id: number, body: string) => api.post<FeedbackReply>(`/admin/feedback/${id}/replies`, { body }),
  saveNote: (id: number, note: string) => api.put<void>(`/admin/feedback/${id}/internal-note`, { note }),
}
