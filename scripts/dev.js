const { dirname } = require("path");
const { readFile, writeFile, mkdir } = require("fs/promises");
const { JSDOM } = require("jsdom");

const [IN, IN_CSV, OUT] = process.argv.slice(2);
readFile(IN, "utf8")
	.then(file => new JSDOM(file))
	.then(dom => {
		const document = dom.window.document;
		document.querySelectorAll("link[rel='stylesheet']")
			.forEach((/** @type {HTMLLinkElement} */ link) => void (link.href = "../static/views/" + link.href));
		return Promise.all([
			readFile(IN_CSV, "utf8")
				.then(csv => {
					const script = document.createElement("script");
					script.id = "DATA";
					script.type = "text/csv";
					script.innerHTML = csv;
					return document.head.querySelector("link#DATA").replaceWith(script);
				}),
			mkdir(dirname(OUT), { recursive: true })
		])
			.then(_results => dom.serialize());
	})
	.then(html => writeFile(OUT, html, "utf8"))
	.catch(error => {
		if (error) {
			console.error(error);
		}
		return process.exit(1);
	});
