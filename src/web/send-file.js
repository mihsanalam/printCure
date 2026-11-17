import {
  BUFFER_HIGH_WATER,
  CHUNK_SIZE,
  MAX_FILE_BYTES,
  MESSAGE,
} from '../shared/protocol.js';

export async function sendFile(connection, file, settings, onProgress) {
  if (file.size > MAX_FILE_BYTES) {
    throw new Error(
      `This file is larger than ${Math.round(MAX_FILE_BYTES / 1024 / 1024)} MB.`
    );
  }

  const fileId = crypto.randomUUID();

  connection.send({
    type: MESSAGE.FILE_START,
    fileId,
    name: file.name,
    mime: file.type || 'application/octet-stream',
    size: file.size,
    settings,
  });

  let offset = 0;
  while (offset < file.size) {
    const chunk = file.slice(offset, offset + CHUNK_SIZE);
    const data = await chunk.arrayBuffer();

    await waitForBuffer(connection);
    connection.send({ type: MESSAGE.FILE_CHUNK, fileId, data });

    offset += CHUNK_SIZE;
    onProgress?.(Math.min(offset, file.size) / file.size);
  }

  connection.send({ type: MESSAGE.FILE_END, fileId });
}

// Keeps the data channel from overflowing on slow connections.
function waitForBuffer(connection, limit = BUFFER_HIGH_WATER) {
  const channel = connection.dataChannel;
  if (!channel) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    const check = () => {
      if (channel.readyState !== 'open' || channel.bufferedAmount <= limit) {
        resolve();
        return;
      }
      setTimeout(check, 30);
    };
    check();
  });
}
