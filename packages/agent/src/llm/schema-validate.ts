type JsonSchema = {
  type?: string
  required?: string[]
  enum?: unknown[]
  properties?: Record<string, JsonSchema>
  items?: JsonSchema
}

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value)
}

export function validateStructuredOutput(value: unknown, schema: object): string[] {
  const errors: string[] = []
  validateNode(value, schema as JsonSchema, "$", errors)
  return errors
}

function validateNode(value: unknown, schema: JsonSchema, path: string, errors: string[]): void {
  if (schema.enum && !schema.enum.includes(value)) {
    errors.push(`${path}: value must be one of [${schema.enum.join(", ")}]`)
    return
  }

  const expectedType = schema.type
  if (expectedType === "object") {
    if (!isObject(value)) {
      errors.push(`${path}: expected object`)
      return
    }
    const required = schema.required ?? []
    for (const key of required) {
      if (!(key in value)) {
        errors.push(`${path}.${key}: missing required property`)
      }
    }
    if (schema.properties) {
      for (const [key, childSchema] of Object.entries(schema.properties)) {
        if (key in value) {
          validateNode(value[key], childSchema, `${path}.${key}`, errors)
        }
      }
    }
    return
  }

  if (expectedType === "array") {
    if (!Array.isArray(value)) {
      errors.push(`${path}: expected array`)
      return
    }
    if (schema.items) {
      for (let i = 0; i < value.length; i++) {
        validateNode(value[i], schema.items, `${path}[${i}]`, errors)
      }
    }
    return
  }

  if (expectedType === "string" && typeof value !== "string") {
    errors.push(`${path}: expected string`)
    return
  }

  if (expectedType === "number" && typeof value !== "number") {
    errors.push(`${path}: expected number`)
    return
  }

  if (expectedType === "boolean" && typeof value !== "boolean") {
    errors.push(`${path}: expected boolean`)
  }
}
