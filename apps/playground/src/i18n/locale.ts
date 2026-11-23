import { zhCN } from "./zh-CN";

export type PlaygroundLocale = "en" | "zh-CN";
type MessageValues = Readonly<Record<string, string | number>>;

export type LocalizedMessage = string | { text: string; values: MessageValues };
export type Translate = (message: LocalizedMessage, values?: MessageValues) => string;

export function message(text: string, values: MessageValues): LocalizedMessage {
  return { text, values };
}

export function translateMessage(locale: PlaygroundLocale, message: LocalizedMessage, values?: MessageValues) {
  const key = typeof message === "string" ? message : message.text;
  const parameters = typeof message === "string" ? values : message.values;
  const text = locale === "zh-CN" && Object.prototype.hasOwnProperty.call(zhCN, key) ? zhCN[key] : key;
  return parameters
    ? text.replace(/\{(\w+)\}/g, (token, key: string) => String(parameters[key] ?? token))
    : text;
}
