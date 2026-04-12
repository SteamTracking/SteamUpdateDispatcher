import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";

const isDocker = existsSync("/.dockerenv");
const isPodman = existsSync("/run/.containerenv");
const CACHE_FILE = isDocker || isPodman ? "/var/cache/steam-update-dispatcher" : "config/cache.json";

export default class Cache {
	constructor() {
		this.data = { apps: {} };
	}

	async init() {
		try {
			this.data = await readFile(CACHE_FILE, "utf8").then((data) => JSON.parse(data));
		} catch (err) {
			if (err.code === "ENOENT") {
				console.info("Cache file not found, creating one");
				this.#write();
			} else if (err.name === "SyntaxError") {
				console.warn("Cache file is corrupted, resetting it");
				this.#write();
				console.info("Cache file has been reset");
			} else {
				console.error(err);
				process.exit(1);
			}
		}
	}

	async #write() {
		try {
			await writeFile(CACHE_FILE, JSON.stringify(this.data));
		} catch (err) {
			console.error(err);
		}
	}

	is_buildid_updated(appid, buildid) {
		this.data.apps[appid] ??= {};

		if (this.data.apps[appid].buildid !== buildid) {
			this.data.apps[appid].buildid = buildid;
			this.#write();
			return true;
		}
		return false;
	}
}
