import { registerListener } from '@/lib/sse';
import { StreamPayload } from '@/lib/types';

export const runtime = 'nodejs';

export async function GET() {
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (payload: StreamPayload) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
      };

      send({ type: 'connected', refreshedAt: new Date().toISOString() });
      const remove = registerListener(send);
      const heartbeat = setInterval(() => {
        send({ type: 'heartbeat', refreshedAt: new Date().toISOString() });
      }, 20_000);

      return () => {
        clearInterval(heartbeat);
        remove();
      };
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      Connection: 'keep-alive',
      'Cache-Control': 'no-cache, no-transform'
    }
  });
}
