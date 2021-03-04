import getResource from "../../../util/fetch";
import DataStrategy from "../DataStrategy";

interface DatabaseBlob {
	blob?: Blob;
	isFetched: Promise<any>;
}
/** Default data *strategy*: data will be fetched every time
 * @template T Type of data objects
 */
export default class OnlineDataStrategy<T> implements DataStrategy<T> {
	/** Storage for data objects */
	private readonly data: T[] = [];
	/** Storage for blobs */
	private readonly blobs: Record<string, DatabaseBlob> = {};

	readonly isReady = Promise.resolve(this);
	async putData(datum: T, id?: number): Promise<number> {
		if (id) {
			this.data[id] = datum;
			return id;
		} else {
			return this.data.push(datum) - 1;
		}
	}
	async getData(id: number): Promise<T | undefined> {
		return id in this.data ? this.data[id] : undefined;
	}
	async searchData(): Promise<readonly T[]>;
	async searchData<K extends keyof T>(property: K, value: T[K]): Promise<readonly T[]>;
	async searchData<K extends keyof T>(property?: K, value?: T[K]): Promise<readonly T[]> {
		return property && value ? this.data.filter(datum => datum[property] === value) : this.data;
	}
	async clearData(): Promise<void> {
		this.data.length = 0;
	}
	putBlob(url: string): Promise<string> {
		this.blobs[url] = {
			isFetched: getResource(url, "blob")
				.then(blob => {
					this.blobs[url]!.blob = blob;
					return url;
				}),
		};
		return this.blobs[url]!.isFetched;
	}
	async getBlob(url: string): Promise<Blob | undefined> {
		if (url in this.blobs) {
			return this.blobs[url]!.blob ?? this.blobs[url]!.isFetched
				.then(() => this.blobs[url]!.blob)
				.catch(error => {
					if (error) {
						console.warn(error);
					}
					return undefined;
				})
		} else {
			return undefined;
		}
	}
	async getAllBlobs(): Promise<readonly Blob[]> {
		return Object.values(this.blobs)
			.map(dbBlob => dbBlob.blob)
			.filter((blob): blob is Blob => blob !== undefined);
	}
	async clearBlobs(): Promise<void> {
		for (const blobURL in this.blobs) if (this.blobs.hasOwnProperty(blobURL)) {
			delete this.blobs[blobURL];
		}
	}
}
