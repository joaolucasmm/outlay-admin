/**
 * jsdom's Blob/File lack `arrayBuffer()`, `text()` and `stream()`, which every browser has.
 * Node's fetch (undici) streams FormData file parts through `stream()`, so without this a
 * multipart upload in a test never finishes. Test environment only.
 */
const readAs = (blob: Blob): Promise<ArrayBuffer> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      resolve(reader.result as ArrayBuffer);
    };
    reader.onerror = () => {
      reject(reader.error ?? new Error('Could not read the blob.'));
    };
    reader.readAsArrayBuffer(blob);
  });

const proto = Blob.prototype as Partial<Blob>;

if (!('arrayBuffer' in Blob.prototype)) {
  proto.arrayBuffer = function arrayBuffer(this: Blob) {
    return readAs(this);
  };
}

if (!('text' in Blob.prototype)) {
  proto.text = async function text(this: Blob) {
    return new TextDecoder().decode(await readAs(this));
  };
}

if (!('stream' in Blob.prototype)) {
  proto.stream = function stream(this: Blob) {
    const read = readAs(this);
    return new ReadableStream<Uint8Array>({
      async start(controller) {
        controller.enqueue(new Uint8Array(await read));
        controller.close();
      },
    });
  };
}
