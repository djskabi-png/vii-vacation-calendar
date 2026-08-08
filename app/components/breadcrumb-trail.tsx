import Link from "next/link";

export type BreadcrumbTrailItem = {
  name: string;
  path?: string;
};

export function BreadcrumbTrail({ items, className = "" }: { items: BreadcrumbTrailItem[]; className?: string }) {
  return (
    <nav className={`shell breadcrumbs ${className}`.trim()} aria-label="פירורי לחם">
      {items.map((item, index) => {
        const current = index === items.length - 1;
        return (
          <span className="breadcrumbs__item" key={`${item.name}-${index}`}>
            {index > 0 ? <span className="breadcrumbs__separator" aria-hidden="true">/</span> : null}
            {!current && item.path ? <Link href={item.path}>{item.name}</Link> : <span aria-current={current ? "page" : undefined}>{item.name}</span>}
          </span>
        );
      })}
    </nav>
  );
}
