/**
 * Shared footer for the public legal pages. The /privacy and /terms documents now
 * render via the Galerie-themed {@link LegalDocGa}; this footer is still used by the
 * plain /support page. Kept separate so /support does not pull in the markdown renderer.
 */
export function LegalFooter() {
  return (
    <footer className="mt-14 border-t border-slate-200 pt-6 text-sm text-slate-500">
      <a className="underline hover:text-slate-700" href="/privacy">Privacy</a>
      {' · '}
      <a className="underline hover:text-slate-700" href="/terms">Terms</a>
      {' · '}
      <a className="underline hover:text-slate-700" href="/support">Support</a>
    </footer>
  )
}
