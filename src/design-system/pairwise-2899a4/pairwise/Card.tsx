import { forwardRef,type HTMLAttributes } from 'react';
import { cn } from './utils';
export interface CardProps extends HTMLAttributes<HTMLDivElement>{ variant?:'flat'|'raised'|'soft'; }
/** Frame a repeated content item, not a whole page section. */
export const Card=forwardRef<HTMLDivElement,CardProps>(function Card({variant='flat',className,...props},ref){return <div ref={ref} className={cn('pw-card',`pw-card--${variant}`,className)} {...props}/>});
