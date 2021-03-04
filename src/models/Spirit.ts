export type Series = "Date A Live" | "Date A Bullet" | "Index" | "Neptunia" | "DanMachi";
type Gender = "female" | "male";
interface Form {
	readonly name: string;
	readonly url: string;
}
type CodenameWording = "Codename" | "Goddess Title";
interface Codename {
	readonly wording: CodenameWording;
	readonly value: string;
}
interface Images {
	readonly menuIcon?: string;
	readonly fullbodyImage?: string;
	sephiraIcon?: string;
}
interface PowerInfoItem {
	readonly wording: string;
	readonly name: string;
	readonly subtitle?: string;
	readonly link?: string;
}
const SEPHIRA_WORDING = ["Sephira", "Qlipha", "Land"] as const;
type SephiraWording = (typeof SEPHIRA_WORDING)[number];
interface Sephira extends PowerInfoItem {
	readonly wording: SephiraWording;
	readonly name: string;
	readonly subtitle?: string;
	readonly link?: string;
}
const ANGEL_WORDING = ["Angel", "Weapon", "Demon", "Unsigned Angel", "Esper Power"] as const;
type AngelWording = (typeof ANGEL_WORDING)[number];
interface Angel extends PowerInfoItem {
	readonly wording: AngelWording;
	readonly name: string;
	readonly subtitle?: string;
	readonly link?: string;
}
const ASTRALDRESS_WORDING = ["Astral Dress", "CR-Unit"] as const;
type AstralDressWording = (typeof ASTRALDRESS_WORDING)[number];
interface AstralDress extends PowerInfoItem {
	readonly wording: AstralDressWording;
	readonly name: string;
	readonly subtitle?: string;
	readonly link?: string;
}
interface PersonalInfo {
	readonly birthday?: string;
	readonly height?: number;
	readonly weight?: number;
	readonly B?: number;
	readonly W?: number;
	readonly H?: number;
}
export const LORE_STAT_LABELS = ["STR", "CST", "SPI", "AGI", "INT"] as const;
export type LoreStatLabels = (typeof LORE_STAT_LABELS)[number];
type LoreStats = Readonly<Partial<Record<LoreStatLabels, number>>> & {
	readonly class?: string;
};
export const SP_STAT_LABELS = ["ATK", "CMB", "SUP", "DEF", "CTR", "DPS"] as const;
export type SPStatLabels = (typeof SP_STAT_LABELS)[number];
type SPStatElementLabel = "Physical" | "Fire" | "Frost" | "Spiritual" | "Lightning" | "Tempest" | "Magic" | "Holy" | "Dark" | "Space";
interface SPStatElement {
	readonly label: SPStatElementLabel;
	readonly icon?: string;
}
type SPStats = Readonly<Partial<Record<SPStatLabels, number>>> & {
	readonly rank?: string;
	readonly elDMG: SPStatElement[];
};
interface Theme {
	readonly main: string;
	readonly darkContrast: boolean;
}

/** Raw data for a character */
export type RawSpiritData = {
	series?: Series;
	firstname: string;
	lastname?: string;
	gender?: Gender;
	form: string;
	codename?: string;
	icon_id?: string;
	image_id?: string;
	sephiras?: string;
	sephira_subtitles?: string;
	angels?: string;
	angel_subtitles?: string;
	astraldress?: string;
	birthday?: string;
	height?: number;
	weight?: number;
	B?: number;
	W?: number;
	H?: number;
	class?: string;
	rank?: string;
	elDMG?: string;
	theme: string;
	spoiler?: boolean;
} & {
		[K in LoreStatLabels | SPStatLabels]?: number;
	};

/** Data for a single character */
export default class Spirit {
	/** Series of the character */
	public readonly series: Series;
	/** Firstname of the character */
	public readonly firstname: string;
	/** Lastname of the character */
	public readonly lastname?: string;
	/** Gender of the character */
	public readonly gender: Gender;
	/** Form of the character */
	public readonly form: Form;
	/** Codename of the character */
	private readonly codename?: Codename;
	/** References to images of the character */
	public readonly images: Images;
	/** Definitions of the character's Sephiras */
	private readonly sephiras: Sephira[];
	/** Definitions of the character's Angels */
	private readonly angels: Angel[];
	/** Definitions of the character's Astral Dresses */
	private readonly astralDresses: AstralDress[];
	/** Personal info of the character */
	private readonly personalInfo: PersonalInfo;
	/** Stats of the character from the Lore */
	public readonly loreStats?: LoreStats;
	/** Stats of the character from Spirit Pledge */
	public readonly spStats?: SPStats;
	/** Color theme of the character */
	private readonly theme: Theme;
	/** `true` if the character is a spoiler; `false` otherwise */
	public readonly spoiler: boolean;

	/**
	 * @param data Raw data of the character
	 */
	public constructor(data: RawSpiritData) {
		this.series = data.series ?? "Date A Live";
		this.firstname = data.firstname;
		this.lastname = data.lastname;
		this.gender = data.gender ?? "female";
		this.form = {
			name: data.form,
			url: data.form.replace(/\W/g, "").replace(/\((.+)\)/, "_$1"),
		};
		if (data.codename) {
			this.codename = {
				wording: (() => {
					switch (this.series) {
						case "Neptunia": return "Goddess Title";
						default: return "Codename";
					}
				})(),
				value: data.codename,
			};
		}
		this.images = {
			menuIcon: data.icon_id ? `https://raw.githubusercontent.com/n0k0m3/DateALiveData/master/res/basic/icon/hero/face/${data.icon_id}.png` : undefined,
			fullbodyImage: data.image_id ? /^\d+$/.test(data.image_id) ? `https://raw.githubusercontent.com/n0k0m3/DateALiveData/master/res/basic/icon/teampic/${data.image_id}.png` : `https://static.wikia.nocookie.net/date-a-live/images/${data.image_id}.png` : data.icon_id ? `https://raw.githubusercontent.com/n0k0m3/DateALiveData/master/res/basic/icon/teampic/${data.icon_id}.png` : undefined,
			sephiraIcon: undefined,
		};
		{
			const sephira_subtitles = data.sephira_subtitles ? data.sephira_subtitles.split(";") : [];
			this.sephiras = data.sephiras ? data.sephiras.split(";").map<Sephira>((format, i) => {
				const URL_RADIX: string = "https://raw.githubusercontent.com/n0k0m3/DateALiveData/master/res/basic/icon/equipType/";
				const info = format.split(":");
				switch (info[0]) {
					case "l": {
						if (!this.images.sephiraIcon) {
							this.images.sephiraIcon = `https://static.wikia.nocookie.net/neptunia/images/${info[2]}/${info[1]}_Logo.png`;
						}
						return {
							wording: "Land",
							name: info[1]!,
							subtitle: sephira_subtitles.length > i ? sephira_subtitles[i] : undefined,
							link: `https://neptunia.fandom.com/wiki/${info[1]}`,
						};
					}
					case "q": {
						if (!this.images.sephiraIcon) {
							this.images.sephiraIcon = URL_RADIX + `${info[2]}_gray.png`;
						}
						return {
							wording: "Qlipha",
							name: info[1]!,
							subtitle: sephira_subtitles.length > i ? sephira_subtitles[i] : undefined,
							link: `https://wikipedia.org/wiki/${info.length > 3 ? info[3] : info[1]}`,
						};
					}
					case "s":
					default: {
						if (!this.images.sephiraIcon) {
							this.images.sephiraIcon = URL_RADIX + `${info[1]}.png`;
						}
						return {
							wording: "Sephira",
							name: info[1]!,
							subtitle: sephira_subtitles.length > i ? sephira_subtitles[i] : undefined,
							link: `https://wikipedia.org/wiki/${info.length > 2 ? info[2] : info[1]}`,
						};
					}
				}
			}) : [];
		}
		{
			const angel_subtitles = data.angel_subtitles ? data.angel_subtitles.split(";") : [];
			this.angels = data.angels ? data.angels.split(";").map<Angel>((format, i) => {
				const info = format.split(":");
				switch (info[0]) {
					case "w":
					case "u":
					case "e": return {
						wording: info[0] === "w" ? "Weapon" : info[0] === "u" ? "Unsigned Angel" : "Esper Power",
						name: info[1]!,
						subtitle: angel_subtitles.length > i ? angel_subtitles[i] : undefined,
						link: undefined,
					};
					case "a":
					case "d":
					default: return {
						wording: info[0] === "a" ? "Angel" : "Demon",
						name: info[1]!,
						subtitle: angel_subtitles.length > i ? angel_subtitles[i] : undefined,
						link: `https://wikipedia.org/wiki/${info.length > 2 ? info[2] : info[1]}`,
					};
				}
			}) : [];
		}
		this.astralDresses = data.astraldress ? data.astraldress.split(";").map<AstralDress>(format => {
			const info = format.split(":");
			switch (info[0]) {
				case "cr": return {
					wording: "CR-Unit",
					name: info[1]!,
					subtitle: undefined,
					link: undefined,
				};
				case "ad":
				default: return {
					wording: "Astral Dress",
					name: info[1]!,
					subtitle: (() => {
						switch (this.form.name) {
							case "Pseudo-Spirit": return `Incantation Spirit Dress, ${info[2]}`;
							case "Quasi-Spirit": return `Stranded Spirit Dress, ${info[2]}`;
							default: return `Spirit Dress of God's Authority, ${info[2]}`;
						}
					})(),
					link: this.form.name !== "Quasi-Spirit" ? "https://en.wikipedia.org/wiki/Names_of_God_in_Judaism" : undefined,
				};
			}
		}) : [];
		this.personalInfo = {
			birthday: data.birthday,
			height: data.height,
			weight: data.weight,
			B: this.gender === "female" ? data.B : undefined,
			W: this.gender === "female" ? data.W : undefined,
			H: this.gender === "female" ? data.H : undefined,
		};
		this.loreStats = this.series === "Date A Live" && ((data.STR && data.CST && data.SPI && data.AGI && data.INT) || data.class) ? {
			class: data.class,
			STR: data.STR,
			CST: data.CST,
			SPI: data.SPI,
			AGI: data.AGI,
			INT: data.INT,
		} : undefined;
		this.spStats = (data.ATK && data.CMB && data.SUP && data.DEF && data.CTR && data.DPS) || (data.rank && data.elDMG) ? {
			rank: data.rank,
			ATK: data.ATK,
			CMB: data.CMB,
			SUP: data.SUP,
			DEF: data.DEF,
			CTR: data.CTR,
			DPS: data.DPS,
			elDMG: data.elDMG ? data.elDMG.split("").map(el => {
				const returnEl = (label: SPStatElementLabel, icon?: number): SPStatElement => ({ label, icon: icon ? `https://raw.githubusercontent.com/n0k0m3/DateALiveData/master/res/basic/icon/element/${icon}.png` : undefined });
				switch (el) {
					case "v": return returnEl("Space", undefined);
					case "s": return returnEl("Spiritual", undefined);
					case "m": return returnEl("Magic", 1);
					case "f": return returnEl("Fire", 2);
					case "l": return returnEl("Lightning", 3);
					case "t": return returnEl("Tempest", 4);
					case "i": return returnEl("Frost", 6)
					case "h": return returnEl("Holy", 7);
					case "d": return returnEl("Dark", 8);
					case "p":
					default: return returnEl("Physical", 5);
				}
			}) : [],
		} : undefined;
		this.theme = {
			main: data.theme.match(/^!?([0-9a-f]+)$/i)![1]!,
			darkContrast: /^!/.test(data.theme),
		};
		this.spoiler = data.spoiler ?? false;
	}

	/** All images from the character
	 * @param spirit `Spirit` instance
	 * @returns Array of image URLs
	 */
	public static allImages(spirit: Spirit): string[] {
		return [
			...Object.values(spirit.images),
			...(spirit.spStats?.elDMG?.map(el => el.icon) ?? [])
		].filter((value): value is string => typeof value === "string");
	}
	/** Output the full name of the character
	 * @param spirit `Spirit` instance
	 * @returns Full name of the character
	*/
	public static outputFullname(spirit: Spirit): string {
		return spirit.lastname ? `${spirit.firstname} <span class="textsc">${spirit.lastname}</span>` : spirit.firstname;
	}
	/** Output the codename of the character
	 * @param spirit `Spirit` instance
	 * @param el HTML element to output the codename in
	 */
	public static ouputCodename(spirit: Spirit, el: HTMLElement) {
		if (spirit.codename) {
			el.classList.add("textthemed");
			el.dataset.field = spirit.codename.wording;
			el.textContent = spirit.codename.value;
		}
	}
	/** Output the power info of the character
	 * @param spirit `Spirit` instance
	 * @param ul UL element to output the info in
	 */
	public static outputPowerInfo(spirit: Spirit, ul: HTMLUListElement) {
		ul.innerHTML = "";
		(["sephiras", "angels", "astralDresses"] as const).forEach(list => {
			if (spirit[list].length > 0) {
				(() => {
					switch (list) {
						case "sephiras": return SEPHIRA_WORDING;
						case "angels": return ANGEL_WORDING;
						case "astralDresses": return ASTRALDRESS_WORDING;
					}
				})()?.forEach((wording: string) => {
					const li = document.createElement("li");
					li.dataset.field = wording;
					const li_ul = (spirit[list] as PowerInfoItem[])
						.filter(item => item.wording === wording)
						.reduce((ul, item) => {
							const li = document.createElement("li");
							(item.link ? li.appendChild((a => {
								a.target = "_blank";
								a.href = item.link;
								return a;
							})(document.createElement("a"))) : li).textContent = item.name;
							if (item.subtitle) {
								li.innerHTML += ` &ndash; ${item.subtitle}`;
								if (/\d$/.test(item.subtitle)) {
									li.innerHTML += `<sup>${(() => {
										switch (item.subtitle.charAt(item.subtitle.length - 1)) {
											case "1": return "st";
											case "2": return "nd";
											case "3": return "rd";
											default: return "th";
										}
									})()}</sup>`;
								}
							}
							ul.appendChild(li);
							return ul;
						}, document.createElement("ul"));
					if (li_ul.children.length > 0) {
						ul.appendChild(li).appendChild(li_ul);
					}
				});
			} else {
				const li = document.createElement("li");
				switch (list) {
					case "sephiras": {
						if ((spirit.series === "Date A Live" && !/Wizard/.test(spirit.form.name)) || spirit.series === "Neptunia") {
							li.dataset.field = (() => {
								switch (spirit.series) {
									case "Neptunia": return "Land";
									default: return spirit.angels.length > 0 && spirit.angels.every(angel => angel.wording === "Demon") ? "Qlipha" : "Sephira";
								}
							})();
							li.innerHTML = "<i>None</i>";
						}
						break;
					}
					case "angels": {
						li.dataset.field = (() => {
							switch (spirit.form.name) {
								case "Esper": return "Esper Power";
								case "Quasi-Spirit": return "Unsigned Angel";
								case "Adventurer":
								case "CPU":
								case "HDD CPU":
								case "Ratatoskr Wizard":
								case "AST Wizard":
								case "DEM Wizard": return "Weapon";
								case "Inverse Spirit": return "Demon";
								default: return "Angel";
							}
						})();
						li.innerHTML = "<i>None</i>";
						break;
					}
					case "astralDresses": {
						if (spirit.series === "Date A Live" && spirit.gender === "female") {
							li.dataset.field = /Wizard/.test(spirit.form.name) ? "CR-Unit" : "Astral Dress";
							li.innerHTML = "<i>Unnamed</i>";
						}
						break;
					}
				}
				if (li.innerHTML.length > 0) {
					ul.appendChild(li);
				}
			}
		});
	}
	/** Output the personal info of the character
	 * @param spirit `Spirit` instance
	 * @param ul UL element to output the info in
	 */
	public static outputPersonalInfo(spirit: Spirit, ul: HTMLUListElement) {
		ul.innerHTML = "";
		(li => {
			li.dataset.field = "Birthday";
			li.innerHTML = spirit.personalInfo.birthday ? `${spirit.personalInfo.birthday}<sup>${(() => {
				switch (spirit.personalInfo.birthday.charAt(spirit.personalInfo.birthday.length - 1)) {
					case "1": return "st";
					case "2": return "nd";
					case "3": return "rd";
					default: return "th";
				}
			})()}</sup>` : "<i>Unknown</i>";
		})(ul.appendChild(document.createElement("li")));
		(li => {
			li.dataset.field = "Height";
			li.innerHTML = spirit.personalInfo.height ? `${spirit.personalInfo.height}<span class="textsc">cm</span>` : "<i>Unknown</i>";
		})(ul.appendChild(document.createElement("li")));
		(li => {
			li.dataset.field = "Weight";
			li.innerHTML = spirit.personalInfo.weight ? `${spirit.personalInfo.weight}<span class="textsc">kg</span>` : "<i>Unknown</i>";
		})(ul.appendChild(document.createElement("li")));
		(li => {
			li.dataset.field = "B·W·H";
			li.innerHTML = spirit.personalInfo.B && spirit.personalInfo.W && spirit.personalInfo.H ? `${spirit.personalInfo.B}&middot;${spirit.personalInfo.W}&middot;${spirit.personalInfo.H}` : "<i>Unknown</i>";
		})(ul.appendChild(document.createElement("li")));
	}
	/** Get CSS for the theme of the character
	 * @param spirit `Spirit` instance
	 * @returns CSS string
	 */
	public static cssTheme(spirit: Spirit): string {
		return `.${spirit.firstname}{--theme:#${spirit.theme.main};${spirit.theme.darkContrast ? "--theme-contrast:#212121;" : ""}}`;
	}
}
