export type AnySchema = { readonly _type: unknown } & Record<string, unknown>;
export type Static<S extends AnySchema> = S['_type'];
export type ValidationError = { path: string; message: string; value: unknown };

const mk = <T>(
  data: Record<string, unknown>
): AnySchema & { readonly _type: T } =>
  data as AnySchema & { readonly _type: T };

type StringOpts = {
  format?: string;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
};
type NumberOpts = { minimum?: number; maximum?: number };
type ArrayOpts = { minItems?: number; maxItems?: number };

type RequiredKeys<T extends Record<string, AnySchema>> = {
  [K in keyof T]: undefined extends Static<T[K]> ? never : K;
}[keyof T];

type OptionalKeys<T extends Record<string, AnySchema>> = {
  [K in keyof T]: undefined extends Static<T[K]> ? K : never;
}[keyof T];

type ObjectStatic<T extends Record<string, AnySchema>> = {
  [K in RequiredKeys<T>]: Static<T[K]>;
} & { [K in OptionalKeys<T>]?: Exclude<Static<T[K]>, undefined> };

export const t = {
  String: (opts?: StringOpts) => mk<string>({ type: 'string', ...opts }),
  Number: (opts?: NumberOpts) => mk<number>({ type: 'number', ...opts }),
  Integer: (opts?: NumberOpts) => mk<number>({ type: 'integer', ...opts }),
  Boolean: () => mk<boolean>({ type: 'boolean' }),
  Null: () => mk<null>({ type: 'null' }),
  Literal: <T extends string | number | boolean>(value: T) =>
    mk<T>({ const: value }),
  Optional: <T extends AnySchema>(schema: T) =>
    mk<Static<T> | undefined>({ _optional: true, _inner: schema }),
  Union: <T extends AnySchema[]>(schemas: [...T]) =>
    mk<Static<T[number]>>({ anyOf: schemas }),
  Enum: <T extends string>(values: readonly T[]) =>
    mk<T>({ type: 'string', enum: values }),
  Nullable: <T extends AnySchema>(schema: T) =>
    mk<Static<T> | null>({ anyOf: [{ type: 'null' }, schema] }),
  Any: () => mk<unknown>({}),
  Object: <T extends Record<string, AnySchema>>(properties: T) => {
    const required = Object.entries(properties)
      .filter(([, v]) => !(v as Record<string, unknown>)._optional)
      .map(([k]) => k);
    return mk<ObjectStatic<T>>({ type: 'object', properties, required });
  },
  Array: <T extends AnySchema>(items: T, opts?: ArrayOpts) =>
    mk<Static<T>[]>({ type: 'array', items, ...opts })
};

const walk = (
  schema: AnySchema,
  value: unknown,
  path = ''
): ValidationError[] => {
  const s = schema as Record<string, unknown>;
  const fail = (msg: string): ValidationError[] => [
    { path, message: msg, value }
  ];

  if (s._optional) {
    if (value === undefined || value === null) return [];
    return walk(s._inner as AnySchema, value, path);
  }
  if ('const' in s)
    return value === s.const
      ? []
      : fail(
          `Expected ${JSON.stringify(s.const)}, got ${JSON.stringify(value)}`
        );
  if ('anyOf' in s) {
    return (s.anyOf as AnySchema[]).some(
      (sub) => !walk(sub, value, path).length
    )
      ? []
      : fail('Value does not match any variant');
  }

  switch (s.type) {
    case 'string': {
      if (typeof value !== 'string') return fail('Expected string');
      const errs: ValidationError[] = [];
      if (Array.isArray(s.enum) && !(s.enum as string[]).includes(value))
        errs.push({
          path,
          message: `Expected one of: ${(s.enum as string[]).join(', ')}`,
          value
        });
      if (s.minLength !== undefined && value.length < (s.minLength as number))
        errs.push({
          path,
          message: `String must be at least ${s.minLength} characters`,
          value
        });
      if (s.maxLength !== undefined && value.length > (s.maxLength as number))
        errs.push({
          path,
          message: `String must be at most ${s.maxLength} characters`,
          value
        });
      if (
        s.pattern !== undefined &&
        !new RegExp(s.pattern as string).test(value)
      )
        errs.push({
          path,
          message: `String does not match pattern ${s.pattern}`,
          value
        });
      return errs;
    }
    case 'number': {
      if (typeof value !== 'number' || !Number.isFinite(value))
        return fail('Expected number');
      const errs: ValidationError[] = [];
      if (s.minimum !== undefined && value < (s.minimum as number))
        errs.push({ path, message: `Value must be >= ${s.minimum}`, value });
      if (s.maximum !== undefined && value > (s.maximum as number))
        errs.push({ path, message: `Value must be <= ${s.maximum}`, value });
      return errs;
    }
    case 'integer': {
      if (typeof value !== 'number' || !Number.isInteger(value))
        return fail('Expected integer');
      const errs: ValidationError[] = [];
      if (s.minimum !== undefined && value < (s.minimum as number))
        errs.push({ path, message: `Value must be >= ${s.minimum}`, value });
      if (s.maximum !== undefined && value > (s.maximum as number))
        errs.push({ path, message: `Value must be <= ${s.maximum}`, value });
      return errs;
    }
    case 'boolean':
      return typeof value === 'boolean' ? [] : fail('Expected boolean');
    case 'null':
      return value === null ? [] : fail('Expected null');
    case 'object': {
      if (typeof value !== 'object' || value === null || Array.isArray(value))
        return fail('Expected object');
      const obj = value as Record<string, unknown>;
      const props = s.properties as Record<string, AnySchema>;
      const required = s.required as string[];
      const errs: ValidationError[] = [];
      for (const key of required) {
        if (!(key in obj))
          errs.push({
            path: path ? `${path}.${key}` : key,
            message: 'Required field missing',
            value: undefined
          });
      }
      for (const [key, propSchema] of Object.entries(props)) {
        if (key in obj)
          errs.push(
            ...walk(propSchema, obj[key], path ? `${path}.${key}` : key)
          );
      }
      return errs;
    }
    case 'array': {
      if (!Array.isArray(value)) return fail('Expected array');
      const errs: ValidationError[] = [];
      if (s.minItems !== undefined && value.length < (s.minItems as number))
        errs.push({
          path,
          message: `Array must have at least ${s.minItems} items`,
          value
        });
      if (s.maxItems !== undefined && value.length > (s.maxItems as number))
        errs.push({
          path,
          message: `Array must have at most ${s.maxItems} items`,
          value
        });
      for (let i = 0; i < value.length; i++)
        errs.push(...walk(s.items as AnySchema, value[i], `${path}[${i}]`));
      return errs;
    }
    default:
      return [];
  }
};

export const validate = (schema: AnySchema, value: unknown): boolean =>
  !walk(schema, value).length;
export const errors = (schema: AnySchema, value: unknown): ValidationError[] =>
  walk(schema, value);
