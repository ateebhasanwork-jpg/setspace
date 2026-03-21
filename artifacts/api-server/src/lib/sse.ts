import type { Response } from "express";

const clients = new Set<Response>();
const userClients = new Map<string, Set<Response>>();

export function getActiveClientCount(): number {
  return clients.size;
}

export function addSseClient(res: Response, userId?: string) {
  clients.add(res);
  if (userId) {
    if (!userClients.has(userId)) userClients.set(userId, new Set());
    userClients.get(userId)!.add(res);
  }
}

export function removeSseClient(res: Response, userId?: string) {
  clients.delete(res);
  if (userId) {
    userClients.get(userId)?.delete(res);
    if (userClients.get(userId)?.size === 0) userClients.delete(userId);
  }
}

export function broadcastSse(event: string, data: Record<string, unknown> = {}) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const client of [...clients]) {
    try {
      client.write(payload);
    } catch {
      clients.delete(client);
    }
  }
}

export function broadcastSseToUser(userId: string, event: string, data: Record<string, unknown> = {}) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  const targets = userClients.get(userId);
  if (!targets) return;
  for (const client of [...targets]) {
    try {
      client.write(payload);
    } catch {
      targets.delete(client);
      clients.delete(client);
    }
  }
}
