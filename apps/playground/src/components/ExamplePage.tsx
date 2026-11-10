import type { ReactNode } from "react";
import {
  pageHeadingStatusClassName,
  pageHeadingTitleClassName,
  pageHeadingWrapClassName,
  pageSectionClassName,
  shellClassName,
} from "../ui";
import { SiteHeader } from "./SiteHeader";
import { SiteFooter } from "./SiteFooter";

export function ExamplePage({
  title,
  description,
  children,
}: {
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
        <div className={pageHeadingWrapClassName}>
          <h1 className={pageHeadingTitleClassName} id="example-title">
            {title}
          </h1>
          <p className={pageHeadingStatusClassName}>{description}</p>
        </div>
        {children}
      </section>
      <SiteFooter label={`@ericchen1990/pano-view · ${title}`} />
    </main>
  );
}
