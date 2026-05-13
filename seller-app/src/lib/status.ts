import {
  RiCheckboxCircleFill,
  RiCloseCircleFill,
  RiDraftFill,
  RiForbidFill,
  RiLoader4Fill,
  RiTimeFill,
} from '@remixicon/react';
import type { ComponentType } from 'react';
import type { OrderStatus, ProductStatusKey } from '@/api/types';

type IconComponent = ComponentType<{ size?: number | string; className?: string }>;

/**
 * Status banner uchun Wallet-style metadata.
 * Backend status_emoji ishlatilmaydi — bu yerda icon component
 * va kuchli rang bilan o'rnatiladi. Pattern OrderDetail/OrderCard
 * va ProductDetail status badge'da bir xil ishlatiladi.
 */
export interface StatusMeta {
  Icon: IconComponent;
  bg:   string;
  glow: string;
}

export const ORDER_STATUS_META: Record<OrderStatus, StatusMeta> = {
  pending: {
    Icon: RiTimeFill,
    bg:   '#F6B51E',                       // --color-warning
    glow: 'rgba(246, 181, 30, 0.18)',
  },
  confirming: {
    Icon: RiLoader4Fill,
    bg:   '#335CFF',                       // --color-secondary
    glow: 'rgba(51, 92, 255, 0.18)',
  },
  confirmed: {
    Icon: RiCheckboxCircleFill,
    bg:   '#1FC16B',                       // --color-success
    glow: 'rgba(31, 193, 107, 0.18)',
  },
  rejected: {
    Icon: RiCloseCircleFill,
    bg:   '#FB3748',                       // --color-danger
    glow: 'rgba(251, 55, 72, 0.18)',
  },
  cancelled: {
    Icon: RiForbidFill,
    bg:   '#71717A',                       // --color-neutral-500
    glow: 'rgba(113, 113, 122, 0.15)',
  },
};

export const PRODUCT_STATUS_META: Record<ProductStatusKey, StatusMeta> = {
  active: {
    Icon: RiCheckboxCircleFill,
    bg:   '#1FC16B',
    glow: 'rgba(31, 193, 107, 0.18)',
  },
  closed: {
    Icon: RiForbidFill,
    bg:   '#71717A',
    glow: 'rgba(113, 113, 122, 0.15)',
  },
  draft: {
    Icon: RiDraftFill,
    bg:   '#FA7319',                       // --color-brand
    glow: 'rgba(250, 115, 25, 0.18)',
  },
};
