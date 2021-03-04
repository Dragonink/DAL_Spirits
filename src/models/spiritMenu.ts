import { blobAsDataURL } from "../util/fetch";
import DataStrategy from "./database/DataStrategy";
import Spirit, { Series } from "./Spirit";

const CHARACTER_FLAGS = ["wizard", "collaboration", "spoiler"] as const;
type CharacterFlags = (typeof CHARACTER_FLAGS)[number];

type SpiritFormMenuResult = {
	readonly li: HTMLLIElement;
} & {
		readonly [F in CharacterFlags]: boolean;
	};
function spiritFormMenu(database: DataStrategy<Spirit>, spirit: Spirit): SpiritFormMenuResult {
	const li = document.createElement("li");
	let wizard: boolean;
	if (wizard = /Wizard/.test(spirit.form.name)) {
		li.classList.add("data-wizard");
	}
	let collaboration: boolean;
	if (collaboration = spirit.series !== "Date A Live") {
		li.classList.add("data-collaboration");
	}
	let spoiler: boolean;
	if (spoiler = spirit.spoiler) {
		li.classList.add("data-spoiler");
	}
	(a => {
		a.href = `#spirits/${spirit.firstname}/${spirit.form.url}`;
		(img => {
			img.alt = `${spirit.form.name} ${spirit.firstname}`;
			img.height = 48;
			if (spirit.images.menuIcon) {
				database.getBlob(spirit.images.menuIcon)
					.then(blob => {
						if (blob) {
							blobAsDataURL(blob)
								.then(dataURL => void (img.src = dataURL));
						}
					})
					.catch(console.warn);
			}
		})(a.appendChild(document.createElement("img")));
		(p => {
			p.classList.add("textit");
			p.textContent = spirit.form.name;
		})(a.appendChild(document.createElement("p")));
	})(li.appendChild(document.createElement("a")));
	return { li, wizard, collaboration, spoiler };
}

function characterMenu(database: DataStrategy<Spirit>, forms: readonly Spirit[]): HTMLLIElement {
	if (forms.length > 0) {
		const li = document.createElement("li");
		li.classList.add(forms[0]!.firstname);
		(button => {
			button.classList.add("nav");
			button.innerHTML = Spirit.outputFullname(forms[0]!);
		})(li.appendChild(document.createElement("button")));
		(ul => {
			const flags: { [F in CharacterFlags]: boolean; } = {
				wizard: true,
				collaboration: true,
				spoiler: true,
			};
			forms.forEach(spirit => {
				const result = spiritFormMenu(database, spirit);
				for (const flag of CHARACTER_FLAGS) {
					flags[flag] &&= result[flag];
				}
				ul.appendChild(result.li);
			});
			for (const flag of CHARACTER_FLAGS) if (flags[flag]) {
				li.classList.add("data-" + flag);
			}
		})(li.appendChild(document.createElement("ul")));
		return li;
	} else {
		throw new Error("Spirit list is empty");
	}
}

export type SpiritOrder = {
	[S in Series]?: string[];
};
/** Build the menu
 * @param database Reference to the database storing characters
 * @param spiritOrder Definition of the order in which the characters must appear in the menu
 * @param ul UL element to build the menu into
 */
export default function buildSpiritMenu(database: DataStrategy<Spirit>, spiritOrder: SpiritOrder, ul: HTMLUListElement): Promise<void> {
	ul.innerHTML = "";
	let promise = Promise.resolve();
	Object.entries(spiritOrder).forEach(([series, seriesOrder]) => {
		promise = promise
			.then(() => database.searchData("series", series))
			.then(spirits => {
				(li => {
					li.classList.add("data-collaboration-marker");
					li.textContent = series;
				})(ul.appendChild(document.createElement("li")));
				if (spirits.length > 0 && seriesOrder) {
					seriesOrder.forEach(spiritName => {
						ul.appendChild(characterMenu(database, spirits.filter(spirit => spirit.firstname === spiritName)));
					});
				}
			});
	});
	return promise;
}

/** Update the active item in the menu
 * @param ul UL element which contains the menu
 * @param newURL Current URL
 * @param oldURL Previous URL
 */
export function updateActive(ul: HTMLUListElement, newURL: URL, oldURL?: URL) {
	const ACTIVE_CLASS = "active";
	if (oldURL) {
		(a => {
			if (a) {
				a.classList.remove(ACTIVE_CLASS);
				a.parentElement!.parentElement!.parentElement!.querySelector("button")!.classList.remove(ACTIVE_CLASS);
			}
		})(ul.querySelector<HTMLAnchorElement>(`a[href="${oldURL.hash}"]`));
	}
	(a => {
		if (a) {
			a.classList.add(ACTIVE_CLASS);
			a.parentElement!.parentElement!.parentElement!.querySelector("button")!.classList.add(ACTIVE_CLASS);
		}
	})(ul.querySelector<HTMLAnchorElement>(`a[href="${newURL.hash}"]`));
}
