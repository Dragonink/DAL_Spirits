import getResource from "../../../util/fetch";
import DataStrategy from "../DataStrategy";

/** Definition of the schema for an `IDBDatabase`
 * @template T Type of data objects
 */
export interface DatabaseSchema<T> {
	/** Name of the database
	 *
	 * Should be the same regardless of the version.
	 */
	readonly name: string;
	/** Version of the database schema
	 *
	 * Should be incremented when some changes are done in this object.
	 */
	readonly version: number;
	/** Definition of the `data` object store */
	readonly dataObjectStore?: {
		/** Options of the object store */
		readonly options?: IDBObjectStoreParameters;
		/** Definitions of the indexes for the object store */
		readonly indexes?: {
			/** Name of the index */
			readonly name: string;
			/** Key path to use */
			readonly keyPath: (string & keyof T) | (string & keyof T)[];
			/** Options of the index */
			readonly options?: IDBIndexParameters;
		}[];
	};
}
interface DatabaseBlob {
	readonly url: string;
	blob: Blob;
}
/** Data *strategy*: data will be cached with `IndexedDB`
 *
 * **All operations are done given `isReady` is resolved.**
 * @template T Type of data objects
 * @template I Type of data indexes
*/
export default class LocalDataStrategy<T, I extends IDBValidKey> implements DataStrategy<T, I> {
	/** Key to latest hash in `localStorage` */
	public static readonly HASH_STORAGE: string = "LOCAL-hash";
	/** Storage for all objects */
	private database!: IDBDatabase;
	/** Storage for `Promise` objects that resolve when a blob has been fetched */
	private readonly blobFetched: Record<string, Promise<any>> = {};
	/** Get the current hash from `localStorage` */
	public get hash(): string | null {
		return window.localStorage.getItem(LocalDataStrategy.HASH_STORAGE);
	}
	/** Set the current hash in `localStorage`
	 *
	 * Passing `null` will delete the storage pair.
	 */
	public set hash(hash: string | null) {
		if (hash) {
			window.localStorage.setItem(LocalDataStrategy.HASH_STORAGE, hash);
		} else {
			window.localStorage.removeItem(LocalDataStrategy.HASH_STORAGE);
		}
	}

	/**
	 * @param dbSchema Schema to construct the database from
	 */
	public constructor(dbSchema: DatabaseSchema<T>) {
		this.isReady = new Promise<void>((resolve, reject) => {
			const request = window.indexedDB.open(dbSchema.name, dbSchema.version);
			request.onerror = _event => reject(request.error!);
			request.onsuccess = _event => {
				this.database = request.result;
				return resolve();
			};
			request.onupgradeneeded = event => {
				this.hash = null;
				const database = (event.target as IDBOpenDBRequest).result;
				(objectStore => {
					dbSchema.dataObjectStore?.indexes?.forEach(index => void objectStore.createIndex(index.name, index.keyPath, index.options));
				})(database.createObjectStore("data", dbSchema.dataObjectStore?.options));
				database.createObjectStore("blobs", { keyPath: "url" });
			};
		})
			// Mark blobs in the database as fetched
			.then(() => new Promise((resolve, reject) => {
				const request = this.database.transaction("blobs").objectStore("blobs").openKeyCursor();
				request.onerror = _event => reject(request.error!);
				request.onsuccess = _event => {
					const cursor = request.result;
					if (cursor) {
						this.blobFetched[cursor.key as string] = Promise.resolve();
						return cursor.continue();
					} else {
						return resolve(this);
					}
				};
			}));
	}

	readonly isReady: Promise<this>;
	putData(datum: T, id?: I): Promise<I> {
		return this.isReady
			.then(() => new Promise((resolve, reject) => {
				const request = this.database.transaction("data", "readwrite").objectStore("data").put(datum, id);
				request.onerror = _event => reject(request.error!);
				request.onsuccess = _event => resolve(request.result as I);
			}));
	}
	getData(id: I): Promise<T | undefined> {
		return this.isReady
			.then(() => new Promise((resolve, reject) => {
				const request = this.database.transaction("data").objectStore("data").get(id);
				request.onerror = _event => reject(request.error!);
				request.onsuccess = _event => resolve(request.result);
			}));
	}
	searchData(): Promise<readonly T[]>;
	searchData<V extends IDBValidKey>(index: string, value: V): Promise<readonly T[]>;
	searchData<V extends IDBValidKey>(index?: string, value?: V): Promise<readonly T[]> {
		return this.isReady
			.then(() => new Promise((resolve, reject) => {
				const foundData: T[] = [];
				const objectStore = this.database.transaction("data").objectStore("data");
				const request = index && value ? objectStore.index(index).openCursor(value) : objectStore.openCursor();
				request.onerror = _event => reject(request.error!);
				request.onsuccess = _event => {
					const cursor = request.result;
					if (cursor) {
						foundData.push(cursor.value);
						return cursor.continue();
					} else {
						return resolve(foundData);
					}
				};
			}));
	}
	clearData(): Promise<void> {
		this.hash = null;
		return this.isReady
			.then(() => new Promise((resolve, reject) => {
				const request = this.database.transaction("data", "readwrite").objectStore("data").clear();
				request.onerror = _event => reject(request.error!);
				request.onsuccess = _event => resolve();
			}));
	}
	putBlob(url: string): Promise<string> {
		return this.blobFetched[url] = this.isReady
			.then(() => getResource(url, "blob"))
			.then(blob => new Promise((resolve, reject) => {
				const request = this.database.transaction("blobs", "readwrite").objectStore("blobs").put({ url, blob });
				request.onerror = _event => reject(request.error!);
				request.onsuccess = _event => resolve(request.result as string);
			}));
	}
	getBlob(url: string): Promise<Blob | undefined> {
		const promise = new Promise<Blob | undefined>((resolve, reject) => {
			const request: IDBRequest<DatabaseBlob> = this.database.transaction("blobs").objectStore("blobs").get(url);
			request.onerror = _event => reject(request.error!);
			request.onsuccess = _event => resolve(request.result?.blob);
		});
		return this.isReady
			.then(() => promise)
			.then(blob => {
				if (blob) {
					return blob;
				} else if (url in this.blobFetched) {
					return this.blobFetched[url]!
						.then(() => promise);
				} else {
					return undefined;
				}
			});
	}
	getAllBlobs(): Promise<readonly Blob[]> {
		return this.isReady
			.then(() => new Promise((resolve, reject) => {
				const allBlobs: Blob[] = [];
				const request = this.database.transaction("blobs").objectStore("blobs").openCursor();
				request.onerror = _event => reject(request.error!);
				request.onsuccess = _event => {
					const cursor = request.result;
					if (cursor) {
						allBlobs.push((cursor.value as DatabaseBlob).blob);
						return cursor.continue();
					} else {
						return resolve(allBlobs);
					}
				};
			}));
	}
	async clearBlobs(): Promise<void> {
		for (const blobURL in this.blobFetched) if (this.blobFetched.hasOwnProperty(blobURL)) {
			delete this.blobFetched[blobURL];
		}
		return this.isReady
			.then(() => new Promise((resolve, reject) => {
				const request = this.database.transaction("blobs", "readwrite").objectStore("blobs").clear();
				request.onerror = _event => reject(request.error!);
				request.onsuccess = _event => resolve();
			}));
	}
}
