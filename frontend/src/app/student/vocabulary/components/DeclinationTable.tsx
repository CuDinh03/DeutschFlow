import type { DeclensionsDto } from './types'

const CASES = [
  { label: 'Nom', singularKey: 'nomSingular', pluralKey: 'nomPlural' },
  { label: 'Akk', singularKey: 'accSingular', pluralKey: 'accPlural' },
  { label: 'Dat', singularKey: 'datSingular', pluralKey: 'datPlural' },
  { label: 'Gen', singularKey: 'genSingular', pluralKey: 'genPlural' },
] as const

export default function DeclinationTable({ declensions }: { declensions: DeclensionsDto }) {
  return (
    <div className="rounded-xl border border-slate-200 overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-slate-50 border-b border-slate-200">
            <th className="px-3 py-2 text-left text-[11px] font-bold uppercase tracking-widest text-slate-500 w-12">Fall</th>
            <th className="px-3 py-2 text-left text-[11px] font-bold uppercase tracking-widest text-slate-500">Singular</th>
            <th className="px-3 py-2 text-left text-[11px] font-bold uppercase tracking-widest text-slate-500">Plural</th>
          </tr>
        </thead>
        <tbody>
          {CASES.map(({ label, singularKey, pluralKey }, i) => (
            <tr key={label} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
              <td className="px-3 py-2.5 font-bold text-[11px] text-slate-400 uppercase tracking-wider">{label}</td>
              <td className="px-3 py-2.5 font-semibold text-slate-800">{declensions[singularKey]}</td>
              <td className="px-3 py-2.5 text-slate-600">{declensions[pluralKey]}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {declensions.pluralForm ? (
        <div className="px-3 py-2 bg-indigo-50 border-t border-indigo-100">
          <span className="text-[11px] text-indigo-600 font-semibold">Plural: </span>
          <span className="text-[11px] text-indigo-800">{declensions.pluralForm}</span>
        </div>
      ) : null}
    </div>
  )
}
