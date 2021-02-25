/** Custom `fetch` function
 * @param url URL to fetch the resource from
 * @param type Type of the resource for the `XMLHttpRequest`
 * @param mime MIME type of the resource
 * @returns Fetched resource
 */
export default function getResource(url: string, type?: "text"): Promise<string>;
export default function getResource<T>(url: string, type: "json"): Promise<T>;
export default function getResource(url: string, type: "blob"): Promise<Blob>;
export default function getResource(url: string, type: XMLHttpRequestResponseType = "text"): Promise<any> {
	return fetch(url)
		.then(response => {
			if (response.ok) {
				switch (type) {
					case "blob": return response.blob();
					case "json": return response.json();
					case "text":
					default: return response.text();
				}
			} else {
				throw new Error(`${response.status} ${response.statusText} from ${url}`);
			}
		});
}
