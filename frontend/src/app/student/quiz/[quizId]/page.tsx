import ClientPage from './client-page'

export function generateStaticParams() {
  return [{ quizId: '_placeholder' }]
}

export default function Page() {
  return <ClientPage />
}
