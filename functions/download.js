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
    const CHUNK_SIZE = 10 * 1024 * 1024; // 10MB chunks
    const tempStore = []; // Temporary store for chunks

    const response = await fetch(decodedUrl, { method: 'HEAD' });
    if (!response.ok) throw new Error(`Unable to retrieve file information. Status: ${response.status}`);

    const contentLength = parseInt(response.headers.get('Content-Length'), 10);
    if (!contentLength) throw new Error('Unable to determine file size');

    for (let start = 0; start < contentLength; start += CHUNK_SIZE) {
      const end = Math.min(start + CHUNK_SIZE - 1, contentLength - 1);

      const rangeHeaders = new Headers(request.headers);
      rangeHeaders.set('Range', `bytes=${start}-${end}`);

      const chunkResponse = await fetch(decodedUrl, { headers: rangeHeaders });

      if (!chunkResponse.ok) throw new Error(`Error fetching chunk: ${start}-${end}, Status: ${chunkResponse.status}`);

      const chunkData = await chunkResponse.arrayBuffer();
      tempStore.push(new Uint8Array(chunkData));

      // Optionally, validate each chunk here (e.g., MD5/SHA checksum)
    }

    // Reassemble the chunks into a single file
    const fullFile = new Blob(tempStore);
    const stream = fullFile.stream();

    const finalHeaders = new Headers(response.headers);
    finalHeaders.set('Content-Disposition', `attachment; filename="${filename}"`);
    finalHeaders.set('Content-Length', contentLength.toString());

    return new Response(stream, {
      status: 200,
      headers: finalHeaders,
    });

  } catch (error) {
    return new Response(`Error: ${error.message}`, { status: 502 });
  }
}
