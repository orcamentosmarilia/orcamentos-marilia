import React from "react";

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}

export default function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <div className="mb-8 flex items-start justify-between gap-4">
      <div>
        <h1 className="font-lora text-[32px] font-bold text-[#5C1F2E] tracking-tight leading-tight">{title}</h1>
        {description && <p className="font-dm text-rose-400 text-sm mt-1.5">{description}</p>}
      </div>
      {actions && <div className="flex-shrink-0 flex items-center gap-3">{actions}</div>}
    </div>
  );
}
