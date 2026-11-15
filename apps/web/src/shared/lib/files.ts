/** Reads a user-picked file as text (FileReader works in every browser and in jsdom). */
export const readFileText = (file: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      resolve(typeof reader.result === 'string' ? reader.result : '');
    };
    reader.onerror = () => {
      reject(reader.error ?? new Error('Could not read the file.'));
    };
    reader.readAsText(file);
  });

/** Lets the user save `content` as a file, without a server round trip. */
export function downloadText(fileName: string, content: string, type = 'text/csv') {
  const url = URL.createObjectURL(new Blob([content], { type: `${type};charset=utf-8` }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
