import { usePlaygroundLanguage } from "../i18n/language";
import { RelatedExamples } from "./RelatedExamples";
import { trackCta } from "../analytics";
import { AI_DOC_PATHS, FOOTER_LINKS } from "../links";
import { footerClassName } from "../ui";

type SiteFooterProps = {
  label: string;
};

export function SiteFooter({ label }: SiteFooterProps) {
  const { locale, t } = usePlaygroundLanguage();
  const linkClassName = "text-[#75cbd3] no-underline transition hover:text-[#dcecef]";
  return (
    <>
      <RelatedExamples />
      <footer className={footerClassName}>
        <span>{t(label)}</span>
        <div className="flex gap-4">
          <a className={linkClassName} href={AI_DOC_PATHS[locale]}>
            {t("AI documentation")}
          </a>
          <a
            className={linkClassName}
            href={FOOTER_LINKS.author}
            onClick={() => trackCta("open_author", FOOTER_LINKS.author)}
            rel="noreferrer"
            target="_blank"
          >
            Eric Chen
          </a>
        </div>
      </footer>
    </>
  );
}
