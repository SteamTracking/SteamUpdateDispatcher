import { readFile, watch } from "node:fs/promises";
import yaml from "js-yaml";

const CONFIG_FILE = "config/config.yaml";

export default class Config {
	#data;

	constructor() {
		this.#data = {};
	}

	async init() {
		try {
			this.#data = await readFile(CONFIG_FILE, "utf8").then((data) => yaml.load(data));
			this.verify();
		} catch (err) {
			console.error(err);
			if (err.code === "ENOENT") {
				console.error(`Config file not found, it should be under ${CONFIG_FILE}`);
				process.exit(1);
			}
		}
	}

	verify(config = this.#data) {
		try {
			const envLogins = process.env.STEAM_USERNAME && process.env.STEAM_PASSWORD;
			const configLogins = config.steam?.username && config.steam?.password;
			if (!envLogins && !configLogins) {
				console.error("Steam logins missing");
				process.exit(1);
			}

			if (!config.apps || typeof config.apps !== "object" || Array.isArray(config.apps)) {
				console.error("Config is missing the 'apps' object");
				process.exit(1);
			}

			for (const [appid, app] of Object.entries(config.apps)) {
				if (!app.webhooks || !Array.isArray(app.webhooks) || app.webhooks.length === 0) {
					console.error(`App ${appid} is missing a valid 'webhooks' array`);
					process.exit(1);
				}
				for (const [index, webhook] of app.webhooks.entries()) {
					if (!webhook.repo || !webhook.workflow_id) {
						console.error(`Webhook configuration for app ${appid} at index ${index} is missing 'repo' or 'workflow_id'`);
						process.exit(1);
					}
					if (!webhook.access_token || !process.env.GITHUB_ACCESS_TOKEN || !config.github-token) {
						console.error(`Webhook configuration for app ${appid} at index ${index} is missing an access token and there's no default token set`);
						process.exit(1);
					}
				}
			}

			return true;
		} catch (err) {
			console.error(`Is the config file valid? ${err}\n`);
			return false;
		}
	}

	getBranch(appid) {
		return this.#data.apps[appid]?.branch || "public";
	}

	getApp(appid) {
		if (appid !== undefined) {
			return this.#data.apps?.[appid] || null;
		}
		return this.#data.apps || {};
	}

	getSteamLogins() {
		return {
			accountName: process.env.STEAM_USERNAME || this.#data?.steam?.username,
			password: process.env.STEAM_PASSWORD || this.#data?.steam?.password,
		};
	}
}
