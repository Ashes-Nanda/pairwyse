import { forwardRef, type HTMLAttributes } from 'react';
import { Icon, type IconProps } from './Icon';
import { cn } from './utils';
export type Status='pending'|'running'|'completed'|'partial'|'failed'|'insufficient';
export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> { status?:Status; }
const labels:Record<Status,string>={pending:'Pending',running:'Running',completed:'Completed',partial:'Partial evidence',failed:'Failed',insufficient:'Insufficient evidence'};
const icons:Record<Status,IconProps['name']>={pending:'clock',running:'activity',completed:'completed',partial:'alert',failed:'alert',insufficient:'search'};
/** Readable status plus a symbol; never depend on color alone. */
export const Badge=forwardRef<HTMLSpanElement,BadgeProps>(function Badge({status='pending',children,className,...props},ref){return <span ref={ref} className={cn('pw-badge',`pw-badge--${status}`,className)} {...props}><Icon name={icons[status]} size="sm"/>{children ?? labels[status]}</span>});
