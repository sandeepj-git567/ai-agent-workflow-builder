/**
 * Evaluates template variables such as {{steps.step_1.output}} or {{steps.0.output.text}}
 */
export function interpolateVariables(template: string, context: Record<string, any>): string {
  if (typeof template !== 'string') return template;

  return template.replace(/\{\{\s*([a-zA-Z0-9_$.]+)\s*\}\}/g, (match, path) => {
    const value = getNestedValue(context, path);
    if (value === undefined || value === null) {
      return '';
    }
    if (typeof value === 'object') {
      return JSON.stringify(value);
    }
    return String(value);
  });
}

export function interpolateObject<T = any>(obj: T, context: Record<string, any>): T {
  if (!obj) return obj;
  if (typeof obj === 'string') {
    return interpolateVariables(obj, context) as unknown as T;
  }
  if (Array.isArray(obj)) {
    return obj.map(item => interpolateObject(item, context)) as unknown as T;
  }
  if (typeof obj === 'object') {
    const result: any = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = interpolateObject(value, context);
    }
    return result;
  }
  return obj;
}

export function getNestedValue(obj: any, path: string): any {
  if (!obj || !path) return undefined;

  // Normalize path: steps.step_1.output.text -> parts
  const parts = path.split('.');
  let current = obj;

  for (const part of parts) {
    if (current === undefined || current === null) return undefined;
    current = current[part];
  }

  return current;
}
