// Bộ tính năng Framer cho trang công khai, nạp bất đồng bộ qua `LandingMotion`. Dùng `domMax` vì nền
// trượt của chip nghề (`layoutId`) và từ đổi chỗ (`layout`) cần layout animation; `domAnimation` không có.
import { domMax } from 'framer-motion'

export default domMax
