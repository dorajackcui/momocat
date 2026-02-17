import React from 'react';
import { cx } from './cx';

export interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'size'> {
  tone?: 'default' | 'danger' | 'success';
  size?: 'sm' | 'md' | 'lg';
}

const toneClass: Record<NonNullable<SelectProps['tone']>, string> = {
  default: '',
  danger: 'field-input-danger',
  success: 'field-input-success',
};

const sizeClass: Record<NonNullable<SelectProps['size']>, string> = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2 text-sm',
  lg: 'px-4 py-2.5 text-sm',
};

export const Select: React.FC<SelectProps> = ({
  tone = 'default',
  size = 'md',
  className,
  children,
  ...rest
}: SelectProps) => {
  return (
    <select {...rest} className={cx('field-input', toneClass[tone], sizeClass[size], className)}>
      {children}
    </select>
  );
};
