export const draft = "https://json-schema.org/draft/2020-12/schema";
export const version = { const: 1 };
export const string = { type: "string" };
export const nonblank = { type: "string", pattern: "\\S" };
export const number = { type: "number" };
export const boolean = { type: "boolean" };
export const positive = { ...number, exclusiveMinimum: 0 };
export const nonnegative = { ...number, minimum: 0 };
export const safeInteger = { type: "integer", minimum: 1, maximum: Number.MAX_SAFE_INTEGER };
export const range = (minimum, maximum) => ({ ...number, minimum, maximum });
export const unit = range(0, 1);
export const choice = (...values) => ({ enum: values });
export const ref = (name) => ({ $ref: `#/$defs/${name}` });
export const array = (items, limits = {}) => ({ type: "array", items, ...limits });

export function object(properties, required = []) {
  return {
    type: "object",
    properties,
    ...(required.length ? { required } : {}),
    additionalProperties: false,
  };
}

export function tagged(type, properties, required = []) {
  return object({ type: { const: type }, ...properties }, ["type", ...required]);
}
