/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as admin from "../admin.js";
import type * as analytics from "../analytics.js";
import type * as collector from "../collector.js";
import type * as devSeed from "../devSeed.js";
import type * as emails from "../emails.js";
import type * as forms from "../forms.js";
import type * as http from "../http.js";
import type * as lib_cssSanitize from "../lib/cssSanitize.js";
import type * as lib_disposableDomains from "../lib/disposableDomains.js";
import type * as lib_identity from "../lib/identity.js";
import type * as lib_rateLimit from "../lib/rateLimit.js";
import type * as migrate from "../migrate.js";
import type * as public_ from "../public.js";
import type * as theming from "../theming.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  admin: typeof admin;
  analytics: typeof analytics;
  collector: typeof collector;
  devSeed: typeof devSeed;
  emails: typeof emails;
  forms: typeof forms;
  http: typeof http;
  "lib/cssSanitize": typeof lib_cssSanitize;
  "lib/disposableDomains": typeof lib_disposableDomains;
  "lib/identity": typeof lib_identity;
  "lib/rateLimit": typeof lib_rateLimit;
  migrate: typeof migrate;
  public: typeof public_;
  theming: typeof theming;
  users: typeof users;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
