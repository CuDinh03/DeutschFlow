import { PERSONA_LIST } from '../personas'
import {
  WORKPLACE_INTERVIEWERS,
  resolveStagePersona,
  stagePersonaInfo,
} from '../workplaceInterviewers'

// K3 (21/10/2026): phiên có persona người tuyển dụng theo nơi làm việc không được rơi về mặt Lukas.
describe('workplaceInterviewers', () => {
  it('đủ 8 mã khớp backend V336 / SpeakingPersona', () => {
    expect(Object.keys(WORKPLACE_INTERVIEWERS).map((k) => k.toUpperCase()).sort()).toEqual(
      ['BECKER', 'BRANDT', 'HOFFMANN', 'KRUEGER', 'RICHTER', 'SCHULZ', 'WAGNER', 'YILMAZ'],
    )
  })

  it.each(['KRUEGER', 'krueger', 'Hoffmann', 'YILMAZ'])('mã %s → người tuyển dụng, không phải Lukas', (code) => {
    expect(resolveStagePersona(code)).toBe(code.toLowerCase())
  })

  it('bạn đồng hành có sẵn giữ nguyên', () => {
    expect(resolveStagePersona('NIKLAS')).toBe('niklas')
    expect(resolveStagePersona('LUKAS')).toBe('lukas')
  })

  it.each([null, undefined, '', 'DEFAULT', 'KHONG_CO'])('mã %p → Lukas như trước', (code) => {
    expect(resolveStagePersona(code)).toBe('lukas')
  })

  it('tên + vai trò + màu cho sân khấu', () => {
    expect(stagePersonaInfo('krueger')).toEqual({ name: 'Frau Krüger', role: 'Pflegedienstleitung', accent: '#0D9488' })
    expect(stagePersonaInfo('niklas').name).toBe('Niklas')
  })

  it('không lọt vào màn chọn bạn đồng hành', () => {
    const ids = new Set(PERSONA_LIST.map((p) => p.id as string))
    for (const id of Object.keys(WORKPLACE_INTERVIEWERS)) expect(ids.has(id)).toBe(false)
  })

  it('mỗi người có bộ màu đủ cho PersonaCharacter', () => {
    for (const w of Object.values(WORKPLACE_INTERVIEWERS)) {
      expect(w.variant.gender).toMatch(/^(male|female)$/)
      for (const k of ['skin', 'skinShadow', 'hair', 'outfit', 'eyeColor', 'eyebrow', 'lip'] as const) {
        expect(w.variant[k]).toMatch(/^#[0-9A-F]{6}$/i)
      }
    }
  })
})
