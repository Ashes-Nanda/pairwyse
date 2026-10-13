import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from './utils';
import { Icon } from './Icon';
export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> { variant?: 'primary'|'secondary'|'agent'|'ghost'|'danger'; size?: 'sm'|'md'|'lg'|'icon'; loading?: boolean; }
/** A single primary action per screen; secondary and agent variants establish hierarchy. */
export const Button=forwardRef<HTMLButtonElement,ButtonProps>(function Button({variant='primary',size='md',loading=false,disabled,children,className,type='button',...props},ref){return <button ref={ref} type={type} disabled={disabled || loading} aria-busy={loading} className={cn('pw-button',`pw-button--${variant}`,`pw-button--${size}`,className)} {...props}>{loading && <Icon name="loading" className="pw-spin"/>}{children}</button>});
