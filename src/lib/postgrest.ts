/**
 * PostgREST's `.or()` filter string treats comma/period/colon/parentheses as
 * syntax (field.op.value,field2.op.value2) — raw user input containing one
 * of those characters would otherwise break out of the intended filter
 * shape. Wrapping the value in double quotes (escaping any quote/backslash
 * inside, per PostgREST's own escaping rule) keeps it a single opaque value
 * no matter what the user types. Shared by every query that builds a
 * multi-column `.or()` search filter from free-text user input.
 */
export function escapeForOrFilter(value: string): string {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}
