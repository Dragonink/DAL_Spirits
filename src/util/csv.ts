/** Parse CSV to an array of objects
 * @template T Type of parsed data
 * @param csv Raw CSV
 * @returns Array of objects
 */
export default function parseCSV<T extends Record<string, string | number | boolean | undefined>>(csv: string): T[] {
	const data: T[] = [];
	const headers: (keyof T)[] = [];
	csv.trim().split("\n")
		.filter(line => !/^\s*$/.test(line))
		.forEach(line => {
			if (headers.length === 0) {
				headers.push(...line.split(",") as (keyof T)[]);
			} else {
				const fields = line.split(",").map(field => field.trim());
				if (fields.length === headers.length) {
					const datum: any = {};
					fields.forEach((field, i) => void (datum[headers[i]!] = (() => {
						switch (field) {
							case "": return undefined;
							case "true": return true;
							case "false": return false;
							default: return /^\d+(?:\.\d+)?$/.test(field) ? Number(field) : field;
						}
					})()));
					data.push(datum as T);
				} else {
					console.error("CSV PARSE ERROR: %d fields expected, %d fields given\n%s", headers.length, fields.length, line);
				}
			}
		});
	return data;
}
