import React from 'react';
import { cx } from './cx';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'surface' | 'subtle' | 'danger';
  interactive?: boolean;
}

const variantClass: Record<NonNullable<CardProps['variant']>, string> = {
  surface: 'surface-card',
  subtle: 'surface-subtle',
  danger: 'surface-danger',
};

export const Card: React.FC<CardProps> = ({
  variant = 'surface',
  interactive = false,
  className,
  children,
  ...rest
}: CardProps) => {
  return (
    <div
      {...rest}
      className={cx(
        variantClass[variant],
        interactive && 'transition-all duration-200 hover:-translate-y-0.5 hover:shadow-float',
        className,
      )}
    >
      {children}
    </div>
  );
};
