import ClientPage from './client-page'

export function generateStaticParams() {
  return [{ nodeId: '_placeholder', skill: '_placeholder' }]
}

export default function Page() {
  return <ClientPage />
}
