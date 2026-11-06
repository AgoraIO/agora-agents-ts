/**
 * Structured error taxonomy for the v3 preview API.
 *
 * Every error raised by a `client.v3.*` operation, and by the AgentKit paths that
 * call it, is an {@link AgoraV3Error} in exactly one {@link V3ErrorCategory}:
 *
 * - `validation`    {@link V3ValidationError}: input rejected locally before any request.
 * - `configuration` {@link V3ConfigurationError}: the client itself is misconfigured.
 * - `connection`    {@link V3ConnectionError}: the request could not complete;
 *                   {@link V3TimeoutError} is its timeout subtype.
 * - `api`           {@link V3Error}: a non-2xx response, or a 2xx response that violates
 *                   the API contract; {@link PreconditionFailedError} is its 412 subtype.
 *
 * The category names and meanings are shared with the Go and Python SDKs.
 */
import type { RawResponse } from "../core/fetcher/RawResponse.js";
import type { ErrorReason } from "./types.js";

/** The failure kind shared by every v3 error. Subtypes keep their parent's category. */
export type V3ErrorCategory = "validation" | "configuration" | "connection" | "api";

/** Constructor options for v3 errors. Mirrors ES2022 `ErrorOptions`. */
export interface V3ErrorOptions {
    /** The underlying error, exposed as the standard `error.cause`. */
    cause?: unknown;
}

// Instances carry the tags of every taxonomy class in their chain under a
// registry symbol, so `instanceof` also holds when an application ends up with
// both the CommonJS and ESM builds (or two installed copies) of this package.
const BRANDS: unique symbol = Symbol.for("agora-agents.v3.error-brands");
const TAGS = new WeakMap<object, string>();

function tag(target: object, name: string): void {
    TAGS.set(target, `agora-agents.${name}`);
}

/** Root of every v3 error. Catch this to handle any failure from a v3 operation. */
export abstract class AgoraV3Error extends Error {
    /** Which of the four shared categories this error belongs to. */
    abstract readonly category: V3ErrorCategory;
    /** The underlying error, when this error wraps one. */
    declare readonly cause?: unknown;

    constructor(message: string, options?: V3ErrorOptions) {
        super(message);
        // Native classes already get the right prototype; keep it explicit for
        // consumers that down-level this package to ES5.
        Object.setPrototypeOf(this, new.target.prototype);
        this.name = "AgoraV3Error";
        if (options !== undefined && "cause" in options) {
            Object.defineProperty(this, "cause", {
                value: options.cause,
                writable: true,
                configurable: true,
                enumerable: false,
            });
        }
        const brands: string[] = [];
        for (let ctor: unknown = new.target; typeof ctor === "function"; ctor = Object.getPrototypeOf(ctor)) {
            const name = TAGS.get(ctor);
            if (name !== undefined) brands.push(name);
        }
        Object.defineProperty(this, BRANDS, { value: brands, enumerable: false });
    }
}

// Inherited by every subclass; `this` is the class on the right of `instanceof`.
Object.defineProperty(AgoraV3Error, Symbol.hasInstance, {
    value: function hasInstance(this: object, value: unknown): boolean {
        if (Function.prototype[Symbol.hasInstance].call(this, value)) return true;
        const name = TAGS.get(this);
        if (name === undefined || value === null || typeof value !== "object") return false;
        const brands = (value as { [BRANDS]?: unknown })[BRANDS];
        return Array.isArray(brands) && brands.includes(name);
    },
});

/**
 * The caller's input was rejected locally, before any HTTP request was sent:
 * invalid identifiers, bodies, secret names, idempotency keys, unsupported
 * fields or options, or conflicting options.
 */
export class V3ValidationError extends AgoraV3Error {
    get category(): "validation" {
        return "validation";
    }
    constructor(message: string, options?: V3ErrorOptions) {
        super(message, options);
        this.name = "V3ValidationError";
    }
}

/**
 * The client itself is misconfigured, such as an invalid `v3.baseUrl` origin or
 * missing or conflicting credentials. A deployment problem, not a bad request.
 */
export class V3ConfigurationError extends AgoraV3Error {
    get category(): "configuration" {
        return "configuration";
    }
    constructor(message: string, options?: V3ErrorOptions) {
        super(message, options);
        this.name = "V3ConfigurationError";
    }
}

/**
 * The request could not complete: DNS failure, refused or reset connection, TLS
 * failure, an aborted request or body. The underlying error, when the runtime
 * reported one, is available as `cause`.
 */
export class V3ConnectionError extends AgoraV3Error {
    get category(): "connection" {
        return "connection";
    }
    constructor(message: string, options?: V3ErrorOptions) {
        super(message, options);
        this.name = "V3ConnectionError";
    }
}

/** The request exceeded its timeout (`timeoutInSeconds`). A {@link V3ConnectionError}. */
export class V3TimeoutError extends V3ConnectionError {
    constructor(message: string, options?: V3ErrorOptions) {
        super(message, options);
        this.name = "V3TimeoutError";
    }
}

/** Options for {@link V3Error}. */
export interface V3ApiErrorOptions extends V3ErrorOptions {
    /** Overrides the default `v3 request failed (<status>)` message. */
    message?: string;
}

function stringField(body: unknown, key: string): string | undefined {
    if (body === null || typeof body !== "object" || Array.isArray(body)) return undefined;
    const value = (body as Record<string, unknown>)[key];
    return typeof value === "string" && value !== "" ? value : undefined;
}

/**
 * A non-2xx response, or a 2xx response that violates the API contract (a body that
 * is not valid JSON, or missing required data such as an ETag); `statusCode` is then
 * the 2xx status. `body` is the parsed JSON body when available, otherwise the text.
 */
export class V3Error extends AgoraV3Error {
    get category(): "api" {
        return "api";
    }
    constructor(
        public readonly statusCode: number,
        public readonly body: unknown,
        public readonly rawResponse: RawResponse,
        options?: V3ApiErrorOptions,
    ) {
        super(options?.message ?? `v3 request failed (${statusCode})`, options);
        this.name = "V3Error";
    }
    /** Response headers. */
    get headers(): Headers {
        return this.rawResponse.headers;
    }
    /** The `Agora-Request-Id` response header; quote it when contacting support. */
    get requestId(): string | null {
        return this.rawResponse.headers.get("Agora-Request-Id");
    }
    /** Human-readable `detail` from the error body, when present. */
    get detail(): string | undefined {
        return stringField(this.body, "detail");
    }
    /** Machine-readable `reason` from the error body (for example `"AgentNotFound"`), when present. */
    get reason(): ErrorReason | (string & {}) | undefined {
        return stringField(this.body, "reason");
    }
}

/** The `If-Match` / `If-None-Match` precondition failed (HTTP 412). A {@link V3Error}. */
export class PreconditionFailedError extends V3Error {
    constructor(
        body: unknown,
        raw: RawResponse,
        private readonly reload: () => Promise<unknown>,
        options?: V3ApiErrorOptions,
    ) {
        super(412, body, raw, options);
        this.name = "PreconditionFailedError";
    }
    /** Re-read the resource to obtain its current representation and ETag. */
    latest(): Promise<unknown> {
        return this.reload();
    }
}

/**
 * Union of the four category classes, discriminated by `category`:
 * `if (error.category === "api") error.statusCode` narrows without `instanceof`.
 */
export type AnyV3Error = V3ValidationError | V3ConfigurationError | V3ConnectionError | V3Error;

tag(AgoraV3Error, "AgoraV3Error");
tag(V3ValidationError, "V3ValidationError");
tag(V3ConfigurationError, "V3ConfigurationError");
tag(V3ConnectionError, "V3ConnectionError");
tag(V3TimeoutError, "V3TimeoutError");
tag(V3Error, "V3Error");
tag(PreconditionFailedError, "PreconditionFailedError");

/** @internal Register an error class defined outside this module for cross-build `instanceof`. */
export function registerV3ErrorClass(target: abstract new (...args: never[]) => AgoraV3Error, name: string): void {
    tag(target, name);
}

/** @internal Run a local validator and rethrow its plain errors as {@link V3ValidationError}. */
export function asValidation<T>(run: () => T): T {
    try {
        return run();
    } catch (error) {
        if (error instanceof AgoraV3Error || !(error instanceof Error)) throw error;
        throw new V3ValidationError(error.message, { cause: error });
    }
}
