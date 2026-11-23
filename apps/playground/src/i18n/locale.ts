import { zhCN } from "./zh-CN";

export type PlaygroundLocale = "en" | "zh-CN";
export type Translate = (message: string, values?: Record<string, string | number>) => string;

export function translateMessage(locale: PlaygroundLocale, message: string, values?: Record<string, string | number>) {
  const text = locale === "zh-CN" && Object.prototype.hasOwnProperty.call(zhCN, message) ? zhCN[message] : message;
  return values ? text.replace(/\{(\w+)\}/g, (token, key: string) => String(values[key] ?? token)) : text;
}
