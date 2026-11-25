export const shellClassName =
  "mx-auto w-[min(1560px,calc(100%-40px))] px-0 pt-[22px] pb-8 text-[#e7f2f5] max-[760px]:w-[min(1560px,calc(100%-24px))] max-[760px]:pt-3.5";

export const footerClassName =
  "flex items-center justify-between pt-[33px] font-mono text-[0.7rem] tracking-[0.08em] text-[#769198] max-[760px]:items-start max-[760px]:flex-col max-[760px]:gap-2";

export const monoLabelClassName =
  "font-mono text-[0.67rem] tracking-[0.08em] text-[#df6b42] uppercase";

export const panelLabelClassName =
  "font-mono text-[0.67rem] tracking-[0.08em] text-[#df6b42] uppercase";

export const eyebrowClassName = panelLabelClassName;

export const pageSectionClassName =
  "border border-[#1a3137] bg-[#081619]/70";

export const pageHeadingWrapClassName =
  "flex items-end justify-between gap-6 border-b border-[#244047] p-6 max-[760px]:flex-col max-[760px]:items-start";

export const landingHeroTitleClassName =
  "m-0 mt-4 max-w-[16ch] text-[clamp(2.25rem,4.5vw,3.5rem)] leading-tight font-extrabold tracking-tight text-[#f5fbfc]";

export const sectionHeadingTitleClassName =
  "m-0 text-[clamp(1.75rem,2.5vw,2.25rem)] leading-tight font-bold text-[#f5fbfc]";

export const pageHeadingTitleClassName =
  "m-0 text-2xl leading-tight font-bold text-[#f5fbfc] sm:text-3xl";

export const pageHeadingStatusClassName =
  "m-0 max-w-[36rem] text-sm leading-6 text-[#9ab1b7]";

export const pageControlsClassName =
  "flex flex-wrap items-end gap-4 border-b border-[#244047] px-6 py-4";

/** Shared height for ordinary Playground panorama demos. */
export const playgroundViewerHeight = "clamp(420px, 68dvh, 640px)";

/** Shared height for editor-style Playground workspaces. */
export const playgroundWorkspaceHeight = "clamp(660px, 85dvh, 900px)";

export const playgroundViewerHeightClassName =
  "h-[clamp(420px,68dvh,640px)]";

export const playgroundWorkspaceHeightClassName =
  "h-[clamp(660px,85dvh,900px)]";

/** Viewer + controls split: keep both columns at the shared viewer height. */
export const playgroundSplitDemoClassName =
  "grid lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start";

export const playgroundSplitSidebarClassName =
  "grid content-start gap-4 border-t border-[#244047] p-5 lg:h-[clamp(420px,68dvh,640px)] lg:overflow-y-auto lg:border-t-0 lg:border-l";

const segmentedButtonLayoutClassName =
  "inline-flex min-h-9 items-center justify-center border border-[#3e6c73] px-3 py-2 text-[0.72rem] font-medium text-[#f5fbfc] transition hover:border-[#75cbd3]";

export const segmentedButtonClassName = `${segmentedButtonLayoutClassName} bg-transparent aria-pressed:border-brand aria-pressed:bg-brand`;

export const viewerChromeButtonClassName = `${segmentedButtonLayoutClassName} bg-[#081619]/75`;

export const segmentedButtonActiveClassName =
  "border-[#df6b42] bg-[#df6b42] text-white";

export const segmentedControlClassName =
  "inline-flex divide-x divide-[#3e6c73] border border-[#3e6c73]";

export const segmentedControlOptionClassName =
  "inline-flex min-h-9 items-center justify-center px-3.5 py-2 text-[0.72rem] font-medium transition";

export const toggleControlClassName =
  "inline-flex min-h-9 items-center gap-2.5 border border-[#3e6c73] bg-transparent px-3 py-2 text-[0.72rem] font-medium text-[#f5fbfc] transition hover:border-[#75cbd3]";

export const toggleTrackClassName =
  "relative h-[18px] w-8 shrink-0 border border-[#3e6c73] bg-[#08191d] transition-colors";

export const toggleTrackOnClassName = "border-[#75cbd3] bg-[#75cbd3]";

export const toggleThumbClassName =
  "absolute top-px left-px h-3.5 w-3.5 bg-[#dbeef0] transition-transform motion-reduce:transition-none";

export const toggleThumbOnClassName = "translate-x-[14px] bg-white";

export const controlLabelClassName =
  "grid gap-1.5 text-[0.7rem] uppercase tracking-[0.08em] text-[#88a6ac]";

export const controlInputClassName =
  "min-w-0 border border-[#38545b] bg-[#08191d] px-2 py-2 text-[0.78rem] text-[#e7f2f5] outline-none";

export const cardClassName =
  "border border-[#244047] bg-[#071316]/80";

export const toolButtonClassName =
  "grid w-full gap-1.5 border border-[#244047] bg-transparent px-3 py-3 text-left transition hover:border-[#75cbd3] hover:bg-[#102b31]";

export const toolButtonActiveClassName =
  "border-[#df6b42] bg-[#102b31] shadow-[inset_3px_0_0_0_#df6b42]";

export const fieldClassName = "grid gap-1.5";
export const fieldWideClassName = `${fieldClassName} col-span-full`;
export const fieldGridClassName =
  "grid grid-cols-2 gap-2.5 max-[760px]:grid-cols-1";
export const fieldLabelClassName = "text-[0.67rem] text-[#88a6ac]";
export const fieldInputClassName =
  "w-full min-w-0 border border-[#38545b] bg-[#08191d] px-2 py-2 text-[0.74rem] text-[#e7f2f5] outline-none";
export const fieldOutputClassName =
  "block min-h-[34px] w-full border border-[#38545b] bg-[#08191d] px-2 py-2 font-mono text-[0.74rem] text-[#dcecef]";
export const mediaActionClassName =
  "border border-[#3e6c73] bg-[#102b31] px-2.5 py-2 text-left text-[0.71rem] text-[#f5fbfc] transition hover:border-[#75cbd3]";
export const deleteButtonClassName =
  "border border-[#8f4837] bg-transparent px-2.5 py-2 text-left text-[0.71rem] text-[#f2b4a3] transition hover:bg-[rgb(223_107_66_/_0.16)]";
export const checkboxLabelClassName =
  "flex items-center gap-2 text-[0.67rem] text-[#88a6ac]";
export const listRowClassName =
  "grid w-full grid-cols-[38px_minmax(0,1fr)] gap-x-2 gap-y-0.5 border-t border-[#1e3940] bg-transparent px-[17px] py-[11px] text-left transition hover:bg-[#102b31]";
export const listRowActiveClassName =
  "bg-[#102b31] shadow-[inset_3px_0_0_0_#df6b42]";
