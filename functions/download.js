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

      // Ensure that the Content-Range header is correctly formatted
      newHeaders.set('Content-Range', `bytes ${start}-${end}/${contentLength}`);
      newHeaders.set('Content-Length', chunksize.toString());

      // Read the response body stream and slice the required range
      const reader = response.body.getReader();
      let bytesRead = 0;
      let chunks = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        bytesRead += value.length;

        // Only append the relevant range to the chunks
        if (bytesRead >= start) {
          const startInValue = Math.max(0, start - (bytesRead - value.length));
          const endInValue = Math.min(value.length, end - (bytesRead - value.length) + 1);
          chunks.push(value.slice(startInValue, endInValue));
        }

        // Stop reading once we have read up to the end range
        if (bytesRead > end) break;
      }

      const slicedStream = new Blob(chunks).stream();
      return new Response(slicedStream, {
        status: 206,
        headers: newHeaders,
      });
    } else {
      // Fallback for non-range requests or when content length is missing
      if (contentLength) {
        newHeaders.set('Content-Length', contentLength);
      }
      return new Response(response.body, {
        status: 200,
        headers: newHeaders,
      });
    }
  } catch (error) {
    return new Response(`Error: ${error.message}`, { status: 502 });
  }
}
