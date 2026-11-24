import type { ReactNode } from "react";
import {
  eyebrowClassName,
  pageHeadingStatusClassName,
  pageHeadingTitleClassName,
  pageHeadingWrapClassName,
} from "../ui";

export function PageHeading({
  id,
  eyebrow,
  title,
  description,
}: {
  id: string;
  eyebrow: string;
  title: ReactNode;
  description?: ReactNode;
}) {
  return (
    <div className={pageHeadingWrapClassName}>
      <div>
        <p className={eyebrowClassName}>{eyebrow}</p>
        <h1 className={pageHeadingTitleClassName} id={id}>
          {title}
        </h1>
      </div>
      {description != null && description !== "" ? (
        <p className={pageHeadingStatusClassName}>{description}</p>
      ) : null}
    </div>
  );
}
