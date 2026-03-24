declare const Deno: {
  serve: (handler: (request: Request) => Response | Promise<Response>) => void;
};

// @ts-ignore Supabase Edge/Deno resolves npm: specifiers at runtime.
import { Hono } from "npm:hono";
// @ts-ignore Supabase Edge/Deno resolves npm: specifiers at runtime.
import { cors } from "npm:hono/cors";
// @ts-ignore Supabase Edge/Deno resolves npm: specifiers at runtime.
import { logger } from "npm:hono/logger";
import * as kv from "./kv_store.tsx";
const app = new Hono();

// Enable logger
app.use('*', logger(console.log));

// Enable CORS for all routes and methods
app.use(
  "/*",
  cors({
    origin: "*",
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
  }),
);

// Health check endpoint
app.get("/make-server-e09169b5/health", (c: any) => {
  return c.json({ status: "ok" });
});

// Basic key/value API using kv_store
app.get("/make-server-e09169b5/kv/:key", async (c: any) => {
  try {
    const key = c.req.param("key");
    const value = await kv.get(key);
    if (value === undefined || value === null) {
      return c.json({ error: "not found" }, 404);
    }
    return c.json({ key, value });
  } catch (err: unknown) {
    console.error(err);
    const message = err instanceof Error ? err.message : "unknown error";
    return c.json({ error: message }, 500);
  }
});

app.post("/make-server-e09169b5/kv", async (c: any) => {
  try {
    const body = await c.req.json();
    const { key, value } = body;
    if (typeof key !== "string") {
      return c.json({ error: "key must be a string" }, 400);
    }
    await kv.set(key, value);
    return c.json({ success: true });
  } catch (err: unknown) {
    console.error(err);
    const message = err instanceof Error ? err.message : "unknown error";
    return c.json({ error: message }, 500);
  }
});

app.delete("/make-server-e09169b5/kv/:key", async (c: any) => {
  try {
    const key = c.req.param("key");
    await kv.del(key);
    return c.json({ success: true });
  } catch (err: unknown) {
    console.error(err);
    const message = err instanceof Error ? err.message : "unknown error";
    return c.json({ error: message }, 500);
  }
});

Deno.serve(app.fetch);