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

describe('stimulusDisplay — đủ 15 kiểu thẻ (QA simulator 06/09: B1 T2/T3 từng hiện ô trống)', () => {
  const { stimulusDisplay } = require('@/lib/examSpeakingUi') as typeof import('@/lib/examSpeakingUi')

  it('FOLIEN_DECK: topic làm headline, folien thành gạch đầu dòng', () => {
    const d = stimulusDisplay({ type: 'FOLIEN_DECK', topic: 'Lernen mit dem Computer oder mit Büchern?', folien: ['Thema vorstellen', 'Eigene Erfahrung'] })
    expect(d.headline).toBe('Lernen mit dem Computer oder mit Büchern?')
    expect(d.bullets).toEqual(['Thema vorstellen', 'Eigene Erfahrung'])
  })

  it('PARTNER_PRESENTATION: topic + instruction; partnerPresentation KHÔNG BAO GIỜ lộ', () => {
    const d = stimulusDisplay({ type: 'PARTNER_PRESENTATION', topic: 'Online einkaufen', instruction: 'Hören Sie zu.', partnerPresentation: 'BÍ MẬT' })
    expect(d.headline).toBe('Online einkaufen')
    expect(d.lines).toEqual(['Hören Sie zu.'])
    expect(JSON.stringify(d)).not.toContain('BÍ MẬT')
  })

  it('CONTACT_CARD / PLANNING_CARD / TOPIC_CHOICE: instruction/context/goal là dòng phụ, topics/prompts/aspects là gạch đầu dòng', () => {
    expect(stimulusDisplay({ type: 'CONTACT_CARD', instruction: 'Lernen Sie sich kennen.', topics: ['Name', 'Herkunft'] }))
      .toEqual({ headline: null, lines: ['Lernen Sie sich kennen.'], bullets: ['Name', 'Herkunft'] })
    const p = stimulusDisplay({ type: 'PLANNING_CARD', situation: 'Sie möchten zusammen an einem Sportlauf teilnehmen.', prompts: ['Wann trainieren?', 'Wo anmelden?'] })
    expect(p.headline).toMatch(/Sportlauf/)
    expect(p.bullets).toEqual(['Wann trainieren?', 'Wo anmelden?'])
    const t = stimulusDisplay({ type: 'TOPIC_CHOICE', topic: 'Homeoffice', context: 'Debattierclub', instruction: 'Halten Sie einen Vortrag.', aspects: ['Vorteile', 'Nachteile'], structureHint: 'Einleitung – Hauptteil – Schluss' })
    expect(t.headline).toBe('Homeoffice')
    expect(t.lines).toEqual(['Halten Sie einen Vortrag.', 'Debattierclub', 'Einleitung – Hauptteil – Schluss'])
    expect(t.bullets).toEqual(['Vorteile', 'Nachteile'])
  })

  it('CALENDAR_PAIR / TOPIC_GRAPHIC_PAIR: lịch và biểu đồ của THÍ SINH thành dòng "nhãn: giá trị"; phần partner bị bỏ', () => {
    const c = stimulusDisplay({ type: 'CALENDAR_PAIR', situation: 'Kino', goal: 'Termin finden', candidateCalendar: { Montag: ['frei'], Dienstag: ['8–16 Arbeit', '19 Sport'] }, partnerCalendar: { Montag: ['Arbeit'] } })
    expect(c.headline).toBe('Kino')
    expect(c.lines).toEqual(['Termin finden'])
    expect(c.bullets).toEqual(['Montag: frei', 'Dienstag: 8–16 Arbeit, 19 Sport'])
    const g = stimulusDisplay({ type: 'TOPIC_GRAPHIC_PAIR', thema: 'Ferien und Reisen', instruction: 'Berichten Sie.', candidateText: 'Umfrage 2025', candidateChart: [{ label: 'Meer', value: '45 %' }, { label: 'Berge', value: '30 %' }], partnerText: 'GEHEIM' })
    expect(g.headline).toBe('Ferien und Reisen')
    expect(g.lines).toEqual(['Berichten Sie.', 'Umfrage 2025'])
    expect(g.bullets).toEqual(['Meer: 45 %', 'Berge: 30 %'])
    expect(JSON.stringify(g)).not.toContain('GEHEIM')
  })

  it('A1/A2: THEME_CARD, PICTURE_CARD, QUESTION_WORD_CARD, KEYWORD_CARD, DEBATE_TEXT', () => {
    expect(stimulusDisplay({ type: 'THEME_CARD', thema: 'Essen', wort: 'Brot' })).toEqual({ headline: 'Essen', lines: ['Wort: Brot'], bullets: [] })
    expect(stimulusDisplay({ type: 'PICTURE_CARD', article: 'der', object: 'Apfel', iconKey: 'apple' }).headline).toBe('der Apfel')
    expect(stimulusDisplay({ type: 'QUESTION_WORD_CARD', thema: 'Freizeit', questionWord: 'Wann' }).lines).toEqual(['Fragewort: Wann'])
    const k = stimulusDisplay({ type: 'KEYWORD_CARD', keywords: ['Name?', 'Alter?'], spell: 'Nguyen', number: '0176 123' })
    expect(k.bullets).toEqual(['Name?', 'Alter?'])
    expect(k.lines).toEqual(['Buchstabieren: Nguyen', 'Nummer: 0176 123'])
    const d = stimulusDisplay({ type: 'DEBATE_TEXT', question: 'Handyverbot an Schulen?', text: 'Immer mehr Schulen…', instruction: 'Diskutieren Sie.', partnerStance: 'dagegen' })
    expect(d.headline).toBe('Handyverbot an Schulen?')
    expect(d.lines).toEqual(['Diskutieren Sie.', 'Immer mehr Schulen…'])
    expect(JSON.stringify(d)).not.toContain('dagegen')
    expect(stimulusDisplay(null)).toEqual({ headline: null, lines: [], bullets: [] })
  })
})
