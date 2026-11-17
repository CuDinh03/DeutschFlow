// ESLint cho app mobile (SP-5, quyết định QĐ-SP-7 ngày 11/11/2026).
// Cổng chính là rules-of-hooks: hook gọi có điều kiện làm sập màn lúc chạy mà tsc và jest không bắt
// được. exhaustive-deps chỉ cảnh báo vì code hiện có nhiều chỗ cố ý bỏ phụ thuộc.
//
// Chạy: `npx eslint .` (CI gọi đúng lệnh này). CỐ Ý không thêm script "lint" vào package.json: mục
// `scripts` nằm trong runtime fingerprint, thêm một dòng là OTA không tới được bản build đang bán.
const { defineConfig } = require('eslint/config')
const expoConfig = require('eslint-config-expo/flat')

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['node_modules/**', '.expo/**', 'ios/**', 'android/**', 'dist/**', 'design/**', 'coverage/**'],
  },
  {
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      // Luật thoát ký tự kiểu HTML không áp cho <Text> của React Native; dấu nháy trong câu là có chủ ý.
      'react/no-unescaped-entities': 'off',
    },
  },
])
