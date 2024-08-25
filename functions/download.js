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

    let finalUrl = decodedUrl;
    let response = await fetch(finalUrl, {
      method: 'HEAD',
      headers: request.headers,
    });

    // Handle redirection if the status is 301
    if (response.status === 301) {
      const location = response.headers.get('Location');
      if (location) {
        finalUrl = location;
        response = await fetch(finalUrl, {
          method: 'HEAD',
          headers: request.headers,
        });
      }
    }

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    // Check if the server supports byte ranges
    const acceptRanges = response.headers.get('Accept-Ranges');
    if (acceptRanges !== 'bytes') {
      throw new Error('Server does not support resumable downloads');
    }

    // Fetch the actual content
    response = await fetch(finalUrl, {
      headers: request.headers,
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const contentLength = response.headers.get('Content-Length');
    const etag = response.headers.get('ETag');
    const lastModified = response.headers.get('Last-Modified');

    const newHeaders = new Headers(response.headers);
    newHeaders.set('Content-Disposition', `attachment; filename="${filename}"`);
    newHeaders.set('Accept-Ranges', 'bytes');

    if (contentLength) {
      newHeaders.set('Content-Length', contentLength);
    }

    const range = request.headers.get('Range');
    if (range) {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : contentLength - 1;
      const chunksize = (end - start) + 1;

      newHeaders.set('Content-Range', `bytes ${start}-${end}/${contentLength}`);
      newHeaders.set('Content-Length', chunksize.toString());

      return new Response(response.body, {
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
