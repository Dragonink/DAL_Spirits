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
