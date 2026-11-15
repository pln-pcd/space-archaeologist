import contract from "./mission.schema.json";
type Schema = {
  $ref?: string;
  type?: string;
  const?: unknown;
  enum?: unknown[];
  oneOf?: Schema[];
  required?: string[];
  properties?: Record<string, Schema>;
  additionalProperties?: boolean;
  items?: Schema;
  minItems?: number;
  maxItems?: number;
  minLength?: number;
  minimum?: number;
  pattern?: string;
};
/** The small JSON Schema vocabulary used by our checked-in content contract. No runtime dependency. */
export function validateShape(
  value: unknown,
  schema: Schema = contract,
  path = "mission",
): string[] {
  if (schema.$ref)
    return validateShape(
      value,
      (contract.$defs as Record<string, Schema>)[
        schema.$ref.split("/").at(-1)!
      ],
      path,
    );
  if (schema.oneOf)
    return schema.oneOf.filter(
      (branch) => validateShape(value, branch, path).length === 0,
    ).length === 1
      ? []
      : [`${path}: expected exactly one valid line shape`];
  const errors: string[] = [];
  const error = (message: string) => errors.push(`${path}: ${message}`);
  if ("const" in schema && value !== schema.const) error("unexpected constant");
  if (schema.enum && !schema.enum.includes(value)) error("unknown option");
  if (schema.type) {
    const valid =
      schema.type === "array"
        ? Array.isArray(value)
        : schema.type === "object"
          ? !!value && typeof value === "object" && !Array.isArray(value)
          : schema.type === "integer"
            ? Number.isInteger(value)
            : typeof value === schema.type;
    if (!valid) return [...errors, `${path}: expected ${schema.type}`];
  }
  if (typeof value === "string") {
    if (schema.minLength !== undefined && value.length < schema.minLength)
      error("empty string");
    if (schema.pattern && !new RegExp(schema.pattern).test(value))
      error("invalid string format");
  }
  if (
    typeof value === "number" &&
    (!Number.isFinite(value) ||
      (schema.minimum !== undefined && value < schema.minimum))
  )
    error("invalid number");
  if (Array.isArray(value)) {
    if (schema.minItems !== undefined && value.length < schema.minItems)
      error("too few items");
    if (schema.maxItems !== undefined && value.length > schema.maxItems)
      error("too many items");
    if (schema.items)
      value.forEach((item, i) =>
        errors.push(...validateShape(item, schema.items, `${path}[${i}]`)),
      );
  } else if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    for (const key of schema.required ?? [])
      if (!(key in record)) error(`missing ${key}`);
    for (const [key, item] of Object.entries(record)) {
      if (schema.properties?.[key])
        errors.push(
          ...validateShape(item, schema.properties[key], `${path}.${key}`),
        );
      else if (schema.additionalProperties === false)
        error(`unexpected ${key}`);
    }
  }
  return errors;
}
