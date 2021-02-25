import getResource from "../util/fetch";

/** *Strategy* to fetch and store data
 * @template T Type of data
 * @template I Type of data IDs
 */
export interface DataStrategy<T, I = number> {
	/** Strategy type */
	readonly TYPE: "ONLINE" | "LOCAL";
	/** Add new data
	 * @param data Data object
	 * @returns ID of the data object
	 */
	newData(data: T): Promise<I>;
	/** Get data by ID
	 * @param id ID of the data object
	 * @returns Data object
	 */
	getData(id: I): Promise<T | undefined>;
	/** Search data
	 * @param property Property to use as criterion
	 * @param value Property value to search
	 * @returns Array of corresponding data
	 */
	searchData(property: any, value: any): Promise<T[]>;
	/** Get all data
	 * @returns Array of all data
	 */
	getAllData(): Promise<T[]>;
	/** Set data by ID
	 * @param id ID of the data object
	 * @param data Data object
	 */
	setData(id: I, data: T): Promise<void>;
	/** Add new blob
	 * @param url URL to fetch the blob from
	 */
	newBlob(url: string): Promise<void>;
	/** Apply an URL to a blob
	 * @param url URL of the blob
	 * @param apply Function to apply an URL to the blob
	 * @param type Type of URL to pass in `apply`
	 * @param fallback Function called if the blob could not be found
	 */
	applyBlob(url: string, apply: (url: string) => void, type?: "blob" | "data", fallback?: () => void): void;
	/** Get all blob URLs
	 * @returns Array of all blob URLs
	 */
	getAllBlobs(): Promise<string[]>;
	/** Update a blob
	 * @param url URL of the blob
	 */
	updateBlob(url: string): Promise<void>;
	/** Clear the database */
	clear(): Promise<void>;
}

interface SingleBlobEventStore {
	fetched: boolean;
	readonly events: (() => void)[];
}
/** Event store for fetching blobs */
class BlobEventStore {
	/** Storage for functions to be called when a blob is fetched, mapped by URL */
	private readonly eventStore: Record<string, SingleBlobEventStore> = {};

	/** Add an event listener for a blob
	 * @param url URL of the blob
	 * @param listener Function to call when the blob is fetched
	 */
	public addEventListener(url: string, listener: () => void) {
		if (!this.eventStore[url]) {
			this.eventStore[url] = {
				fetched: false,
				events: [],
			};
		}
		const blobEventStore = this.eventStore[url]!;
		return blobEventStore.fetched ? listener() : void blobEventStore.events.push(listener);
	}
	/** Dispatch the event because the blob has been fetched
	 * @param url URL of the blob
	 */
	public dispatchEvent(url: string) {
		if (this.eventStore[url]) {
			const blobEventStore = this.eventStore[url]!;
			if (!blobEventStore.fetched) {
				blobEventStore.fetched = true;
				blobEventStore.events.forEach(listener => listener());
				blobEventStore.events.length = 0;
			}
		} else {
			this.eventStore[url] = {
				fetched: true,
				events: [],
			};
		}
	}
}

/** Default data *strategy*: data will be fetched every time
 * @template T Type of data
 */
class OnlineDataStrategy<T> implements DataStrategy<T> {
	readonly TYPE = "ONLINE";
	/** Data storage */
	private readonly data: T[] = [];
	/** Blobs storage */
	private readonly blobs: Record<string, Blob> = {};
	/** Event storage for blobs */
	private readonly blobEventStore = new BlobEventStore();

	async newData(data: T): Promise<number> {
		return this.data.push(data) - 1;
	}
	async getData(id: number): Promise<T | undefined> {
		return this.data[id];
	}
	/**
	 * @template K Type of property
	 * @template V Type of property value
	 */
	async searchData<K extends keyof T, V extends T[K]>(property: K, value: V): Promise<T[]> {
		return this.data.filter(datum => property in datum && datum[property] === value);
	}
	async getAllData(): Promise<T[]> {
		return this.data;
	}
	async setData(id: number, data: T) {
		this.data[id] = data;
	}
	newBlob(url: string): Promise<void> {
		return url in this.blobs ? Promise.reject() :
			getResource(url, "blob")
				.then(blob => {
					this.blobs[url] = blob;
					return this.blobEventStore.dispatchEvent(url);
				});
	}
	applyBlob(url: string, apply: (url: string) => void, type: "blob" | "data" = "blob", _fallback = console.error) {
		return this.blobEventStore.addEventListener(url, () => {
			switch (type) {
				case "data": {
					const reader = new FileReader();
					reader.onload = _event => apply(reader.result as string);
					return reader.readAsDataURL(this.blobs[url]!);
				}
				case "blob":
				default: {
					const blobURL = URL.createObjectURL(this.blobs[url]);
					apply(blobURL);
					return URL.revokeObjectURL(blobURL);
				}
			}
		});
	}
	async getAllBlobs(): Promise<string[]> {
		return Object.keys(this.blobs);
	}
	updateBlob(url: string): Promise<void> {
		return url in this.blobs ? getResource(url, "blob")
			.then(blob => {
				this.blobs[url] = blob;
				return this.blobEventStore.dispatchEvent(url);
			}) :
			Promise.reject(new Error(`${url} is not a valid blob URL`));
	}
	async clear() {
		this.data.length = 0;
		Object.keys(this.blobs).forEach(key => void delete this.blobs[key]);
	}
}
type OnlineDataStrategyConstructor<T> = new () => OnlineDataStrategy<T>;

/** Definition of the schema for an `IDBDatabase`
 * @template T Type of data
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
	dataObjectStore?: {
		/** Options of the object store */
		options?: IDBObjectStoreParameters;
		/** Definitions of the indexes for the object store */
		indexes?: {
			/** Name of the index */
			name: string;
			/** Key path to use */
			keyPath: (string & keyof T) | (string & keyof T)[];
			/** Options of the index */
			options?: IDBIndexParameters;
		}[];
	};
}
/** Definition of a blob in database */
interface DatabaseBlob {
	readonly url: string;
	blob: Blob;
}
/** Data *strategy*: data will be cached with `IndexedDB`
 * @template T Type of data
 * @template I Type of data IDs
*/
class LocalDataStrategy<T, I extends IDBValidKey> implements DataStrategy<T, I> {
	readonly TYPE = "LOCAL";
	/** Database storing data and blobs */
	private database?: IDBDatabase;
	/** Queue storing tasks to be executed when the database is ready */
	private taskQueue: (() => Promise<any>)[] = [];
	/** Event storage for blobs */
	private readonly blobEventStore = new BlobEventStore();

	/**
	 * @param dbSchema Schema of the database
	 * @param fallback Fallback function if an error happens
	 */
	public constructor(dbSchema: DatabaseSchema<T>, fallback: (error: DOMException) => void) {
		new Promise<IDBDatabase>((resolve, reject) => {
			const request = window.indexedDB.open(dbSchema.name, dbSchema.version);
			request.onerror = _event => reject(request.error!);
			request.onsuccess = _event => resolve(request.result);
			request.onupgradeneeded = event => {
				const database = (event.target as IDBOpenDBRequest).result;
				{
					const objectStore = database.createObjectStore("data", dbSchema.dataObjectStore?.options);
					dbSchema.dataObjectStore?.indexes?.forEach(index => void objectStore.createIndex(index.name, index.keyPath, index.options));
				}
				database.createObjectStore("blobs", { keyPath: "url" });
			};
		})
			.then(database => {
				this.database = database;
				Promise.allSettled(this.taskQueue.map(task => task()))
					.then(_results => this.getAllBlobs())
					.then(blobs => blobs.forEach(blob => this.blobEventStore.dispatchEvent(blob)));
				this.taskQueue.length = 0;
			})
			.catch(fallback);
	}

	newData(data: T): Promise<I> {
		return this.database ? new Promise((resolve, reject) => {
			const request = this.database!.transaction("data", "readwrite").objectStore("data")
				.add(data);
			request.onerror = _event => reject(request.error!);
			request.onsuccess = event => resolve((event.target as IDBRequest<I>).result);
		}) :
			new Promise((resolve, reject) => void this.taskQueue.push(() => this.newData(data).then(resolve).catch(reject)));
	}
	getData(id: I): Promise<T | undefined> {
		return this.database ? new Promise((resolve, _reject) => {
			this.database!.transaction("data").objectStore("data")
				.get(id)
				.onsuccess = event => resolve((event.target as IDBRequest<T>).result);
		}) :
			new Promise((resolve, reject) => void this.taskQueue.push(() => this.getData(id).then(resolve).catch(reject)));
	}
	/** Search data using an index
	 * @template V Type of property value
	 * @param index Name of the index to use
	 * @param value Property value to search
	 * @throws {Error} if `index` is not an existing index
	 */
	searchData<V extends IDBValidKey>(index: string, value: V): Promise<T[]> {
		if (this.database) {
			const objectStore = this.database.transaction("data").objectStore("data");
			if (objectStore.indexNames.contains(index)) {
				return new Promise((resolve, _reject) => {
					const correspondingData: T[] = [];
					objectStore.index(index)
						.openCursor(value)
						.onsuccess = event => {
							const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
							if (cursor) {
								correspondingData.push(cursor.value);
								cursor.continue();
							} else {
								return resolve(correspondingData);
							}
						};
				});
			} else {
				throw new Error(`'${index}' is not an existing index`);
			}
		} else {
			return new Promise((resolve, reject) => void this.taskQueue.push(() => this.searchData(index, value).then(resolve).catch(reject)));
		}
	}
	getAllData(): Promise<T[]> {
		return this.database ? new Promise((resolve, _reject) => {
			const allData: T[] = [];
			this.database!.transaction("data").objectStore("data")
				.openCursor()
				.onsuccess = event => {
					const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
					if (cursor) {
						allData.push(cursor.value);
						cursor.continue();
					} else {
						return resolve(allData);
					}
				};
		}) :
			new Promise((resolve, reject) => void this.taskQueue.push(() => this.getAllData().then(resolve).catch(reject)));
	}
	setData(id: I, data: T): Promise<void> {
		return this.database ? new Promise((resolve, reject) => {
			const request = this.database!.transaction("data", "readwrite").objectStore("data")
				.put(data, id);
			request.onerror = _event => reject(request.error!);
			request.onsuccess = _event => resolve();

		}) :
			new Promise((resolve, reject) => void this.taskQueue.push(() => this.setData(id, data).then(resolve).catch(reject)));
	}
	newBlob(url: string): Promise<void> {
		return this.database ? getResource(url, "blob")
			.then(blob => new Promise((resolve, reject) => {
				const request = this.database!.transaction("blobs", "readwrite").objectStore("blobs")
					.add({ url, blob });
				request.onerror = _event => reject(request.error!);
				request.onsuccess = _event => {
					this.blobEventStore.dispatchEvent(url);
					return resolve();
				};
			})) :
			new Promise((resolve, reject) => void this.taskQueue.push(() => this.newBlob(url).then(resolve).catch(reject)));
	}
	applyBlob(url: string, apply: (blobURL: string) => void, type: "blob" | "data" = "blob", fallback = console.error): void {
		return this.database ? this.blobEventStore.addEventListener(url, () => {
			this.database!.transaction("blobs").objectStore("blobs")
				.get(url)
				.onsuccess = event => {
					const blob = (event.target as IDBRequest<DatabaseBlob>).result?.blob;
					if (blob) {
						switch (type) {
							case "data": {
								const reader = new FileReader();
								reader.onload = _event => apply(reader.result as string);
								return reader.readAsDataURL(blob);
							}
							case "blob":
							default: {
								const blobURL = URL.createObjectURL(blob);
								apply(blobURL);
								return URL.revokeObjectURL(blobURL);
							}
						}
					} else {
						fallback("Could not apply blob %s", url);
					}
				};
		}) :
			void this.taskQueue.push(async () => this.applyBlob(url, apply, type, fallback));
	}
	getAllBlobs(): Promise<string[]> {
		return this.database ? new Promise((resolve, _reject) => {
			const allBlobs: string[] = [];
			this.database!.transaction("blobs").objectStore("blobs")
				.openCursor()
				.onsuccess = event => {
					const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
					if (cursor) {
						allBlobs.push((cursor.value as DatabaseBlob).url);
						cursor.continue();
					} else {
						return resolve(allBlobs);
					}
				};
		}) :
			new Promise((resolve, reject) => void this.taskQueue.push(() => this.getAllBlobs().then(resolve).catch(reject)));
	}
	updateBlob(url: string): Promise<void> {
		return this.database ? getResource(url, "blob")
			.then(blob => new Promise((resolve, reject) => {
				const objectStore = this.database!.transaction("blobs", "readwrite").objectStore("blobs");
				objectStore.get(url)
					.onsuccess = event => {
						const dbBlob = (event.target as IDBRequest<DatabaseBlob>).result;
						if (dbBlob) {
							dbBlob.blob = blob;
							const request = objectStore.put(dbBlob);
							request.onerror = _event => reject(request.error!);
							request.onsuccess = _event => {
								this.blobEventStore.dispatchEvent(url);
								return resolve();
							};
						} else {
							return reject();
						}
					};
			})) :
			new Promise((resolve, reject) => void this.taskQueue.push(() => this.updateBlob(url).then(resolve).catch(reject)));
	}
	clear(): Promise<void> {
		return this.database ? Promise.all<void>([
			new Promise((resolve, _reject) => {
				this.database!.transaction("data", "readwrite").objectStore("data")
					.clear()
					.onsuccess = _event => resolve();
			}),
			new Promise((resolve, _reject) => {
				this.database!.transaction("blobs", "readwrite").objectStore("blobs")
					.clear()
					.onsuccess = _event => resolve();
			})
		]).then(_results => { }) :
			new Promise((resolve, reject) => void this.taskQueue.push(() => this.clear().then(resolve).catch(reject)));
	}
}
type LocalDataStrategyConstructor<T, I extends IDBValidKey> = new (dbSchema: DatabaseSchema<T>, fallback: (error: DOMException) => void) => LocalDataStrategy<T, I>;

export default function chooseDatabase<T>(useStorage: false): OnlineDataStrategyConstructor<T>;
export default function chooseDatabase<T, I extends IDBValidKey>(useStorage: true): LocalDataStrategyConstructor<T, I>;
export default function chooseDatabase<T>(useStorage = true): new (...args: any[]) => DataStrategy<T> {
	return useStorage ? LocalDataStrategy : OnlineDataStrategy;
}
