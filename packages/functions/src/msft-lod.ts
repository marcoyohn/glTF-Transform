import { Document, Node, Texture, Transform, vec2, TransformContext, Mesh } from '@gltf-transform/core';
import { LODExtension } from '@gltf-transform/extensions';
import { MeshoptSimplifier } from 'meshoptimizer';
import { createTransform } from "./utils.js";
import { weld } from './weld.js';
import { simplifyPrimitive } from './simplify.js';
import { textureResize } from './texture-resize.js';
import { dedup } from './dedup.js';

const NAME = 'msft-lod';

export interface MsfLodOptions {
    ratio?: string;
    error?: string;
    coverage?: string;
    texture?: string;
}

const MSFLOD_DEFAULTS: Required<MsfLodOptions> = {
    ratio: '0.5,0.1',
    error: '0.01,0.05',
    coverage: '0.7,0.3,0.0',
    texture: '512x512,128x128',
};


export function msftLod(_options: MsfLodOptions): Transform {
    const options = {...MSFLOD_DEFAULTS, ..._options} as Required<MsfLodOptions>;
    const ratios = options.ratio.split(',').map(value => Number(value));
    const errors = options.error.split(',').map(value => Number(value));
    const coverages = options.coverage.split(',').map(value => Number(value));
    const textureSizes = options.texture.split(',').map(value => value.split('x').map(v => Number(v)));

    return createTransform(NAME, async (document: Document, context?: TransformContext): Promise<void> => {
        const lodExtension = document.createExtension(LODExtension);

        await MeshoptSimplifier.ready;
        const simplifier = MeshoptSimplifier;
        await document.transform(weld());

        const cloneTextureIfNeeded = (texture: Texture, resizeTextureSize: number[], suffix: string) => {
            if (texture) {
                const size = texture.getSize()!;
                if (size[0] > resizeTextureSize[0] || size[1] > resizeTextureSize[1]) {
                    return texture.clone().setName(texture.getName() + suffix);
                }
            }
            return texture;
        };

        // strip all animations
        for (const animation of document.getRoot().listAnimations()) {
            animation.dispose();
        }

        for (const mesh of document.getRoot().listMeshes()) {

            // log vertex count of mesh
            // let vertexCount = 0;
            // for (const prim of mesh.listPrimitives()) {
            //     vertexCount += prim.getAttribute('POSITION')!.getArray()!.length;
            // }
            // console.log(`Mesh ${mesh.getName()} has ${vertexCount} vertices.`);
            // if (vertexCount < 1000) continue;

            // Generate LOD Primitives.
            const lodMeshes: Mesh[] = [];
            for (let i = 0; i < ratios.length; i++) {
                const ratio = ratios[i];
                const error = errors[i];
                const suffix = `_LOD${i + 1}`;
                const lodMesh = document.createMesh(mesh.getName() + suffix);
                for (const prim of mesh.listPrimitives()) {
                    const lodPrimitive = 
                    simplifyPrimitive(document, prim.clone(), { ratio: ratio, error: error, simplifier });
                    if (prim.getName()) {
                        lodPrimitive.setName(mesh.getName() + suffix);
                    }

                    // Generate LOD textures and materials if texture resize is needed.
                    if (textureSizes.length > 0) {
                        const textureSize = textureSizes[i];
                        const material = prim.getMaterial()!;

                        const lodBaseColorTexture =
                            cloneTextureIfNeeded(material.getBaseColorTexture()!, textureSize, suffix);
                        const lodEmissiveTexture =
                            cloneTextureIfNeeded(material.getEmissiveTexture()!, textureSize, suffix);
                        const lodMetallicRoughnessTexture =
                            cloneTextureIfNeeded(material.getMetallicRoughnessTexture()!, textureSize, suffix);
                        const lodNormalTexture =
                            cloneTextureIfNeeded(material.getNormalTexture()!, textureSize, suffix);
                        const lodOcclusionTexture =
                            cloneTextureIfNeeded(material.getOcclusionTexture()!, textureSize, suffix);

                        if (lodBaseColorTexture !== material.getBaseColorTexture() ||
                            lodEmissiveTexture !== material.getEmissiveTexture() ||
                            lodMetallicRoughnessTexture !== material.getMetallicRoughnessTexture() ||
                            lodNormalTexture !== material.getNormalTexture() ||
                            lodOcclusionTexture !== material.getOcclusionTexture()) {
                            const lodMaterial = material.clone().setName(material.getName() + suffix);
                            lodMaterial.setBaseColorTexture(lodBaseColorTexture);
                            lodMaterial.setEmissiveTexture(lodEmissiveTexture);
                            lodMaterial.setMetallicRoughnessTexture(lodMetallicRoughnessTexture);
                            lodMaterial.setNormalTexture(lodNormalTexture);
                            lodMaterial.setOcclusionTexture(lodOcclusionTexture);
                            lodPrimitive.setMaterial(lodMaterial);
                        }
                    }

                    lodMesh.addPrimitive(lodPrimitive);
                }
                lodMeshes.push(lodMesh);
            }

            // Attach LODs to all Nodes referencing this Mesh.
            const lod = lodExtension.createLOD().setCoverages(coverages);

            for (const lodMesh of lodMeshes) {
                lod.addLOD(document.createNode(lodMesh.getName()).setMesh(lodMesh));
            }

            mesh.listParents().forEach((parent) => {
                if (parent instanceof Node) {
                    parent.setExtension('MSFT_lod', lod);
                    // add child nodes with these meshes
                    // todo 以下逻辑应该是不需要的
                    // for (const lodMesh of lodMeshes) {
                    //     parent.addChild(document.createNode(lodMesh.getName()).setMesh(lodMesh));
                    // }
                }
            });
        }

        for (let i = 0; i < textureSizes.length; i++) {
            await document.transform(textureResize({
                size: textureSizes[i] as vec2,
                pattern: new RegExp(`_LOD${i + 1}$`)
            }));
        }

        await document.transform(dedup());
    });

}