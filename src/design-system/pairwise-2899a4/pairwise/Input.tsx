import { forwardRef, useId, type InputHTMLAttributes } from 'react';
import { cn } from './utils';
export interface InputProps extends InputHTMLAttributes<HTMLInputElement> { label:string; hint?:string; error?:string; }
/** A visible label and associated hint or error for every source URL. */
export const Input=forwardRef<HTMLInputElement,InputProps>(function Input({label,hint,error,id,className,...props},ref){const generated=useId();const inputId=id ?? generated;const message=error ?? hint;return <div className="pw-field"><label className="pw-label" htmlFor={inputId}>{label}</label><input ref={ref} id={inputId} aria-invalid={error ? true : undefined} aria-describedby={message ? `${inputId}-message`:undefined} className={cn('pw-input',className)} {...props}/>{message && <span id={`${inputId}-message`} className={cn('pw-field-message',error && 'pw-field-message--error')} role={error ? 'alert':undefined}>{message}</span>}</div>});
