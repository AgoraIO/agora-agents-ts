/**
 * Compile-time type checks for the v3 error taxonomy.
 *
 * This file is type-checked by `tsc` (it is under `src`), not executed by
 * vitest. A regression here fails `pnpm build`.
 */

import type { AnyV3Error, V3ErrorCategory } from "../../index.js";
import {
    AgoraV3Error,
    PreconditionFailedError,
    UnsupportedFieldError,
    V3ConnectionError,
    V3Error,
    V3TimeoutError,
    V3ValidationError,
} from "../../index.js";

function _narrowByCategory(error: AnyV3Error): number | string | undefined {
    switch (error.category) {
        case "api":
            // Narrowed to V3Error: HTTP fields are available without instanceof.
            return error.statusCode + (error.requestId ?? "") + (error.detail ?? "") + (error.reason ?? "");
        case "connection":
            return error.cause === undefined ? "connection" : "connection with cause";
        case "validation":
        case "configuration":
            return error.message;
    }
}

function _narrowByInstanceof(error: unknown): V3ErrorCategory | number | undefined {
    if (error instanceof PreconditionFailedError) {
        const _latest: Promise<unknown> = error.latest();
        return error.statusCode;
    }
    if (error instanceof V3Error) return error.statusCode;
    if (error instanceof V3TimeoutError) {
        const _category: "connection" = error.category;
        return _category;
    }
    if (error instanceof V3ConnectionError) return error.category;
    if (error instanceof UnsupportedFieldError) {
        const _fields: string[] = error.fields;
        const _category: "validation" = error.category;
        return _category;
    }
    if (error instanceof V3ValidationError) return error.category;
    if (error instanceof AgoraV3Error) return error.category;
    return undefined;
}

// @ts-expect-error the base class is abstract; construct a category instead.
const _abstractBase = new AgoraV3Error("x");

const _withCause = new V3ValidationError("bad", { cause: new Error("inner") });
