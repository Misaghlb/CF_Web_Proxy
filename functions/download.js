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

    // Implementing a simple retry logic
    let response;
    let attempts = 0;
    const maxAttempts = 3;
    const retryDelay = 1000; // 1 second

    while (attempts < maxAttempts) {
      response = await fetch(decodedUrl, {
        headers: request.headers,
      });

      if (response.ok) {
        break; // Exit loop if successful
      }

      attempts += 1;
      if (attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
    }

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

      const slicedStream = response.body.slice(start, end + 1);
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
    return new Response(`Error: ${error.message}`, { status: 502 });
  }
}
