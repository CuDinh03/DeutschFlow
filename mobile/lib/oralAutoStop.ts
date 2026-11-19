import * as SecureStore from 'expo-secure-store'

// Công tắc "Tự dừng khi im" của phòng thi nói, nhớ theo máy (mặc định bật, như web
// `df.oral.autoStop`). Đọc/ghi hỏng thì coi như bật — không chặn luồng thi.

const KEY = 'df_oral_auto_stop'

export async function readOralAutoStop(): Promise<boolean> {
  try {
    return (await SecureStore.getItemAsync(KEY)) !== '0'
  } catch {
    return true
  }
}

export async function writeOralAutoStop(on: boolean): Promise<void> {
  try {
    await SecureStore.setItemAsync(KEY, on ? '1' : '0')
  } catch {
    /* best-effort: chỉ nhớ trong lần mở app này */
  }
}
