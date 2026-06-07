export default function StudentLoading() {
  return (
    <div
      role="status"
      aria-label="Đang tải"
      className="flex min-h-screen items-center justify-center bg-slate-50"
    >
      <div className="flex flex-col items-center gap-3">
        <div
          className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin motion-reduce:animate-none"
          aria-hidden
        />
        <p className="text-sm text-slate-400 font-medium">Đang tải...</p>
      </div>
    </div>
  )
}
