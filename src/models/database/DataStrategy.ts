/** *Strategy* to fetch and store data objects
 * @template T Type of data objects
 * @template I Type of indexes
 */
export default interface DataStrategy<T, I = number> {
	/** `Promise` that will resolve when the database is ready to be used
	 *
	 * Will reject should an error occur during the preparation of the database.
	 */
	readonly isReady: Promise<this>;
	/** Put a data object in the database
	 * @param datum Data object to put
	 * @param id ID of the data object
	 * @returns ID of the data object
	 */
	putData(datum: T, id?: I): Promise<I>;
	/** Get a data object by ID
	 * @param id ID of the data object
	 * @returns Data object; or `undefined` if the ID does not exist
	 */
	getData(id: I): Promise<T | undefined>;
	/** Search data objects
	 *
	 * If no paramter is given, will return all data objects.
	 * @template P Type of valid properties
	 * @template V Type of values for the property
	 * @param property Property to search by
	 * @param value Value of the property to search with
	 * @returns Array of corresponding data objects
	 */
	searchData(): Promise<readonly T[]>;
	searchData<P, V>(property: P, value: V): Promise<readonly T[]>;
	searchData<P, V>(property?: P, value?: V): Promise<readonly T[]>;
	/** Clear all data objects */
	clearData(): Promise<void>;
	/** Put a blob in the database
	 * @param url URL of the blob
	 * @returns URL of the blob
	 */
	putBlob(url: string): Promise<string>;
	/** Get a blob by its URL
	 * @param url URL of the blob
	 * @returns Blob; or `undefined` if the blob URL does not exist
	 */
	getBlob(url: string): Promise<Blob | undefined>;
	/** Get all blobs
	 * @returns Array of blobs
	 */
	getAllBlobs(): Promise<readonly Blob[]>;
	/** Clear all blobs */
	clearBlobs(): Promise<void>;
}

export { default as LocalDataStrategy } from "./strategies/local";
export { default as OnlineDataStrategy } from "./strategies/online";
