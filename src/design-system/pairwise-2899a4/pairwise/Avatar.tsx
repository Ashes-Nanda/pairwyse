import { forwardRef,type HTMLAttributes } from 'react';
import { cn } from './utils';
export interface AvatarProps extends HTMLAttributes<HTMLSpanElement>{ name:string; src?:string; tone?:'pink'|'blue'|'yellow'; size?:'sm'|'md'|'lg'; }
/** Participant identity with an initials fallback; mascot colors do not imply compatibility. */
export const Avatar=forwardRef<HTMLSpanElement,AvatarProps>(function Avatar({name,src,tone='pink',size='md',className,children,...props},ref){return <span ref={ref} role="img" aria-label={name} className={cn('pw-avatar',`pw-avatar--${tone}`,`pw-avatar--${size}`,className)} {...props}>{children ?? (src ? <img src={src} alt=""/> : name.split(' ').map(p=>p[0]).slice(0,2).join(''))}</span>});
