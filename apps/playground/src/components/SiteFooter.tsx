import { trackCta } from "../analytics";
import { FOOTER_LINKS } from "../links";
import { footerClassName } from "../ui";

type SiteFooterProps = {
  label: string;
};

export function SiteFooter({ label }: SiteFooterProps) {
  return (
    <footer className={footerClassName}>
      <span>{label}</span>
      <a
        className="text-[#75cbd3] no-underline transition hover:text-[#dcecef]"
        href={FOOTER_LINKS.author}
        onClick={() => trackCta("open_author", FOOTER_LINKS.author)}
        rel="noreferrer"
        target="_blank"
      >
        Eric Chen
      </a>
    </footer>
  );
}
