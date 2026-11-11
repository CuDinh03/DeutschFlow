'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Copy, Upload } from 'lucide-react'
import { apiMessage } from '@/lib/api'
import { importDraft, type StudioDraft } from '@/lib/adminExamStudioApi'
import { GaBtn, GaCap, TkModal } from '@/components/ui-v2'
import { studioField } from './ui'
import { cn } from '@/lib/utils'

/** Trần tệp nhập — khớp `ExamDraftService.IMPORT_MAX_BYTES`. */
export const IMPORT_MAX_BYTES = 512 * 1024

/**
 * Prompt mẫu để nhờ Claude soạn một Teil đúng định dạng nhập. Viết bằng tiếng Đức vì nội dung đề là tiếng Đức;
 * các luật ở đây bám theo luật của Xưởng đề (công thức từng bậc, dạng nửa câu, nhiễu hợp lý, từ vựng đúng cấp).
 */
export const IMPORT_PROMPT_TEMPLATE = `Du erstellst eine Leseaufgabe für die Prüfung telc Deutsch B1, Leseverstehen Teil 2 (Zeitungsartikel + 5 Aufgaben a/b/c). Grundlage ist der Quellartikel, den ich unten einfüge oder als Datei anhänge.

TEXT
- Schreibe einen NEUEN Zeitungsartikel für ein breites Publikum, 300–450 Wörter, 4–6 zusammenhängende Absätze mit je 4–6 Sätzen.
- Benutze nur Fakten aus der Quelle. Erfinde keine Zahlen, Namen oder Ergebnisse. Übernimm keine Formulierung der Quelle (höchstens 5 Wörter in Folge).
- Ein Zusammenhang bleibt ein Zusammenhang und wird nie zu Ursache und Wirkung.
- Wortschatz B1, Alltagssprache. Keine Fachbegriffe und keine englischen Fremdwörter: umschreibe sie. Ein unvermeidbares schwieriges Wort bekommt direkt dahinter ein Sternchen (Beispiel: vorbeugend*) und eine einfache Erklärung im Glossar (höchstens 4).
- Zahlen immer mit Jahr. Neutrales Thema, keine Politik, keine Werbung. Reiner Text, kein Markdown.

AUFGABEN (5 Stück, Reihenfolge NICHT wie im Text)
- Jede Aufgabe ist ein SATZANFANG, der mit " …" endet, und drei SATZENDEN; genau eines ist laut Text richtig. Keine Fragesätze.
- Schwierigkeit pro Aufgabe (alles bleibt B1, nur die Technik ändert sich):
  EASY: Beleg in einem Satz, Lösung benutzt dessen Wörter, falsche Enden nennen etwas, das im Text nicht vorkommt.
  MEDIUM: Beleg in einem Absatz, Lösung mit anderen Wörtern, ein falsches Ende ordnet ein echtes Detail falsch zu.
  HARD: Lösung muss aus 2–3 Sätzen erschlossen werden, beide falschen Enden benutzen echte Details mit feiner Falle.
  EXPERT: Lösung verbindet zwei verschiedene Absätze, ein falsches Ende ist halb richtig.
- Verteilung: 2 × EASY, 2 × MEDIUM, 1 × HARD (ändere das nur, wenn ich es ausdrücklich verlange).
- Jede Zahl oder Gruppe im Satzanfang stimmt genau mit dem Text überein. Satzanfang + Lösung ergeben eine Aussage, die der Text belegt.
- Jedes falsche Ende klingt für jemanden, der den Text nicht gelesen hat, genauso glaubwürdig wie die Lösung. Die drei Enden sind etwa gleich lang.
- Nur Wörter auf B1-Niveau oder Wörter aus dem Text. Keine Prüfungssprache ("interpretieren", "ableiten").
- "evidence": wörtlich kopierte, vollständige Sätze aus DEINEM Text, die die Lösung belegen.
- "explanationVi": Erklärung auf Vietnamesisch, warum die Lösung richtig und jede andere Option falsch ist. Bezeichne die Optionen nur mit {1}, {2}, {3} (Reihenfolge in "options"), nie mit a/b/c.

AUSGABE
Gib NUR eine JSON-Datei (herunterladbar, Name teil.json) in genau diesem Format aus:
{
  "format": "deutschflow-teil-v1",
  "exam": "TELC", "level": "B1", "section": "LESEN", "teil": 2,
  "theme": "Gesundheit",
  "source": {"title": "…", "author": "…", "publisher": "…", "publishedAt": "2026", "url": "https://…", "license": "CC BY 4.0"},
  "facts": ["Fakt 1 in eigenen Worten", "Fakt 2 …"],
  "text": {
    "titleDe": "…", "vorspannDe": "…",
    "paragraphs": ["Absatz 1 …", "Absatz 2 …"],
    "glossary": [{"term": "vorbeugend", "explanationDe": "so, dass ein Problem gar nicht erst entsteht"}]
  },
  "items": [
    {"difficulty": "EASY", "question": "Am Wochenende …",
     "options": [{"text": "…", "correct": true, "trap": null}, {"text": "…", "correct": false, "trap": "Fallenregel"}, {"text": "…", "correct": false, "trap": "Fallenregel"}],
     "evidence": "…", "explanationVi": "{1} đúng vì …; {2} sai vì …; {3} sai vì …"}
  ]
}
"theme" ist eines von: Arbeit, Wohnen, Gesundheit, Bildung, Verkehr, Reisen, Einkaufen, Technik im Alltag, Sport, Essen und Trinken. "license" genau so, wie sie in der Quelle steht (oder null).

QUELLARTIKEL:
`

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  onImported: (draft: StudioDraft) => void
}

/** Nhập một Teil soạn ngoài hệ thống: chép prompt mẫu cho Claude, rồi tải tệp JSON Claude trả về. */
export function ImportTeilModal({ open, onOpenChange, onImported }: Props) {
  const t = useTranslations('v2.adminContent.examStudio')
  const tc = useTranslations('v2.common')
  const [file, setFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const tooLarge = file != null && file.size > IMPORT_MAX_BYTES

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(IMPORT_PROMPT_TEMPLATE)
      toast.success(t('import.copied'))
    } catch {
      toast.error(t('import.copyFailed'))
    }
  }

  const submit = async () => {
    if (!file || tooLarge) return
    setSaving(true)
    try {
      const d = await importDraft(file)
      toast.success(t('import.done'))
      setFile(null)
      onImported(d)
    } catch (e) {
      toast.error(apiMessage(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <TkModal
      open={open}
      onOpenChange={onOpenChange}
      title={t('import.title')}
      footer={
        <>
          <GaBtn variant="ghost" size="sm" onClick={() => onOpenChange(false)}>{tc('cancel')}</GaBtn>
          <GaBtn variant="yellow" size="sm" loading={saving} disabled={!file || tooLarge} onClick={submit}>
            <Upload size={14} aria-hidden /> {t('import.submit')}
          </GaBtn>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="ga-ui text-ga-small text-ga-muted">{t('import.lead')}</p>
        <div>
          <GaBtn variant="ghost" size="sm" onClick={copy}>
            <Copy size={14} aria-hidden /> {t('import.copyPrompt')}
          </GaBtn>
        </div>
        <div>
          <label htmlFor="import-file" className="mb-1.5 block"><GaCap>{t('import.file')}</GaCap></label>
          <input
            id="import-file"
            type="file"
            accept=".json,application/json"
            className={cn(studioField, 'file:mr-3 file:cursor-pointer file:border-0 file:bg-transparent file:font-medium')}
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
          {tooLarge && <p role="alert" className="ga-ui mt-2 text-ga-caption font-semibold text-ga-red">{t('source.fileTooLarge')}</p>}
        </div>
        <p className="ga-ui text-ga-caption text-ga-muted">{t('import.scope')}</p>
      </div>
    </TkModal>
  )
}
