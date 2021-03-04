interface Point {
	x: number;
	y: number;
}

/** Compute a position on a segment
 * @param from Extremum of the segment
 * @param to Extremum of the segment
 * @param percentage Percentage on the segment (0 = `from`; 1 = `to`)
 */
function segmentPosition(from: SVGPoint, to: SVGPoint, percentage: number): Point {
	return {
		x: (to.x - from.x) * percentage,
		y: (to.y - from.y) * percentage,
	};
}

export default class SpiritGraph<L extends string> {
	/** HTML SVG element */
	private readonly GRAPH: SVGSVGElement;
	/** Array of the stat labels */
	private readonly labels: readonly L[];
	/** Function to transform raw values */
	private readonly transform: (stat: number) => number;
	/** Origin point in the graph */
	private readonly ORIGIN: SVGPoint;
	/** List of maximum points in the graph */
	private readonly maxPoints: SVGPointList;
	/** List of points in the graph */
	private readonly points: SVGPointList;

	/**
	 * @param svgGraph HTML SVG element
	 * @param labels Array of the stat labels
	 * @param transform Function to transform raw values
	 */
	public constructor(svgGraph: SpiritGraph<L>["GRAPH"], labels: SpiritGraph<L>["labels"], transform: SpiritGraph<L>["transform"] = stat => stat) {
		this.GRAPH = svgGraph;
		this.labels = labels;
		this.transform = transform;
		this.ORIGIN = this.GRAPH.createSVGPoint();
		this.maxPoints = this.GRAPH.querySelector<SVGPolygonElement>("polygon:first-of-type")!.points;
		this.points = this.GRAPH.querySelector<SVGPolygonElement>("polygon:last-of-type")!.points;
	}

	/** Set the given stats into the graph
	 * @param stats Stats of the character
	 * @param displayStat Function called to display a stat
	 */
	public setStats(stats: Partial<Record<L, any>>, displayStat?: (stat: string, value?: number) => void) {
		if (displayStat) {
			this.labels.forEach(stat => displayStat(stat));
		}
		for (let i = 0; i < this.labels.length; i++) {
			const point = this.points.getItem(i);
			point.x = 0;
			point.y = 0;
		}
		for (const stat in stats) if (stats.hasOwnProperty(stat) && typeof stats[stat] === "number") {
			const index = this.labels.findIndex(label => label === stat);
			if (index >= 0) {
				const point = this.points.getItem(index);
				const position = segmentPosition(this.ORIGIN, this.maxPoints.getItem(index), this.transform(stats[stat]!));
				point.x = position.x;
				point.y = position.y;
				if (displayStat) {
					displayStat(stat, stats[stat]!);
				}
			}
		}
	}
}
