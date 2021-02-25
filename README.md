# *Date A Live* Spirits

This is a **mini-project for fun**,
aiming to build a webpage that displays basic info and stats about "Spirits" from the [*Date A Live*](https://date-a-live.fandom.com) series.

This webpage is a single `.html` file which can update and cache data and media to access them offline.

> The media resources are downloaded from [n0k0m3/DateALiveData](https://github.com/n0k0m3/DateALiveData).
> These resources are a property of the *Date A Live* Partners and *Date A Live: Spirit Pledge* Partners.

## Download

Download the latest `.html` file from [here](https://github.com/Dragonink/DAL_Spirits/releases/latest), and you're ready to go !

Just put the file somewhere and open it with your favorite web browser.

## Technical details

- Webpage structure is **raw HTML**
- Webpage style is **raw CSS**
- Webpage scripts are **TypeScript**
	- Local storage of data and media uses [**IndexedDB**](https://developer.mozilla.org/docs/Web/API/IndexedDB_API)
	- Data hashes are computed using [**object-hash**](https://www.npmjs.com/package/object-hash)

### Bundling steps

1. [**Browserify**](https://www.npmjs.com/package/browserify) (with [**tsify**](https://www.npmjs.com/package/tsify)) to compile **TypeScript** into a single **JavaScript** file usable in browsers
2. [**Terser**](https://www.npmjs.com/package/terser) to compress **JavaScript**
3. [**CSSO**](https://www.npmjs.com/package/csso) to compress **CSS**
4. [**jsdom**](https://www.npmjs.com/package/jsdom) to inline **CSS** and **JavaScript** in **HTML**
5. [**html-minifier-terser**](https://www.npmjs.com/package/html-minifier-terser) to compress **HTML**
