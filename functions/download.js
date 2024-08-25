async function fetchWithRetries(url, options, retries = 3, delay = 1000) {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, options);
      if (response.ok) {
        return response;
      }
      throw new Error(`HTTP error! status: ${response.status}`);
    } catch (error) {
      if (i === retries - 1) throw error; // Last attempt
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

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
    const range = request.headers.get('Range');

    const fetchOptions = {
      headers: {
        ...request.headers,
      },
    };

    if (range) {
      fetchOptions.headers['Range'] = range;
    }

    const response = await fetchWithRetries(decodedUrl, fetchOptions);

    const contentLength = response.headers.get('Content-Length');
    const newHeaders = new Headers(response.headers);

    newHeaders.set('Content-Disposition', `attachment; filename="${filename}"`);
    newHeaders.set('Accept-Ranges', 'bytes');

    if (range && contentLength) {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : parseInt(contentLength, 10) - 1;
      const chunksize = (end - start) + 1;

      newHeaders.set('Content-Range', `bytes ${start}-${end}/${contentLength}`);
      newHeaders.set('Content-Length', chunksize.toString());

      return new Response(response.body, {
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
