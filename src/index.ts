import DataStrategy, { OnlineDataStrategy } from "./models/database/DataStrategy";
import LocalDataStrategy, { DatabaseSchema } from "./models/database/strategies/local";
import Spirit, { LoreStatLabels, LORE_STAT_LABELS, RawSpiritData, SPStatLabels, SP_STAT_LABELS } from "./models/Spirit";
import SpiritGraph from "./models/SpiritGraph";
import buildSpiritMenu, { SpiritOrder, updateActive } from "./models/spiritMenu";
import parseCSV from "./util/csv";
import * as FEATURES from "./util/features";
import getResource, { blobAsDataURL } from "./util/fetch";
import hash = require("object-hash");

const DATABASE_SCHEMA = Object.freeze<DatabaseSchema<Spirit>>({
	name: "DAL_Spirits",
	version: 1,
	dataObjectStore: {
		options: { autoIncrement: true, },
		indexes: [
			{ name: "series", keyPath: "series", options: { unique: false } },
			{ name: "firstname", keyPath: "firstname", options: { unique: false } },
		],
	}
});

const SPIRIT_ORDER: SpiritOrder = {};
((): DataStrategy<Spirit> => {
	const strategyInfo = (strategy: string) => console.info("Using %s data strategy", strategy);
	if (FEATURES.indexedDB && FEATURES.localStorage) {
		strategyInfo("LOCAL");
		return new LocalDataStrategy<Spirit, number>(DATABASE_SCHEMA);
	} else {
		strategyInfo("ONLINE");
		return new OnlineDataStrategy<Spirit>();
	}
})().isReady
	.catch<DataStrategy<Spirit>>(error => {
		console.error(error);
		console.info("Switching to ONLINE data strategy because of the previous error");
		return new OnlineDataStrategy<Spirit>();
	})
	.then(database => {
		/* Update database if needed */
		if (window.navigator.onLine) {
			const INLINE_DATA = document.querySelector<HTMLScriptElement>("script#DATA");
			const FETCH_DATA = document.querySelector<HTMLLinkElement>("link#DATA");
			if (INLINE_DATA || FETCH_DATA) {
				if (INLINE_DATA) {
					console.info("Using %o as data source", INLINE_DATA);
				}
				return (INLINE_DATA ?
					Promise.resolve(INLINE_DATA.innerHTML) :
					getResource(FETCH_DATA!.href))
					.then(csv => parseCSV<RawSpiritData>(csv))
					.then(rawData => {
						// Update images in the document
						for (let i = 0; i < document.images.length; i++) {
							const img = document.images.item(i)!;
							if (img.src && img.src !== "") {
								database.getBlob(img.src)
									.then(blob => {
										if (blob) {
											return blob;
										} else {
											return database.putBlob(img.src)
												.then(url => database.getBlob(url));
										}
									})
									.then(blob => {
										if (blob) {
											blobAsDataURL(blob)
												.then(dataURL => void (img.src = dataURL));
										}
									})
									.catch(console.warn);
							}
						}
						const spirits = rawData.map(datum => new Spirit(datum));
						// Add characters' color themes
						document.head.appendChild(document.createElement("style")).innerHTML = spirits.reduce<string>((css, spirit) => css + Spirit.cssTheme(spirit), "");
						// Define order in the menu
						spirits.forEach(spirit => {
							if (!(spirit.series in SPIRIT_ORDER)) {
								SPIRIT_ORDER[spirit.series] = [];
							}
							if (!SPIRIT_ORDER[spirit.series]!.includes(spirit.firstname)) {
								SPIRIT_ORDER[spirit.series]!.push(spirit.firstname);
							}
						});
						Object.freeze(SPIRIT_ORDER);
						// Update database
						const HASH = database instanceof LocalDataStrategy ? hash(rawData, {
							algorithm: "sha1",
							encoding: "base64",
						}) : null;
						const PREV_HASH = database instanceof LocalDataStrategy ? database.hash : null;
						if (database instanceof OnlineDataStrategy || HASH !== PREV_HASH) {
							return database.clearData()
								.then(() => Promise.all(spirits.map(spirit => {
									Spirit.getAllImages(spirit).forEach(img => database.putBlob(img)
										.catch(console.warn));
									return database.putData(spirit)
										.catch(console.error);
								})))
								.then(_results => {
									if (database instanceof LocalDataStrategy) {
										database.hash = HASH;
										if (PREV_HASH) {
											console.log("Updated database because hash changed ('%s'; previously '%s')", HASH, PREV_HASH);
										} else {
											console.log("Created database with hash '%s'", HASH);
										}
									} else {
										console.log("Populated database");
									}
								});
						} else {
							return console.log("Skipped database update because hash equal ('%s')", HASH);
						}
					})
					.catch(() => console.info("Skipped database update because navigator seems offline"))
					.then(() => database);
			} else {
				throw new Error("Could not find any data source");
			}
		} else if (database instanceof OnlineDataStrategy) {
			throw new TypeError("ONLINE data strategy cannot be used offline");
		} else {
			console.log("Skipped database update because navigator is offline");
			return database;
		}
	})
	.then(database => {
		/* Prepare interface */
		// Setup "additional" checkboxes
		(inputs => {
			for (let i = 0; i < inputs.length; i++) {
				//@ts-ignore
				inputs.item(i).onchange = function (this: HTMLInputElement, _event, needConfirm = true) {
					if (needConfirm && this.value === "spoilers" && this.checked) {
						this.checked = confirm("You may be HEAVILY spoiled.\nDo you still wish to proceed ?");
					}
					document.querySelector<HTMLElement>("header>nav")!.dataset[this.value] = this.checked.toString();
				};
				//@ts-ignore
				inputs.item(i).onchange!(null, false);
			}
		})(document.querySelectorAll<HTMLInputElement>("main>div#empty>form input[name='additional']"));
		// Setup button "force database update"
		(button => {
			button.onclick = _event => {
				if (confirm("This will clear the database and re-download all data.\nAre you sure you want to do this ?")) {
					Promise.all([
						database.clearData(),
						database.clearBlobs(),
					])
						.then(_results => window.location.reload())
						.catch(error => {
							if (error) {
								console.error(error);
							}
							return alert("OPERATION FAILED\nHopefully the console contains details about the error.");
						});
				}
			};
			button.disabled = false;
		})(document.querySelector<HTMLButtonElement>("button#db-up")!);
		// Prepare interaction with menu
		const LORE_GRAPH = new SpiritGraph<LoreStatLabels>(document.querySelector<SVGSVGElement>("div.svg-container#lore-stats>svg")!, LORE_STAT_LABELS, stat => stat > 300 ? 1 : stat / 300);
		const SP_GRAPH = new SpiritGraph<SPStatLabels>(document.querySelector<SVGSVGElement>("div.svg-container#SP-stats>svg")!, SP_STAT_LABELS, stat => stat / 100);
		window.onhashchange = (event: HashChangeEvent) => {
			const url = new URL(event.newURL);
			updateActive(document.querySelector<HTMLUListElement>("header>nav>ul")!, url, event.oldURL ? new URL(event.oldURL) : undefined);
			const main = document.querySelector("main")!;
			const SPIRIT_REGEX = /^#spirits\/(\w+)\/(\w+)$/;
			if (SPIRIT_REGEX.test(url.hash)) {
				const [character, URLform] = url.hash.match(SPIRIT_REGEX)!.slice(1) as [string, string];
				database.searchData("firstname", character)
					.then(spirits => {
						const spirit = spirits.find(spirit => spirit.form.url === URLform);
						if (spirit) {
							return spirit;
						} else {
							throw new Error(`Could not find ${URLform} ${character}`);
						}
					})
					.then(spirit => {
						main.className = spirit.firstname;
						// Character name
						(h1 => {
							h1.innerHTML = Spirit.outputFullname(spirit);
							const span = document.createElement("span");
							span.classList.add("textit");
							span.textContent = spirit.form.name;
							h1.prepend(span);
						})(main.querySelector<HTMLHeadingElement>("div.data-container>h1")!);
						// Character images
						(img => {
							img.alt = `${spirit.form.name} ${spirit.firstname}`;
							if (spirit.images.fullbodyImage) {
								database.getBlob(spirit.images.fullbodyImage)
									.then(blob => {
										if (blob) {
											blobAsDataURL(blob)
												.then(dataURL => void (img.src = dataURL));
										} else {
											img.src = "";
										}
									});
							} else {
								img.src = "";
							}
						})(main.querySelector<HTMLImageElement>("div.img-container>img#fullBody")!);
						const sephira = Spirit.getMainSephira(spirit);
						if (sephira) {
							main.querySelector<HTMLDivElement>("div.img-container")!.classList.add("has-sephira");
							const div = main.querySelector<HTMLDivElement>("div.img-container>div")!;
							div.querySelector("span")!.innerHTML = `${sephira.wording} <b>${sephira.name}</b>`;
							(img => {
								if (sephira.wording === "Qlipha") {
									img.classList.add("inverse");
								} else {
									img.classList.remove("inverse");
								}
								img.alt = sephira.name;
								if (spirit.images.sephiraIcon) {
									database.getBlob(spirit.images.sephiraIcon)
										.then(blob => {
											if (blob) {
												blobAsDataURL(blob)
													.then(dataURL => void (img.src = dataURL));
											} else {
												img.src = "";
											}
										});
								} else {
									img.src = "";
								}
							})(div.querySelector<HTMLImageElement>("img#sephira-icon")!);
							(img => {
								img.alt = `Guardian ${(() => {
									const angel = Spirit.getMainAngel(spirit);
									switch (sephira.wording) {
										case "Land": return `Goddess ${(() => {
											switch (sephira.name) {
												case "Lowee": return "White";
												case "Lastation": return "Black";
												case "Leanbox": return "Green";
												default:
												case "Planeptune": return "Purple";
											}
										})()} Heart`;
										case "Qlipha":
										case "Sephira":
										default: return `${angel!.wording} ${angel!.name}`;
									}
								})()}`;
								if (spirit.images.sephiraCharacter) {
									database.getBlob(spirit.images.sephiraCharacter)
										.then(blob => {
											if (blob) {
												blobAsDataURL(blob)
													.then(dataURL => void (img.src = dataURL));
											} else {
												img.src = "";
											}
										});
								} else {
									img.src = "";
								}
							})(div.querySelector<HTMLImageElement>("img#sephira-char")!);
						} else {
							main.querySelector<HTMLDivElement>("div.img-container")!.classList.remove("has-sephira");
						}
						// Character info
						(ul => {
							Spirit.outputPowerInfo(spirit, ul);
							const li = document.createElement("li");
							Spirit.ouputCodename(spirit, li);
							if (li.innerHTML !== "") {
								ul.prepend(li);
							}
						})(main.querySelector<HTMLUListElement>("div.data-container ul#power-info")!);
						Spirit.outputPersonalInfo(spirit, main.querySelector<HTMLUListElement>("div.data-container ul#personal-info")!);
						// Character graphs
						(div => {
							if (spirit.loreStats) {
								div.style.visibility = "visible";
								div.querySelector<SVGTextElement>("svg>text[data-field]")!.textContent = spirit.loreStats.class ?? null;
								LORE_GRAPH.setStats(spirit.loreStats, (stat, value) => void (div.querySelector<HTMLLIElement>(`li[data-field="${stat}"]`)!.dataset.value = value ? value.toString() : "?"));
							} else {
								div.style.visibility = "hidden";
							}
						})(main.querySelector<HTMLDivElement>("div.svg-container#lore-stats")!);
						(div => {
							if (spirit.spStats) {
								div.style.visibility = "visible";
								main.querySelector<HTMLDivElement>("div.svg-container#SP-stats>svg>text[data-field]")!.textContent = spirit.spStats.rank ?? null;
								SP_GRAPH.setStats(spirit.spStats);
								(ul => {
									ul.innerHTML = ul.querySelector<HTMLLIElement>("li[data-field]")!.outerHTML;
									spirit.spStats.elDMG.forEach(el => {
										const li = document.createElement("li");
										li.classList.add("data-element-" + el.label);
										li.textContent = el.label;
										if (el.icon) {
											database.getBlob(el.icon)
												.then(blob => {
													if (blob) {
														const img = document.createElement("img");
														blobAsDataURL(blob)
															.then(dataURL => {
																img.src = dataURL;
																return li.prepend(img);
															});
													}
												});
										}
										ul.appendChild(li);
									});
								})(main.querySelector<HTMLDivElement>("div.svg-container#SP-stats>ul:last-of-type")!);
							} else {
								div.style.visibility = "hidden";
							}
						})(main.querySelector<HTMLDivElement>("div.svg-container#SP-stats")!);
					})
					.catch(error => {
						if (error) {
							console.error(error);
						}
						window.location.hash = "";
						main.className = "";
					});
			} else {
				window.location.hash = "";
				main.className = "";
			}
		};
		// Build menu
		return buildSpiritMenu(database, SPIRIT_ORDER, document.querySelector<HTMLUListElement>("header>nav>ul")!);
	})
	.then(() => {
		/* Finish initialization */
		//@ts-ignore
		window.onhashchange({ newURL: window.location.toString() });
	})
	.catch(error => {
		if (error) {
			console.error(error);
			return alert("CRITICAL ERROR\nPlease see the details in the console.");
		} else {
			return alert("CRITICAL ERROR\nSomething went wrong without any trace.");
		}
	});
