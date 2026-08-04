'use client'

import { useState } from 'react'
import { Send } from 'lucide-react'

interface ComposerProps {
  placeholder: string
  /** Resolves when the message is accepted; the draft clears only on success. */
  onSend: (text: string) => Promise<void>
}

/** Message composer shared by the direct and class-channel threads. */
export function Composer({ placeholder, onSend }: ComposerProps) {
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)

  const submit = async () => {
    const text = draft.trim()
    if (!text || sending) return
    setSending(true)
    try {
      await onSend(text)
      setDraft('')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="flex items-end gap-2 border-t border-ga-line px-4 py-3">
      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            void submit()
          }
        }}
        rows={1}
        placeholder={placeholder}
        // `flex-1` cho flex-basis:0% nhưng min-width vẫn là auto → bề rộng nội tại của textarea
        // (theo `cols` mặc định ~185px) làm sàn, cộng nút gửi + đệm là sát mép ở 320px. `min-w-0`
        // bỏ sàn đó; ở desktop khung luôn thừa chỗ nên không đổi gì.
        className="ga-ui max-h-32 min-h-[40px] w-full min-w-0 flex-1 resize-none rounded-ga border border-ga-line bg-ga-bg px-3.5 py-2 text-[14px] text-ga-ink outline-none focus:border-ga-accent"
      />
      <button
        type="button"
        onClick={() => void submit()}
        disabled={sending || !draft.trim()}
        aria-label="Gửi"
        className="grid h-10 w-10 shrink-0 place-items-center rounded-ga bg-ga-accent text-ga-accent-ink transition-opacity hover:opacity-90 disabled:opacity-40"
      >
        <Send size={17} />
      </button>
    </div>
  )
}
