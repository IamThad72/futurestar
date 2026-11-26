import { IncomingMessage, ServerResponse } from "node:http";
import { Socket } from "node:net";
import { createEvent, type H3Event } from "h3";

type MakeEventOptions = {
  method?: string;
  url: string;
  headers?: Record<string, string>;
  body?: unknown;
  params?: Record<string, string>;
};

/** A Nitro/h3 event the spiritual handlers can read without a listening server. */
export function makeEvent({ method = "GET", url, headers = {}, body, params }: MakeEventOptions): H3Event {
  const req = new IncomingMessage(new Socket());
  req.method = method;
  req.url = url;
  req.headers = { ...headers };
  if (body !== undefined) {
    req.headers["content-type"] = "application/json";
    (req as IncomingMessage & { body?: unknown }).body = body;
  }
  const res = new ServerResponse(req);
  const event = createEvent(req, res);
  event.context.params = params ?? {};
  return event;
}
