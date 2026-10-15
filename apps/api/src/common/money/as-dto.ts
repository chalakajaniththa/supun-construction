import { serializeValue } from './serialize.interceptor.js';

/** The API's JSON form of a service result (Decimal → string, Date → ISO) — what the web sees. */
export function asDto<T>(value: unknown): T {
  return JSON.parse(JSON.stringify(serializeValue(value))) as T;
}
