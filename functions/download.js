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
    const rangeHeader = request.headers.get('Range');

    // Pass the Range header to the fetch request
    const fetchOptions = {
      headers: {
        ...request.headers,
        'Range': rangeHeader || '', // Include Range header if present
      },
    };

    const response = await fetch(decodedUrl, fetchOptions);

    if (!response.ok) throw new Error(`Error fetching chunk. Status: ${response.status}`);

    // Modify headers to ensure the correct handling of the content disposition
    const newHeaders = new Headers(response.headers);
    newHeaders.set('Content-Disposition', `attachment; filename="${filename}"`);

    return new Response(response.body, {
      status: rangeHeader ? 206 : 200,
      headers: newHeaders,
    });

  } catch (error) {
    return new Response(`Error: ${error.message}`, { status: 502 });
  }
}
