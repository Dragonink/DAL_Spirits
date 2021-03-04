type CSVParsable = string | number | boolean | undefined;

/** Parse CSV to an array of objects
 * @template T Type of parsed data
 * @param csv Raw CSV
 * @returns Array of objects
 */
export default function parseCSV<T extends Record<string, CSVParsable>>(csv: string): T[] {
	const data: T[] = [];
	const headers: string[] = [];
	csv.trim().split("\n")
		.filter(line => !/^\s*$/.test(line))
		.forEach(line => {
			if (headers.length === 0) {
				headers.push(...line.split(","));
			} else {
				const fields = line.split(",").map(field => field.trim());
				if (fields.length === headers.length) {
					const datum: Record<string, CSVParsable> = {};
					fields.forEach((field, i) => void (datum[headers[i]!] = (() => {
						switch (field) {
							case "": return undefined;
							case "true": return true;
							case "false": return false;
							default: {
								const number = Number(field);
								return isNaN(number) ? field : number;
							};
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
