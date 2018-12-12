import { GLTFContainer, GLTFUtil, LoggerVerbosity } from 'gltf-transform-util';

const splice = (buffer: ArrayBuffer, begin: number, count: number): Array<ArrayBuffer> => {
  const a1 = buffer.slice(0, begin);
  const a2 = buffer.slice(begin + count);
  const a = join(a1, a2);
  const b = buffer.slice(begin, begin + count);
  return [a, b];
};

const join = (a: ArrayBuffer, b: ArrayBuffer): ArrayBuffer => {
  const out = new Uint8Array(a.byteLength + b.byteLength);
  out.set(new Uint8Array(a), 0);
  out.set(new Uint8Array(b), a.byteLength);
  return out.buffer;
}

const split = function (container: GLTFContainer, meshes: Array<string>): GLTFContainer {

  const json = container.json;
  const logger = GLTFUtil.createLogger('gltf-transform-split', LoggerVerbosity.INFO);

  // Create Buffer instances.
  json.buffers.forEach((buffer, bufferIndex) => {
    if (buffer.uri && buffer.uri.match(/^data:/)) {
      const uri = buffer.uri;
      buffer.uri = `buffer${bufferIndex}.bin`;
      buffer['_buffer'] = GLTFUtil.createBufferFromDataURI(uri);
      return;
    }
    throw new Error('Only buffers using Data URIs are currently supported');
  });

  const bufferViewMap = {};

  // Group bufferviews by mesh.
  json.meshes.forEach((mesh) => {
    if (meshes.indexOf(mesh.name) === -1) return;
    mesh.primitives.forEach((prim) => {
      if (prim.indices) markAccessor(json.accessors[prim.indices]);
      Object.keys(prim.attributes).forEach((attrName) => {
        markAccessor(json.accessors[prim.attributes[attrName]]);
      });

      function markAccessor(accessor) {
        const bufferView = json.bufferViews[accessor.bufferView];
        if (bufferViewMap[accessor.bufferView] === undefined) {
          bufferViewMap[accessor.bufferView] = mesh.name;
        } else if (bufferViewMap[accessor.bufferView] !== mesh.name) {
          throw new Error('Not implemented: Two meshes share a bufferview.');
        }
      };
    });
  });

  // Write data for each mesh to a new buffer.
  meshes.forEach((meshName) => {
    let buffer = GLTFUtil.createBuffer();

    logger.info(`📦  ${meshName}`);

    json.bufferViews.forEach((bufferView, bufferViewIndex) => {
      if (bufferViewMap[bufferViewIndex] !== meshName) return;
      logger.info(meshName + ':' + bufferViewIndex);

      // Extract data from original buffer.
      logger.info(`original before: ${json.buffers[bufferView.buffer]['_buffer'].byteLength} w/ offset ${bufferView.byteOffset} and length ${bufferView.byteLength}`);
      const [ original, tmp ] = splice(json.buffers[bufferView.buffer]['_buffer'], bufferView.byteOffset, bufferView.byteLength);
      logger.info(`spliced: ${tmp.byteLength}`);
      json.buffers[bufferView.buffer]['_buffer'] = original;
      logger.info(`original after: ${json.buffers[bufferView.buffer]['_buffer'].byteLength}`);

      // Write data to new buffer.
      const affectedByteOffset = bufferView.byteOffset + bufferView.byteLength;
      const affectedBuffer = bufferView.buffer;
      bufferView.byteOffset = buffer.byteLength;
      bufferView.buffer = json.buffers.length;
      buffer = join(buffer, tmp);

      // Update remaining buffers.
      json.bufferViews.forEach((affectedBufferView) => {
        if (affectedBufferView.buffer === affectedBuffer
          && affectedBufferView.byteOffset >= affectedByteOffset) {
          affectedBufferView.byteOffset -= bufferView.byteLength;
        }
      });
      // TODO: Update embedded images, or throw an error.
    });

    const meshBuffer = { uri: `${meshName}.bin`, byteLength: undefined } as GLTF.IBuffer;
    meshBuffer['_buffer'] = buffer;
    json.buffers.push(meshBuffer);
  });

  // Filter out empty buffers.
  json.buffers = json.buffers.filter((buffer, bufferIndex) => {
    buffer.byteLength = buffer['_buffer'].byteLength;
    delete buffer['_buffer'];
    if (buffer.byteLength > 0) return true;
    json.bufferViews.forEach((bufferView) => {
      if (bufferView.buffer >= bufferIndex) bufferView.buffer--;
    });
    return false;
  });

  return container;
}

const test = 'test';

export { split, test };
