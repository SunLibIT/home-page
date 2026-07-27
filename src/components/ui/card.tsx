import React from "react";

/**
 * MOCK minimaliste du <Card> shadcn fourni par Softr.
 * Dans Softr, le vrai Card a des styles par défaut (flex flex-col gap-6 + py-6).
 * Ici on ne met AUCUN style : tout vient de Block.tsx (le style CARD force
 * display:block + padding:0 pour neutraliser ces défauts en prod).
 */
type DivProps = React.HTMLAttributes<HTMLDivElement>;

export function Card({ children, ...props }: DivProps) {
  return <div {...props}>{children}</div>;
}
export function CardHeader({ children, ...props }: DivProps) {
  return <div {...props}>{children}</div>;
}
export function CardTitle({ children, ...props }: DivProps) {
  return <div {...props}>{children}</div>;
}
export function CardDescription({ children, ...props }: DivProps) {
  return <div {...props}>{children}</div>;
}
export function CardContent({ children, ...props }: DivProps) {
  return <div {...props}>{children}</div>;
}
export function CardFooter({ children, ...props }: DivProps) {
  return <div {...props}>{children}</div>;
}

export default Card;
