import { connect } from "../shard-db/client";
import { COLLECTION } from "./collection";

/**
 * `basePath` is derived from Vite's `base` rather than hardcoded, so one build
 * works both at the dev-server root and under a GitHub Pages project subpath.
 */
const db = connect({ basePath: `${import.meta.env.BASE_URL}shard-data` });

/** The single collection this app queries. */
export const cards = db[COLLECTION];
