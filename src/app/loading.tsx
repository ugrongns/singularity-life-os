import PageLoadingState from '@/components/ui/PageLoadingState';

export default function Loading() {
  return (
    <PageLoadingState
      icon="🌌"
      title="Singularity Life OS Başlatılıyor..."
      description="Çekirdek modüller, güvenlik kalkanı ve yerel veriler senkronize ediliyor"
      color="#3B82F6"
      fullScreen={true}
    />
  );
}
