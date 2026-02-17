import React from 'react';
import { cx } from './cx';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: 'brand' | 'success' | 'warning' | 'danger' | 'neutral' | 'info';
}

const toneClass: Record<NonNullable<BadgeProps['tone']>, string> = {
  brand: 'badge-brand',
  success: 'badge-success',
  warning: 'badge-warning',
  danger: 'badge-danger',
  neutral: 'badge-neutral',
  info: 'badge-info',
};

export const Badge: React.FC<BadgeProps> = ({
  tone = 'neutral',
  className,
  children,
  ...rest
}: BadgeProps) => {
  return (
    <span {...rest} className={cx('badge', toneClass[tone], className)}>
      {children}
    </span>
  );
};
