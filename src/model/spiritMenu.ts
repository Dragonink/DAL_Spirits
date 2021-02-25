import Spirit from "./Spirit";

const CHARACTER_FLAGS = ["wizard", "collaboration", "spoiler"] as const;

/** Build the app menu
 * @param spirits Array of all characters
 * @param ul UL element to build the menu into
 */
export default function spiritMenu(spirits: Spirit[], ul: HTMLUListElement) {
	ul.innerHTML = "";
	let lastSeries: string = "";
	return spirits.forEach(spirit => {
		if (spirit.series !== lastSeries) {
			const li = ul.appendChild(document.createElement("li"));
			li.classList.add("data-collaboration-marker");
			li.textContent = lastSeries = spirit.series;
		}
		if (!ul.lastElementChild || !ul.lastElementChild.classList.contains(spirit.firstname)) {
			const li = ul.appendChild(document.createElement("li"));
			li.classList.add(spirit.firstname, ...CHARACTER_FLAGS.map(flag => "data-" + flag));
			const button = li.appendChild(document.createElement("button"));
			button.classList.add("nav");
			button.innerHTML = Spirit.outputFullname(spirit);
			li.appendChild(document.createElement("ul"));
		}
		const li = ul.lastElementChild!.querySelector("ul")!.appendChild(document.createElement("li"));
		{
			const updateClass = (className: string, test: boolean) => {
				if (test) {
					li.classList.add(className);
				} else {
					ul.lastElementChild!.classList.remove(className);
				}
			};
			updateClass("data-wizard", /Wizard/.test(spirit.form.name));
			updateClass("data-collaboration", spirit.series !== "Date A Live");
			updateClass("data-spoiler", spirit.spoiler);
		}
		return (a => {
			a.href = `#spirits/${spirit.firstname}/${spirit.form.url}`;
			(img => {
				img.height = 48;
				img.alt = `${spirit.form.name} ${spirit.firstname}`;
				img.src = spirit.images.menuIcon ?? "";
			})(a.appendChild(document.createElement("img")));
			(p => {
				p.classList.add("textit");
				p.textContent = spirit.form.name;
			})(a.appendChild(document.createElement("p")));
		})(li.appendChild(document.createElement("a")));
	});
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
