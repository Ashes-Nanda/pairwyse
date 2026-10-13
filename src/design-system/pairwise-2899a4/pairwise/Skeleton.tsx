import { forwardRef,type HTMLAttributes } from 'react';import { cn } from './utils';
export interface SkeletonProps extends HTMLAttributes<HTMLDivElement>{ variant?:'block'|'text'|'avatar'; }
/** Loading geometry; announce the loading state on the surrounding region. */
export const Skeleton=forwardRef<HTMLDivElement,SkeletonProps>(function Skeleton({variant='block',className,...props},ref){return <div ref={ref} aria-hidden="true" className={cn('pw-skeleton',`pw-skeleton--${variant}`,className)} {...props}/>});
