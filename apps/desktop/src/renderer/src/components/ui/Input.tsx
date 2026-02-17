import React from 'react';
import { cx } from './cx';

export interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  tone?: 'default' | 'danger' | 'success';
  size?: 'sm' | 'md' | 'lg';
}

const toneClass: Record<NonNullable<InputProps['tone']>, string> = {
  default: '',
  danger: 'field-input-danger',
  success: 'field-input-success',
};

const sizeClass: Record<NonNullable<InputProps['size']>, string> = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2 text-sm',
  lg: 'px-4 py-2.5 text-sm',
};

export const Input: React.FC<InputProps> = ({
  tone = 'default',
  size = 'md',
  className,
  ...rest
}: InputProps) => {
  return (
    <input {...rest} className={cx('field-input', toneClass[tone], sizeClass[size], className)} />
  );
};
