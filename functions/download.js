async function getResponseDetails(response) {
  // Convert headers to an object
  const headersObj = {};
  response.headers.forEach((value, key) => {
    headersObj[key] = value;
  });

  // Read the body as text
  const bodyText = await response.text();

  // Create a combined result
  const result = {
    headers: headersObj,
    body: bodyText
  };

  // Return or display the result
  return JSON.stringify(result, null, 2); // Pretty-print JSON
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

    let finalUrl = decodedUrl;
    let response = await fetch(finalUrl, {
      method: 'HEAD',
      headers: request.headers,
      redirect: 'manual' // This prevents automatic redirection
    });

    // Handle redirection if the status is 301
    if (response.status === 301) {
      console.log('is 301');
      const location = response.headers.get('Location');
      if (location) {
        finalUrl = location;
        console.log('locaton exist', finalUrl);
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

    const resultText = await getResponseDetails(response);
      return new Response(resultText);
      throw new Error(`Server does not support resumable downloads: ${resultText}`);
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
