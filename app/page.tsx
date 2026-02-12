import dynamic from 'next/dynamic';

const SituationMonitorApp = dynamic(() => import('@/components/SituationMonitorApp'), {
  ssr: false
});

export default function Page() {
  return <SituationMonitorApp />;
}
