import React from 'react';
import { cx } from './cx';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  tone?: 'default' | 'danger' | 'success';
  size?: 'sm' | 'md' | 'lg';
}

const toneClass: Record<NonNullable<TextareaProps['tone']>, string> = {
  default: '',
  danger: 'field-input-danger',
  success: 'field-input-success',
};

const sizeClass: Record<NonNullable<TextareaProps['size']>, string> = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2 text-sm',
  lg: 'px-4 py-2.5 text-sm',
};

export const Textarea: React.FC<TextareaProps> = ({
  tone = 'default',
  size = 'md',
  className,
  ...rest
}: TextareaProps) => {
  return (
    <textarea
      {...rest}
      className={cx('field-input', toneClass[tone], sizeClass[size], className)}
    />
  );
};
