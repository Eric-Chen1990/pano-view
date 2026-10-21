const GITHUB_REPO = "https://github.com/Eric-Chen1990/pano-view";
const NPM_PACKAGE = "https://www.npmjs.com/package/@ericchen1990/pano-view";
const AUTHOR_PROFILE = "https://github.com/Eric-Chen1990";

type UtmOptions = {
  campaign: string;
  content: string;
};

function withUtm(baseUrl: string, { campaign, content }: UtmOptions): string {
  const url = new URL(baseUrl);
  url.searchParams.set("utm_source", "playground");
  url.searchParams.set("utm_medium", "product");
  url.searchParams.set("utm_campaign", campaign);
  url.searchParams.set("utm_content", content);
  return url.toString();
}

export const PROJECT_LINKS = {
  github: GITHUB_REPO,
  npm: NPM_PACKAGE,
  author: AUTHOR_PROFILE,
  docs: {
    krpanoGuide: `${GITHUB_REPO}/blob/main/docs/krpano-migration.md`,
    krpanoGuideChinese: `${GITHUB_REPO}/blob/main/docs/krpano-migration.zh-CN.md`,
    videoGuide: `${GITHUB_REPO}/blob/main/docs/react-360-video.md`,
    videoGuideChinese: `${GITHUB_REPO}/blob/main/docs/react-360-video.zh-CN.md`,
  },
} as const;

export const HEADER_LINKS = {
  github: withUtm(GITHUB_REPO, { campaign: "site-header", content: "github" }),
  npm: withUtm(NPM_PACKAGE, { campaign: "site-header", content: "npm" }),
} as const;

export const FOOTER_LINKS = {
  author: withUtm(AUTHOR_PROFILE, { campaign: "site-footer", content: "author" }),
} as const;

export const LANDING_LINKS = {
  github: withUtm(GITHUB_REPO, { campaign: "landing-page", content: "github" }),
  npm: withUtm(NPM_PACKAGE, { campaign: "landing-page", content: "npm" }),
  krpanoGuide: withUtm(PROJECT_LINKS.docs.krpanoGuide, {
    campaign: "landing-page",
    content: "krpano-guide",
  }),
  krpanoGuideChinese: withUtm(PROJECT_LINKS.docs.krpanoGuideChinese, {
    campaign: "landing-page",
    content: "krpano-guide-zh",
  }),
  videoGuide: withUtm(PROJECT_LINKS.docs.videoGuide, {
    campaign: "landing-page",
    content: "video-guide",
  }),
  videoGuideChinese: withUtm(PROJECT_LINKS.docs.videoGuideChinese, {
    campaign: "landing-page",
    content: "video-guide-zh",
  }),
} as const;
