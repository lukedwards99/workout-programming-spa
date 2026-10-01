export default {
  fetch() {
    return new Response('LiftLog is being updated. Please try again shortly.', {
      status: 503, headers: { 'Cache-Control': 'no-store', 'Retry-After': '60' },
    });
  },
};
