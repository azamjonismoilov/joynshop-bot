import {
  RiCheckboxCircleFill,
  RiCloseCircleFill,
  RiForbidFill,
  RiLoader4Fill,
  RiTimeFill,
} from '@remixicon/react';
import type { ComponentType } from 'react';
import type { OrderStatus } from '@/api/types';

type IconComponent = ComponentType<{ size?: number | string; className?: string }>;

/**
 * Status banner uchun Wallet-style metadata.
 * Backend status_icon (emoji) ishlatilmaydi — bu yerda icon component
 * va kuchli rang bilan o'rnatiladi. Pattern OrderDetail/OrderCard'da
 * bir xil ishlatiladi.
 */
export interface StatusMeta {
  /** Icon component — solid Fill style */
  Icon:  IconComponent;
  /** Banner foni — kuchli rang (Wallet pattern) */
  bg:    string;
  /** Soft glow — bg rangiga moslangan box-shadow */
  glow:  string;
}

export const STATUS_META: Record<OrderStatus, StatusMeta> = {
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
