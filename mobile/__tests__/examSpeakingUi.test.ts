/**
 * Helpers thuần của Luyện thi Nói mobile — đợt parity 05/09:
 * drillSummary (tổng kết drill), verdict/borderline (F-17), gradingFailedCopy (F-08),
 * isRetryableTurnError + newClientTurnId (F-06), providerName/rubricCaption (telc).
 */
import {
  drillSummary, gradingFailedCopy, isRetryableTurnError, newClientTurnId, providerName, rubricCaption,
  verdict, verdictLabel, verdictTone,
} from '@/lib/examSpeakingUi'

describe('drillSummary', () => {
  it('trung bình điểm các lượt có điểm, gom lỗi theo câu gốc (giữ lần cuối), bỏ lượt lỗi/không điểm', () => {
    const s = drillSummary([
      { score: 8, corrections: [{ code: 'VERB_POS', original: 'Ich gern esse', correction: 'Ich esse gern' }] },
      null,
      { error: 'AI trả kết quả không hợp lệ' },
      { score: 5, corrections: [
        { code: 'VERB_POS', original: 'ich gern esse', correction: 'Ich esse gern Brot' },
        { code: 'CASE', original: 'mit der Bus', correction: 'mit dem Bus' },
        { code: 'X', original: '   ', correction: 'x' },
      ] },
    ])
    expect(s.turns).toBe(2)
    expect(s.avgScore).toBe(6.5)
    expect(s.corrections).toEqual([
      { code: 'VERB_POS', original: 'ich gern esse', correction: 'Ich esse gern Brot' },
      { code: 'CASE', original: 'mit der Bus', correction: 'mit dem Bus' },
    ])
  })

  it('không có lượt chấm → avgScore null, 0 lượt', () => {
    expect(drillSummary([])).toEqual({ turns: 0, avgScore: null, corrections: [] })
  })
})

describe('verdict (F-17)', () => {
  it('sát ngưỡng thắng đỗ/trượt; không ngưỡng → NONE', () => {
    expect(verdict({ passed: true, borderline: true })).toBe('BORDERLINE')
    expect(verdict({ passed: true })).toBe('PASS')
    expect(verdict({ passed: false, borderline: false })).toBe('FAIL')
    expect(verdict({ passed: null })).toBe('NONE')
    expect(verdictLabel('BORDERLINE')).toBe('SÁT NGƯỠNG')
    expect(verdictTone('BORDERLINE')).toBe('accent')
    expect(verdictTone('FAIL')).toBe('danger')
  })
})

describe('gradingFailedCopy (F-08)', () => {
  it('QUOTA_EXCEEDED → thông điệp hết ngân sách + gợi ý nạp; lý do khác → job lỗi, không mời nạp', () => {
    const q = gradingFailedCopy('QUOTA_EXCEEDED')
    expect(q.topUp).toBe(true)
    expect(q.message).toMatch(/không phải thi lại/)
    expect(gradingFailedCopy('JOB_FAILED').topUp).toBe(false)
    expect(gradingFailedCopy(null).title).toBe('Chấm bài gặp lỗi')
  })
})

describe('retry idempotent (F-06)', () => {
  it('không response / 5xx / 409 đang xử lý → gửi lại được; 4xx khác → không', () => {
    expect(isRetryableTurnError(new Error('timeout'))).toBe(true)
    expect(isRetryableTurnError({ response: { status: 503 } })).toBe(true)
    expect(isRetryableTurnError({ response: { status: 409, data: { detail: 'Lượt nói này đang được xử lý — chờ vài giây' } } })).toBe(true)
    expect(isRetryableTurnError({ response: { status: 409, data: { detail: 'Hết giờ Teil 2 — đã chuyển sang phần kế tiếp.' } } })).toBe(false)
    expect(isRetryableTurnError({ response: { status: 413 } })).toBe(false)
    expect(isRetryableTurnError({ response: { status: 400 } })).toBe(false)
  })

  it('newClientTurnId: khoá an toàn cho query (chữ, số, - _ . :) và không trùng', () => {
    const a = newClientTurnId()
    const b = newClientTurnId()
    expect(a).toMatch(/^[A-Za-z0-9_.:-]+$/)
    expect(a).not.toBe(b)
  })
})

describe('provider labels', () => {
  it('telc vs Goethe', () => {
    expect(providerName('TELC')).toBe('telc')
    expect(providerName('GOETHE')).toBe('Goethe')
    expect(rubricCaption('TELC')).toMatch(/telc/)
    expect(rubricCaption('GOETHE')).toMatch(/Goethe/)
  })
})
