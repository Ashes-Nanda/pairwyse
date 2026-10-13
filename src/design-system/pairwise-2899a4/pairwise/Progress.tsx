import { forwardRef,type ProgressHTMLAttributes } from 'react';
import { cn } from './utils';
export interface ProgressProps extends ProgressHTMLAttributes<HTMLProgressElement>{ label:string; value:number; }
/** Determinate progress derived from supplied work state, never a simulated timer. */
export const Progress=forwardRef<HTMLProgressElement,ProgressProps>(function Progress({label,value,max=100,className,...props},ref){return <progress ref={ref} aria-label={label} value={Math.max(0,Math.min(value,Number(max)))} max={max} className={cn('pw-progress',className)} {...props}/>});
