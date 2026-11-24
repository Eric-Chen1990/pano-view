import type { ReactNode } from "react";
import { pageSectionClassName, shellClassName } from "../ui";
import { PageHeading } from "./PageHeading";
import { SiteHeader } from "./SiteHeader";
import { SiteFooter } from "./SiteFooter";

export function ExamplePage({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <main className={shellClassName}>
      <SiteHeader />
      <section
        className={`${pageSectionClassName} mt-8`}
        aria-labelledby="example-title"
      >
        <PageHeading
          id="example-title"
          eyebrow={eyebrow}
          title={title}
          description={description}
        />
        {children}
      </section>
      <SiteFooter label={`@ericchen1990/pano-view · ${title}`} />
    </main>
  );
}
