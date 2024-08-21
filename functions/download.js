export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);
  const searchParams = url.searchParams;

  const encodedData = searchParams.get('data');
  if (!encodedData) {
    return new Response('Data parameter is missing', { status: 400 });
  }

  try {
    const { url: decodedUrl, filename } = JSON.parse(atob(encodedData));
    const response = await fetch(decodedUrl, {
      headers: request.headers,
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const contentLength = parseInt(response.headers.get('Content-Length'), 10);
    const newHeaders = new Headers(response.headers);
    newHeaders.set('Content-Disposition', `attachment; filename="${filename}"`);
    newHeaders.set('Accept-Ranges', 'bytes');

    const range = request.headers.get('Range');
    if (range && contentLength) {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : contentLength - 1;
      const chunkSize = (end - start) + 1;

      // Update headers for partial content
      newHeaders.set('Content-Range', `bytes ${start}-${end}/${contentLength}`);
      newHeaders.set('Content-Length', chunkSize.toString());

      const partialResponse = await fetch(decodedUrl, {
        headers: {
          ...request.headers,
          'Range': `bytes=${start}-${end}`,
        },
      });

      return new Response(partialResponse.body, {
        status: 206,
        headers: newHeaders,
      });
    } else {
      return new Response(response.body, {
        status: 200,
        headers: newHeaders,
      });
    }
  } catch (error) {
    return new Response(`Error: ${error.message}`, { status: 400 });
  }
}
