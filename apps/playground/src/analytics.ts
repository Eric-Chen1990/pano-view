import { track } from "@vercel/analytics";

type UTMContext = {
  source_path: string;
  utm_source?: string;
  utm_campaign?: string;
};

function getUTMContext(): UTMContext {
  const search = new URLSearchParams(window.location.search);

  return {
    source_path: window.location.pathname,
    utm_source: search.get("utm_source") ?? undefined,
    utm_campaign: search.get("utm_campaign") ?? undefined,
  };
}

export function trackCta(cta: string, destination: string) {
  track("pano_view_cta_clicked", {
    ...getUTMContext(),
    cta,
    destination,
  });
}

export function trackDemoOpened(demo: string) {
  track("pano_view_demo_opened", {
    ...getUTMContext(),
    demo,
  });
}

export function trackInstallCopied(packageManager: string) {
  track("pano_view_install_copied", {
    ...getUTMContext(),
    package_manager: packageManager,
  });
}
