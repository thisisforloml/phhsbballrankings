import type { ReactNode } from "react";

import { SectionHeader } from "@/components/public/SectionHeader";

type PageBandProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
};

export function PageBand({ eyebrow, title, description, action, className = "" }: PageBandProps) {
  return (
    <section className={`border-b border-line-500 bg-court-900 py-6 text-white ${className}`}>
      <div className="container-px">
        <SectionHeader
          eyebrow={eyebrow}
          title={title}
          description={description}
          action={action}
          dark
          variant="content"
        />
      </div>
    </section>
  );
}
