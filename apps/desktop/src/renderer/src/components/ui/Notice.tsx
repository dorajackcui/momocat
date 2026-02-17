import React from 'react';
import { cx } from './cx';

export interface NoticeProps extends React.HTMLAttributes<HTMLDivElement> {
  tone?: 'success' | 'warning' | 'danger' | 'info';
}

const toneClass: Record<NonNullable<NoticeProps['tone']>, string> = {
  success: 'notice-success',
  warning: 'notice-warning',
  danger: 'notice-danger',
  info: 'notice-info',
};

export const Notice: React.FC<NoticeProps> = ({
  tone = 'info',
  className,
  children,
  ...rest
}: NoticeProps) => {
  return (
    <div {...rest} className={cx('notice', toneClass[tone], className)}>
      {children}
    </div>
  );
};
