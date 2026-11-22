import { AI_PARTNERS, aiPartnersText } from '@/lib/aiConsent'

// jest tự đưa jest.mock lên trước import.
jest.mock('expo-secure-store', () => ({ getItemAsync: jest.fn(), setItemAsync: jest.fn(), deleteItemAsync: jest.fn() }))

describe('AI_PARTNERS — bảng đồng ý nêu đủ đối tác như chính sách quyền riêng tư', () => {
  test('có Fireworks AI (bên xử lý chính) và đúng thứ tự mục 5 của privacy', () => {
    expect(AI_PARTNERS).toEqual(['Fireworks AI', 'Groq', 'OpenAI', 'Google (Gemini)'])
  })
  test('ghép thành câu tiếng Việt', () => {
    expect(aiPartnersText()).toBe('Fireworks AI, Groq, OpenAI và Google (Gemini)')
    expect(aiPartnersText(['A', 'B'])).toBe('A và B')
    expect(aiPartnersText(['A'])).toBe('A')
    expect(aiPartnersText([])).toBe('')
  })
})
