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

    const contentLength = response.headers.get('Content-Length');
    const newHeaders = new Headers(response.headers);
    newHeaders.set('Content-Disposition', `attachment; filename="${filename}"`);
    newHeaders.set('Accept-Ranges', 'bytes');

    const range = request.headers.get('Range');
    if (range && contentLength) {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : parseInt(contentLength, 10) - 1;
      const chunksize = (end - start) + 1;

      newHeaders.set('Content-Range', `bytes ${start}-${end}/${contentLength}`);
      newHeaders.set('Content-Length', chunksize.toString());

      const reader = response.body.getReader();
      let bytesRead = 0;
      let chunks = [];
      let isPartialRead = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        bytesRead += value.length;

        if (bytesRead >= start) {
          const startInValue = Math.max(0, start - (bytesRead - value.length));
          const endInValue = Math.min(value.length, end - (bytesRead - value.length) + 1);
          chunks.push(value.slice(startInValue, endInValue));
          isPartialRead = true;
        }

        if (bytesRead > end) break;
      }

      if (!isPartialRead) {
        // Retry logic or full download as a fallback
        return new Response('Partial read failed, unable to resume download', { status: 502 });
      }

      const slicedStream = new Blob(chunks).stream();
      return new Response(slicedStream, {
        status: 206,
        headers: newHeaders,
      });
    } else {
      if (contentLength) {
        newHeaders.set('Content-Length', contentLength);
      }
      return new Response(response.body, {
        status: 200,
        headers: newHeaders,
      });
    }
  } catch (error) {
    // You can log the error for debugging purposes
    return new Response(`Error: ${error.message}`, { status: 502 });
  }
}
