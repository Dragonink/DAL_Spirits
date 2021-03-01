import hash = require("object-hash");
import chooseDatabase, { DatabaseSchema, DataStrategy } from "./model/database";
import Spirit, { LoreStatLabels, RawSpiritData, SPStatLabels } from "./model/Spirit";
import SpiritGraph from "./model/SpiritGraph";
import spiritMenu, { updateActive } from "./model/spiritMenu";
import parseCSV from "./util/csv";
import getResource from "./util/fetch";

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

const FEATURES = Object.freeze({
	localStorage: (() => {
		try {
			const TEST_ITEM = "__test__";
			window.localStorage.setItem(TEST_ITEM, "");
			window.localStorage.removeItem(TEST_ITEM);
			return true;
		} catch (error) {
			return false;
		}
	})(),
	indexedDB: window.indexedDB ? true : false,
});
new Promise<boolean>((resolve, reject) => {
	if (FEATURES.indexedDB) {
		/* Test if database exists */
		const request = window.indexedDB.open(DATABASE_SCHEMA.name);
		request.onerror = _event => reject(request.error!);
		request.onsuccess = _event => resolve(true);// Database exists
		request.onupgradeneeded = event => {
			// Database does not exist
			(event.target as IDBOpenDBRequest).transaction!.abort();
			return resolve(true);
		};
	} else {
		// IndexedDB is not available
		resolve(false);
	}
})
	.then<DataStrategy<Spirit>>(useStorage => {
		/* Open database */
		const setupOnlineDatabase = () => new (chooseDatabase<Spirit>(false))();
		if (useStorage) {
			return new (chooseDatabase<Spirit, number>(useStorage))(DATABASE_SCHEMA, error => {
				console.error(error);
				return setupOnlineDatabase();
			});
		} else {
			return setupOnlineDatabase();
		}
	})
	.then(database => {
		console.info("Using %s data strategy", database.TYPE);
		/* Populate database if needed */
		if (navigator.onLine) {
			// Update blobs
			for (let i = 0; i < document.images.length; i++) {
				const img = document.images.item(i)!;
				if (img.src !== "") {
					database.newBlob(img.src)
						.catch(_error => database.updateBlob(img.src))
						.catch(console.warn);
				}
			}
			// Update data if needed
			const INLINE_DATA = document.querySelector<HTMLScriptElement>("script#DATA");
			return (INLINE_DATA ? Promise.resolve<string>(INLINE_DATA.innerHTML) : getResource(document.querySelector<HTMLLinkElement>("link#DATA")!.href, "text"))
				.then<RawSpiritData[]>(parseCSV)
				.then(data => {
					if (INLINE_DATA) {
						console.info("Using %o as data source", INLINE_DATA);
					}
					const LOCAL_HASH_STORAGE = "LOCAL-hash";
					const DATA_HASH = database.TYPE === "LOCAL" ? hash(data, {
						algorithm: "sha1",
						encoding: "base64"
					}) : undefined;
					const PREV_DATA_HASH = database.TYPE === "LOCAL" && FEATURES.localStorage ? window.localStorage.getItem(LOCAL_HASH_STORAGE) : undefined;
					const dataPromises: Promise<void | number>[] = [];
					if (database.TYPE === "ONLINE" || !FEATURES.localStorage || DATA_HASH !== PREV_DATA_HASH) {
						data.forEach((datum, id) => {
							const spirit = new Spirit(datum);
							dataPromises.push(database.setData(id + 1, spirit)
								.catch(_error => database.newData(spirit))
								.catch(console.error));
							Spirit.allImages(spirit).forEach(img => void database.newBlob(img)
								.catch(_error => database.updateBlob(img))
								.catch(console.warn));
						});
					} else {
						console.log("Skipped database update because hash equal ('%s')", DATA_HASH);
					}
					return Promise.all(dataPromises)
						.then(_results => {
							if (database.TYPE === "LOCAL" && FEATURES.localStorage && DATA_HASH !== PREV_DATA_HASH) {
								window.localStorage.setItem(LOCAL_HASH_STORAGE, DATA_HASH!);
								if (PREV_DATA_HASH) {
									console.log("Updated database because hash changed ('%s'; previously '%s'", DATA_HASH, PREV_DATA_HASH);
								} else {
									console.log("Created database with hash '%s'", DATA_HASH);
								}
							}
						});
				})
				.catch(() => console.log("Skipped database update because navigator seems offline"))
				.then(() => database);
		} else if (database.TYPE === "ONLINE") {
			throw new Error("ONLINE data strategy cannot be used offline");
		} else {
			console.log("Skipped database update because navigator is offline");
			return database;
		}
	})
	.then(database => {
		/* Database is ready, prepare interface */
		// Setup button "force database update"
		(button => {
			if (button) {
				button.onclick = _event => {
					if (confirm("This will clear the database and re-download all data.\nAre you sure you want to do this ?")) {
						if (FEATURES.localStorage) {
							window.localStorage.clear();
						}
						database.clear()
							.then(() => window.location.reload());
					}
				};
				button.disabled = false;
			}
		})(document.querySelector<HTMLButtonElement>("button#db-up"));
		// Setup data display
		const LORE_GRAPH = new SpiritGraph<LoreStatLabels>(document.querySelector<SVGSVGElement>("div.svg-container#lore-stats>svg")!, ["STR", "CST", "SPI", "AGI", "INT"], stat => stat > 300 ? 1 : stat / 300);
		const SP_GRAPH = new SpiritGraph<SPStatLabels>(document.querySelector<SVGSVGElement>("div.svg-container#SP-stats>svg")!, ["ATK", "CMB", "SUP", "DEF", "CTR", "DPS"], stat => stat / 100);
		window.onhashchange = function (event: HashChangeEvent) {
			const main = document.querySelector("main")!;
			const url = new URL(event.newURL);
			updateActive(document.querySelector<HTMLUListElement>("header>nav>ul")!, url, event.oldURL ? new URL(event.oldURL) : undefined);
			const SPIRIT_REGEX = /^#\/?spirits\/(\w+)\/(\w+)\/?$/;
			if (SPIRIT_REGEX.test(url.hash)) {
				const [character, URLform] = url.hash.match(SPIRIT_REGEX)!.slice(1) as [string, string];
				database.searchData("firstname", character)
					.then(spirits => {
						for (const spirit of spirits) if (spirit.form.url === URLform) {
							return spirit;
						}
						throw new Error(`Could not find form ${URLform} of ${character}`);
					})
					.then(spirit => {
						main.className = spirit.firstname;
						(div => {
							if (spirit.images.sephiraIcon) {
								database.applyBlob(spirit.images.sephiraIcon, blobURL => void (div.style.backgroundImage = `url("${blobURL}")`));
							} else {
								div.style.backgroundImage = "none";
							}
						})(main.querySelector<HTMLDivElement>("div.img-container")!);
						(img => {
							img.alt = `${spirit.form.name} ${spirit.firstname}`;
							if (spirit.images.fullbodyImage) {
								database.applyBlob(spirit.images.fullbodyImage, blobURL => void (img.src = blobURL));
							} else {
								img.src = "";
							}
						})(main.querySelector<HTMLImageElement>("div.img-container>img")!);
						main.querySelector<HTMLHeadingElement>("div.data-container>h1")!.innerHTML = `<span class="textit">${spirit.form.name}</span> ${Spirit.outputFullname(spirit)}`;
						(ul => {
							Spirit.outputPowerInfo(spirit, ul);
							const li = document.createElement("li");
							Spirit.ouputCodename(spirit, li);
							if (li.innerHTML !== "") {
								ul.innerHTML = li.outerHTML + ul.innerHTML;
							}
						})(main.querySelector<HTMLUListElement>("div.data-container>div>ul#power-info")!);
						Spirit.outputPersonalInfo(spirit, main.querySelector<HTMLUListElement>("div.data-container>div>ul#personal-info")!);
						if (spirit.loreStats) {
							const div = main.querySelector<HTMLDivElement>("div.svg-container#lore-stats")!;
							div.style.visibility = "visible";
							div.querySelector<SVGTextElement>("svg>text[data-field]")!.textContent = spirit.loreStats.class ?? null;
							LORE_GRAPH.setStats(spirit.loreStats, (stat, value) => void (div.querySelector<HTMLLIElement>(`li[data-field="${stat}"]`)!.dataset.value = value ? value.toString() : "?"));
						} else {
							main.querySelector<HTMLDivElement>("div.svg-container#lore-stats")!.style.visibility = "hidden";
						}
						if (spirit.spStats) {
							main.querySelector<HTMLDivElement>("div.svg-container#SP-stats")!.style.visibility = "visible";
							main.querySelector<HTMLDivElement>("div.svg-container#SP-stats>svg>text[data-field]")!.textContent = spirit.spStats.rank ?? null;
							SP_GRAPH.setStats(spirit.spStats);
							{
								const ul = main.querySelector<HTMLDivElement>("div.svg-container#SP-stats>ul:last-of-type")!;
								ul.innerHTML = ul.querySelector<HTMLLIElement>("li[data-field]")!.outerHTML;
								spirit.spStats.elDMG.forEach(el => {
									const li = document.createElement("li");
									li.classList.add("data-element-" + el.label);
									if (el.icon) {
										database.applyBlob(el.icon, blobURL => {
											li.appendChild(document.createElement("img")).src = blobURL;
											li.innerHTML += el.label;
										});
									} else {
										li.textContent = el.label;
									}
									ul.appendChild(li);
								});
							}
						} else {
							main.querySelector<HTMLDivElement>("div.svg-container#SP-stats")!.style.visibility = "hidden";
						}
					})
					.catch(console.error);
			} else {
				window.location.hash = "";
				main.className = "";
			}
		};
		// Setup navigation menu
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
		database.getAllData()
			.then(spirits => {
				document.head.appendChild(document.createElement("style")).innerHTML = spirits.reduce<string>((css, spirit) => css + Spirit.cssTheme(spirit), "");
				return spiritMenu(spirits, document.querySelector<HTMLUListElement>("header>nav>ul")!);
			})
			.then(() => {
				// Use stored blobs as image sources
				for (let i = 0; i < document.images.length; i++) {
					const img = document.images.item(i)!;
					if (img.src !== "") {
						database.applyBlob(img.src, blobURL => void (img.src = blobURL));
					}
				}
				//@ts-ignore
				window.onhashchange({ newURL: window.location.toString() });
			});
	})
	.catch((error: Error) => {
		console.error(error);
		alert(`FATAL ERROR:\n${error.message}\n\nPlease see the console for more details.`);
	});
