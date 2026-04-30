import { useState } from 'react';
import { Section, Cell, Spinner, Button, Subheadline, Title } from '@telegram-apps/telegram-ui';
import { useSellerProducts } from '@/api/seller';
import type { ProductItem } from '@/api/types';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';

export function ProductsScreen() {
  const [page, setPage] = useState(0);
  const { data, isLoading, isError, error, refetch, isFetching } = useSellerProducts({
    page,
    limit: 10,
    filter: 'active',
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Spinner size="l" />
      </div>
    );
  }

  if (isError) {
    return <ErrorState error={error} onRetry={() => refetch()} />;
  }

  if (!data || data.total === 0) {
    return <EmptyState />;
  }

  return (
    <div className="pb-4">
      <div className="px-4 pt-4 pb-2">
        <Title level="2" weight="2">📦 Mening mahsulotlarim</Title>
        <Subheadline level="2" className="text-tg-hint">
          {data.total} ta · Sahifa {data.page + 1}/{data.pages}
        </Subheadline>
      </div>

      <Section>
        {data.items.map((item) => (
          <ProductCell key={item.id} item={item} />
        ))}
      </Section>

      {/* Pagination — sodda ◀️ ▶️ tugmalar */}
      {data.pages > 1 && (
        <div className="flex items-center justify-center gap-3 px-4 mt-4">
          <Button
            size="s"
            mode="bezeled"
            disabled={page === 0 || isFetching}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
          >
            ◀️ Oldingi
          </Button>
          <span className="text-tg-hint text-sm">
            {data.page + 1} / {data.pages}
          </span>
          <Button
            size="s"
            mode="bezeled"
            disabled={!data.has_next || isFetching}
            onClick={() => setPage((p) => p + 1)}
          >
            Keyingi ▶️
          </Button>
        </div>
      )}
    </div>
  );
}

interface CellProps {
  item: ProductItem;
}

function ProductCell({ item }: CellProps) {
  const subtitleParts: string[] = [];
  if (item.is_billz_draft) {
    subtitleParts.push(`${item.price_short} · ⏸ Yoqilmagan`);
  } else if (item.status_label === 'Aktiv') {
    subtitleParts.push(`${item.price_short} · 👥${item.count}/${item.min_group}`);
  } else {
    subtitleParts.push(`${item.status_emoji} ${item.status_label}`);
  }
  if (item.mxik_missing) {
    subtitleParts.push('⚠️ MXIK yo\'q');
  }
  const subtitle = subtitleParts.join(' · ');

  return (
    <Cell
      before={<ProductPhoto src={item.photo_url} />}
      subtitle={subtitle}
      multiline
    >
      {item.name}
    </Cell>
  );
}

function ProductPhoto({ src }: { src: string }) {
  if (!src) {
    return (
      <div
        className="bg-tg-secondary-bg rounded-lg flex items-center justify-center"
        style={{ width: 56, height: 56, fontSize: 28 }}
      >
        📦
      </div>
    );
  }
  return (
    <img
      src={src}
      alt=""
      style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 8 }}
      loading="lazy"
      onError={(e) => {
        (e.currentTarget as HTMLImageElement).style.display = 'none';
      }}
    />
  );
}
