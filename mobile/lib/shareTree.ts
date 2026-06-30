// "Khoe cây" — share the skill tree as an image. No new native dependency: it
// uses react-native-svg's built-in toDataURL (PNG base64), expo-file-system to
// stage the file, and React Native's built-in Share (already used elsewhere in
// the app). On iOS the file URL attaches the image; on Android RN Share carries
// the caption text only (an OS/RN limitation — a full image attach there would
// need expo-sharing, i.e. a native rebuild).

import { Share } from 'react-native'
import * as FileSystem from 'expo-file-system/legacy'

export async function shareTreePng(base64: string, caption: string): Promise<void> {
  try {
    const fileUri = `${FileSystem.cacheDirectory}cay-hoc-tap.png`
    await FileSystem.writeAsStringAsync(fileUri, base64, { encoding: FileSystem.EncodingType.Base64 })
    await Share.share({ url: fileUri, message: caption })
  } catch {
    // share cancelled or capture failed — non-fatal, nothing to surface
  }
}

export function treeCaption(done: number, total: number, pct: number): string {
  return `Cây tiếng Đức của tôi 🌳 ${pct}% · ${done}/${total} chặng — học cùng DeutschFlow`
}
