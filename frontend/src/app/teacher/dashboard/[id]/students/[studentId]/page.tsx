import ClientPage from './client-page'

export function generateStaticParams() {
  return [{ id: '_placeholder', studentId: '_placeholder' }]
}

export default function Page() {
  return <ClientPage />
}
