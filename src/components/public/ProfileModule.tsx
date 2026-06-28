import type { ReactNode } from "react";
import { Card, CardHeader, CardBody } from "@/components/ui/Card";

type ProfileModuleProps = {
  title: string;
  eyebrow?: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  id?: string;
};

/**
 * Profile modules share the single Card shell so the whole profile reads as one
 * cohesive analytics product (same shell, spacing rhythm, and typographic voice).
 */
export function ProfileModule({ title, eyebrow, description, action, children, className = "", bodyClassName = "", id }: ProfileModuleProps) {
  return (
    <Card id={id} className={className}>
      <CardHeader title={title} eyebrow={eyebrow} description={description} action={action} />
      <CardBody className={bodyClassName}>{children}</CardBody>
    </Card>
  );
}
