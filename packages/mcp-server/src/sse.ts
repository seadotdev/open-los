/**
 * SSE (Server-Sent Events) transport adapter for the MCP server.
 *
 * This module provides an SSE-based transport that can be mounted on a Hono
 * app (e.g. the Open LOS API server) to let browser-based and remote agents
 * connect to the MCP server over HTTP.
 *
 * Protocol:
 *   GET  /sse          - Opens an SSE event stream. The server sends an
 *                        "endpoint" event with the POST URL for sending messages.
 *   POST /messages     - Client sends JSON-RPC messages here. The response is
 *                        delivered over the SSE stream.
 *
 * Usage:
 *   import { Hono } from "hono";
 *   import { createSseHandler } from "./sse.js";
 *
 *   const mcpRoutes = createSseHandler(ctx);
 *   app.route("/mcp", mcpRoutes);
 */

import { Hono } from "hono";
import { randomUUID } from "node:crypto";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import type { JSONRPCMessage } from "@modelcontextprotocol/sdk/types.js";
import { createMcpServer } from "./mcp.js";
import type { ServiceContext } from "./context.js";

// ─── SSE Transport Implementation ──────────────────────────────────────────

interface SseSession {
  id: string;
  writer: WritableStreamDefaultWriter<Uint8Array>;
  encoder: TextEncoder;
  transport: SseServerTransport;
}

/**
 * A Transport implementation that bridges the MCP protocol over SSE.
 *
 * - Outbound messages (server -> client) are sent as SSE events on the
 *   GET /sse stream.
 * - Inbound messages (client -> server) arrive via POST /messages and are
 *   forwarded to the onmessage callback.
 */
class SseServerTransport implements Transport {
  private _session: SseSession | null = null;
  private _started = false;

  onclose?: () => void;
  onerror?: (error: Error) => void;
  onmessage?: (message: JSONRPCMessage) => void;

  get sessionId(): string | undefined {
    return this._session?.id;
  }

  /**
   * Attach an SSE writer. Called when a client connects to GET /sse.
   */
  attachStream(session: SseSession): void {
    this._session = session;
  }

  async start(): Promise<void> {
    this._started = true;
  }

  async close(): Promise<void> {
    this._started = false;
    try {
      this._session?.writer.close();
    } catch {
      // writer may already be closed
    }
    this._session = null;
    this.onclose?.();
  }

  /**
   * Send a JSON-RPC message to the client over the SSE stream.
   */
  async send(message: JSONRPCMessage): Promise<void> {
    if (!this._session) {
      throw new Error("SSE transport: no active session");
    }
    const data = JSON.stringify(message);
    const event = `event: message\ndata: ${data}\n\n`;
    try {
      await this._session.writer.write(
        this._session.encoder.encode(event),
      );
    } catch (err) {
      this.onerror?.(err instanceof Error ? err : new Error(String(err)));
      throw err;
    }
  }

  /**
   * Called when a POST /messages request arrives with a JSON-RPC message.
   */
  handlePostMessage(message: JSONRPCMessage): void {
    if (!this._started) {
      throw new Error("SSE transport: not started");
    }
    this.onmessage?.(message);
  }
}

// ─── Hono Route Factory ────────────────────────────────────────────────────

/**
 * Creates a Hono app with SSE-based MCP endpoints.
 *
 * Mount this on your API server:
 *   app.route("/mcp", createSseHandler(ctx));
 *
 * Clients then:
 *   1. GET  /mcp/sse         -> receive SSE stream + endpoint URL
 *   2. POST /mcp/messages?sessionId=xxx -> send JSON-RPC messages
 */
export function createSseHandler(ctx: ServiceContext): Hono {
  const app = new Hono();

  // Active sessions keyed by session ID
  const sessions = new Map<string, SseSession>();

  // GET /sse - Open SSE event stream
  app.get("/sse", async (c) => {
    const sessionId = randomUUID();

    // Create the SSE transport and MCP server for this session
    const transport = new SseServerTransport();
    const server = createMcpServer(ctx);

    // Set up the readable/writable stream pair for SSE
    const { readable, writable } = new TransformStream<Uint8Array>();
    const writer = writable.getWriter();
    const encoder = new TextEncoder();

    const session: SseSession = {
      id: sessionId,
      writer,
      encoder,
      transport,
    };

    transport.attachStream(session);
    sessions.set(sessionId, session);

    // Clean up on disconnect
    transport.onclose = () => {
      sessions.delete(sessionId);
    };

    // Determine the base URL for the POST endpoint.
    // Use the request URL to construct the messages endpoint path.
    const url = new URL(c.req.url);
    const basePath = url.pathname.replace(/\/sse$/, "");
    const messagesUrl = `${basePath}/messages?sessionId=${sessionId}`;

    // Connect the MCP server to the SSE transport
    await server.connect(transport);

    // Send the endpoint event so the client knows where to POST messages
    const endpointEvent = `event: endpoint\ndata: ${messagesUrl}\n\n`;
    await writer.write(encoder.encode(endpointEvent));

    // Return the SSE response
    return new Response(readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  });

  // POST /messages - Receive JSON-RPC messages from the client
  app.post("/messages", async (c) => {
    const sessionId = c.req.query("sessionId");
    if (!sessionId) {
      return c.json(
        { error: { code: "INVALID_REQUEST", message: "Missing sessionId query parameter" } },
        400,
      );
    }

    const session = sessions.get(sessionId);
    if (!session) {
      return c.json(
        { error: { code: "SESSION_NOT_FOUND", message: `No active session: ${sessionId}` } },
        404,
      );
    }

    try {
      const message = (await c.req.json()) as JSONRPCMessage;
      session.transport.handlePostMessage(message);
      return c.json({ ok: true }, 202);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return c.json(
        { error: { code: "INVALID_MESSAGE", message: msg } },
        400,
      );
    }
  });

  return app;
}
