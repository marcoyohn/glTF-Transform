import { ExtensionProperty, IProperty, Nullable, PropertyType, Node } from '@gltf-transform/core';
import { MSFT_LOD } from '../constants.js';


interface ILod extends IProperty {
    lods: Node[];
	coverages: number[];
	
}


export class LOD extends ExtensionProperty<ILod> {
    public static EXTENSION_NAME = MSFT_LOD;
	public declare extensionName: typeof MSFT_LOD;
	public declare propertyType: 'LOD';
	public declare parentTypes: [PropertyType.NODE, PropertyType.MATERIAL];

    protected init(): void {
        this.extensionName = MSFT_LOD;
        this.propertyType = 'LOD';
        this.parentTypes = [PropertyType.NODE, PropertyType.MATERIAL];
    }

    public setCoverages(coverages: number[]): this {
        return this.set('coverages', coverages);;
    }

    public getDefaults(): Nullable<ILod> {
        return Object.assign(super.getDefaults(), { lods: [] });
    }

    public listLODs(): Node[]{
        return this.listRefs('lods');
    }

    public listCoverages(): number[] {
        return this.get('coverages');
    }

    public addLOD(node: Node): this {
        return this.addRef('lods', node);
    }
}