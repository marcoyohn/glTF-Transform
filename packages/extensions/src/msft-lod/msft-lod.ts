import { Extension, Node, ReaderContext, WriterContext, Material } from '@gltf-transform/core';
import { MSFT_LOD } from '../constants.js';
import {LOD} from './lod.js';


export class LODExtension extends Extension {
    public readonly extensionName = MSFT_LOD;
	public static readonly EXTENSION_NAME = MSFT_LOD;

    /** Creates a new LOD property for use on a {@link Node} or {@link Material}. */
    public createLOD(name = ''): LOD {
        return new LOD(this.document.getGraph(), name);
    }

    /** @hidden */
    public read(context: ReaderContext): this {
        throw new Error('MSFT_lod: read() not implemented');
    }

    /** @hidden */
    public write(context: WriterContext): this {
        const jsonDoc = context.jsonDoc;

        for (const lod of this.properties) {
            const ids = (lod as LOD).listLODs().map((node) => context.nodeIndexMap.get(node));
            const coverages = (lod as LOD).listCoverages();
            lod.listParents().forEach((parent: any) => {
                if (parent instanceof Node) {
                    const nodeIndex = context.nodeIndexMap.get(parent);
                    const nodeDef = jsonDoc.json.nodes![nodeIndex!];
                    nodeDef.extensions = nodeDef.extensions || {};
                    nodeDef.extensions[MSFT_LOD] = { ids };
                    nodeDef.extras = nodeDef.extras || {};
                    nodeDef.extras['MSFT_screencoverage'] = coverages;
                }
            });
        }

        return this;
    }
}