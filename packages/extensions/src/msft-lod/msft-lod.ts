import { Extension, Node, ReaderContext, WriterContext, Material, PropertyType } from '@gltf-transform/core';
import { MSFT_LOD } from '../constants.js';
import {LOD} from './lod.js';


export class LODExtension extends Extension {
    public readonly extensionName = MSFT_LOD;
	public static readonly EXTENSION_NAME = MSFT_LOD;
    public readonly prewriteTypes = [PropertyType.BUFFER];

    /** Creates a new LOD property for use on a {@link Node} or {@link Material}. */
    public createLOD(name = ''): LOD {
        return new LOD(this.document.getGraph(), name);
    }

    /** @hidden */
    public read(context: ReaderContext): this {
        throw new Error('MSFT_lod: read() not implemented');
    }

    // modify for lods
    /** @hidden */
	public prewrite(context: WriterContext): this {

        function processLodsMapContext(node: Node, lodsLevel: number) {
            node.getMesh()?.listPrimitives().forEach((primitive) => {
                if(primitive.getIndices()) {
                    context.accessorLodsMap.set(primitive.getIndices()!, lodsLevel);
                }
                for (const attribute of primitive.listAttributes()) {
                    context.accessorLodsMap.set(attribute, lodsLevel);
                }
                const material = primitive.getMaterial();
                if(material) {
                    if(material.getBaseColorTexture()) {
                        context.textureLodsMap.set(material.getBaseColorTexture()!, lodsLevel);
                    }
                    if(material.getNormalTexture()) {
                        context.textureLodsMap.set(material.getNormalTexture()!, lodsLevel);
                    }
                    if(material.getEmissiveTexture()) {
                        context.textureLodsMap.set(material.getEmissiveTexture()!, lodsLevel);
                    }
                    if(material.getOcclusionTexture()) {
                        context.textureLodsMap.set(material.getOcclusionTexture()!, lodsLevel);
                    }
                    if(material.getMetallicRoughnessTexture()) {
                        context.textureLodsMap.set(material.getMetallicRoughnessTexture()!, lodsLevel);
                    }
                }
            });
        }

        let lodsMaxLevel = 0;
        for (const lod of this.properties) {
            const lods = (lod as LOD).listLODs();
            if(lods.length > lodsMaxLevel) {
                lodsMaxLevel = lods.length;
            }
            lod.listParents().forEach((parent: any) => {
                if (parent instanceof Node) {
                    processLodsMapContext(parent, 0);
                }
            });
            lods.forEach((node, nodeIndex) => {
                processLodsMapContext(node, nodeIndex + 1);
            });
        }
        context.lodsMaxLevel = lodsMaxLevel;
        return this;
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