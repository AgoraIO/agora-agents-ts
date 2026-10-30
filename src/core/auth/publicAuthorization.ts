import { base64Decode, base64Encode } from "../base64.js";

export function validateBasicCredentials(customerId: unknown, customerSecret: unknown): void {
    if (
        typeof customerId !== "string" ||
        !customerId.trim() ||
        typeof customerSecret !== "string" ||
        !customerSecret.trim()
    )
        throw new Error("customerId and customerSecret must both be non-empty strings");
    if (customerId.includes(":")) throw new Error("customerId must not contain ':'");
}

/** Validate public REST schemes without including credential values in errors. */
export function validatePublicAuthorization(value: string): void {
    if (/^agora token=\S+$/i.test(value)) return;
    const basic = /^Basic ([A-Za-z0-9+/]+={0,2})$/i.exec(value);
    if (basic) {
        try {
            const decoded = base64Decode(basic[1]);
            // Exact UTF-8 round-trip also rejects malformed/noncanonical base64.
            if (base64Encode(decoded) !== basic[1]) throw new Error("Invalid encoding");
            const separator = decoded.indexOf(":");
            if (separator < 0) throw new Error("Missing separator");
            validateBasicCredentials(decoded.slice(0, separator), decoded.slice(separator + 1));
            return;
        } catch {
            throw new Error("Basic authorization requires valid base64 UTF-8 customerId:customerSecret credentials");
        }
    }
    throw new Error("Only Agora token or valid Basic authorization is supported");
}
