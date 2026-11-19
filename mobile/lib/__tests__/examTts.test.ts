// Đường lùi giọng của bài nghe (Đợt 4d): máy chủ chưa có / từ chối giọng `HOER_*` thì đọc theo vai như cũ.

const get = jest.fn()
const tts = jest.fn()
const speak = jest.fn()

jest.mock('../api', () => ({ __esModule: true, default: { get: (...a: unknown[]) => get(...a) } }))
jest.mock('../speakingApi', () => ({ speakingApi: { tts: (...a: unknown[]) => tts(...a) } }))
jest.mock('expo-file-system/legacy', () => ({
  cacheDirectory: 'file:///cache/',
  EncodingType: { Base64: 'base64' },
  writeAsStringAsync: jest.fn(async () => undefined),
  deleteAsync: jest.fn(async () => undefined),
}))
jest.mock('expo-audio', () => ({
  setAudioModeAsync: jest.fn(async () => undefined),
  createAudioPlayer: () => {
    let done: ((st: { didJustFinish: boolean }) => void) | null = null
    return {
      addListener: (_: string, cb: (st: { didJustFinish: boolean }) => void) => { done = cb },
      play: () => done?.({ didJustFinish: true }),
      remove: () => undefined,
    }
  },
}))
jest.mock('expo-speech', () => ({
  speak: (text: string, opts: { onDone: () => void }) => { speak(text); opts.onDone() },
  stop: () => undefined,
}))

function load(): typeof import('../examTts') {
  let mod: typeof import('../examTts') | undefined
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- nạp lại module để xoá bộ nhớ danh sách giọng
  jest.isolateModules(() => { mod = require('../examTts') })
  return mod!
}

beforeEach(() => {
  get.mockReset()
  tts.mockReset()
  speak.mockReset()
})

describe('speakExamLine — giọng bài nghe', () => {
  it('máy chủ có HOER_* thì đọc đúng giọng nhân vật', async () => {
    get.mockResolvedValue({ data: { personas: ['ANNA', 'THOMAS', 'HOER_F1', 'HOER_M1'] } })
    tts.mockResolvedValue('bXAz')
    await load().speakExamLine('PRUEFER', 'Guten Tag.', 'HOER_F1')
    expect(tts).toHaveBeenCalledTimes(1)
    expect(tts).toHaveBeenCalledWith('Guten Tag.', 'HOER_F1')
  })

  it('danh sách chưa có HOER_* thì đọc theo vai', async () => {
    get.mockResolvedValue({ data: { personas: ['ANNA', 'THOMAS'] } })
    tts.mockResolvedValue('bXAz')
    await load().speakExamLine('PARTNER', 'Hallo.', 'HOER_M2')
    expect(tts).toHaveBeenCalledWith('Hallo.', 'THOMAS')
  })

  it('hỏi danh sách giọng bị lỗi thì đọc theo vai', async () => {
    get.mockRejectedValue(new Error('network'))
    tts.mockResolvedValue('bXAz')
    await load().speakExamLine('PRUEFER', 'Hallo.', 'HOER_F2')
    expect(tts).toHaveBeenCalledWith('Hallo.', 'ANNA')
  })

  it('máy chủ từ chối giọng mới (có response) thì thử lại một lần bằng giọng theo vai', async () => {
    get.mockResolvedValue({ data: { personas: ['HOER_F1'] } })
    tts.mockRejectedValueOnce({ response: { status: 400 } }).mockResolvedValueOnce('bXAz')
    await load().speakExamLine('PRUEFER', 'Hallo.', 'HOER_F1')
    expect(tts.mock.calls.map((c) => c[1])).toEqual(['HOER_F1', 'ANNA'])
    expect(speak).not.toHaveBeenCalled()
  })

  it('mất mạng khi đọc (không có response) thì không thử lại, rơi xuống giọng máy', async () => {
    get.mockResolvedValue({ data: { personas: ['HOER_F1'] } })
    tts.mockRejectedValue(new Error('timeout'))
    await load().speakExamLine('PRUEFER', 'Hallo.', 'HOER_F1')
    expect(tts).toHaveBeenCalledTimes(1)
    expect(speak).toHaveBeenCalledWith('Hallo.')
  })

  it('không truyền giọng thì không hỏi danh sách (phòng thi nói giữ nguyên)', async () => {
    tts.mockResolvedValue('bXAz')
    await load().speakExamLine('PARTNER', 'Und Sie?')
    expect(get).not.toHaveBeenCalled()
    expect(tts).toHaveBeenCalledWith('Und Sie?', 'THOMAS')
  })
})
