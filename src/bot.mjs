#!/usr/bin/env node

import SteamUser from "steam-user";

import Cache from "./cache.mjs";
import Config from "./config.mjs";

const updateRate = process.env.UPDATE_RATE ? parseInt(process.env.UPDATE_RATE, 10) : 10000;

const client = new SteamUser();
const config = new Config();
await config.init();
const cache = new Cache();
await cache.init();

const sendWebhook = async (webhook) => {
	try {
		const response = await fetch(`https://api.github.com/repos/${webhook.repo}/actions/workflows/${webhook.workflow_id}/dispatches`, {
			method: "POST",
			headers: {
				Accept: "application/vnd.github.everest-preview+json",
				"Content-Type": "application/json",
				Authorization: `Bearer ${webhook.access_token || config.getDefaultGithubToken()}`,
			},
			body: JSON.stringify({
				ref: webhook.branch || "main",
			}),
		});
		if (response && !response.ok) {
			console.error(`Failed to send webhook: ${response.status} ${response.statusText} ${response.url}`);
		} else {
			console.info(`Webhook sent successfully to ${webhook.repo} for workflow ${webhook.workflow_id}`);
		}
	} catch (err) {
		console.error(err);
	}
};

client.setOptions({
	enablePicsCache: true,
	changelistUpdateInterval: updateRate,
	machineIdType: SteamUser.EMachineIDType.PersistentRandom,
});

client.logOn(config.getSteamLogins());

const initAfterLogin = async () => {
	Object.keys(config.getApp()).forEach(async (appid) => {
		// for some reason getProductInfo only times out
		// hopefully waiting 30s after boot is enough to make picsCache never be empty
		// if (!client.picsCache.apps[appid]) {
		//     console.debug("Product info fetching");
		//     await client.getProductInfo([appid], []);
		//     console.debug("Product info fetched");
		// }
		if (!client.picsCache.apps[appid]?.appinfo) {
			console.info(`App ${appid} is not available`);
			return;
		}
		const branch = config.getBranch(appid);
		const branchData = client.picsCache.apps[appid].appinfo.depots?.branches?.[branch];
		if (!branchData) {
			console.info(`Branch ${branch} is not available for app ${appid}`);
			return;
		}
		if (cache.is_buildid_updated(appid, branchData.buildid)) {
			config.getApp(appid)?.webhooks.forEach((webhook) => {
				sendWebhook(webhook, appid);
			});
		}
	});
};

client.on("loggedOn", () => {
	console.info("Logged into Steam");
	setTimeout(initAfterLogin, 30000);
});

client.on("error", (err) => {
	console.error(err);
});

client.on("appUpdate", (appid, data) => {
	console.info(`App ${appid} has been updated`);
	if (!config.getApp(appid)) {
		console.info(`App ${appid} is not being monitored`);
		return;
	}

	const branch = config.getBranch(appid);
	const newBranchData = data?.appinfo?.depots?.branches?.[branch];
	const oldBranchData = client.picsCache.apps[appid]?.appinfo?.depots?.branches?.[branch];

	if (
		(newBranchData && cache.is_buildid_updated(appid, newBranchData.buildid)) ||
		(oldBranchData && newBranchData && oldBranchData.buildid !== newBranchData.buildid)
	) {
		config.getApp(appid)?.webhooks?.forEach((webhook) => {
			sendWebhook(webhook, appid);
		});
	}
});
