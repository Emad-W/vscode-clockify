import * as vscode from 'vscode';
import { get90DayAverage } from '../helpers/statusbar/get90DayAverage';
import { getCurrentDaySum } from '../helpers/statusbar/getCurrentDaySum';
import moment = require('moment');
import { ICONS } from '../config/constants';
import { SSL_OP_NETSCAPE_DEMO_CIPHER_CHANGE_BUG } from 'constants';
import {stopTracking} from '../commands/tracking/stopTracking';
import {startTracking} from '../commands/tracking/startTracking';
import {resumeTracking} from '../commands/tracking/resumeTracking';
import {stopTrackingWithCustomTime} from '../commands/tracking/stopTrackingWithCustomTime';
import Axios from 'axios';

// import * as TelegramBot from 'node-telegram-bot-api';

let statusBarItem: vscode.StatusBarItem;
let last90DaysAverage: moment.Duration;
let focused: boolean;
let timeWhenFocusLost: Date;
const config = vscode.workspace.getConfiguration('clockify');
const maxIdleTime:number = config.get("maxIdleTime") || 300;
const botApiToken:string = config.get("telegramApiKey") || "";
const chatId:string = config.get("telegramChatId") || "";
const telegramUserName:string = config.get("telegramUserName") || "";
let idleTimeout:NodeJS.Timeout;

console.log("chatid:", chatId, botApiToken);
// const bot = new TelegramBot(botApiToken);

export async function initStatusBarItem(context: vscode.ExtensionContext): Promise<void> {
	context.subscriptions.push(
		vscode.commands.registerCommand('clockify.statusbar.menu', () => openStatusBarMenu(context))
	);

	statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
	statusBarItem.text = 'Clockify';
	statusBarItem.command = 'clockify.statusbar.menu';
	statusBarItem.show();

	context.subscriptions.push(statusBarItem);

	last90DaysAverage = await get90DayAverage();

	// vscode.window.onDidChangeActiveTextEditor(onChange);
	// vscode.window.onDidChangeTextEditorSelection(onChange);
	vscode.window.onDidChangeWindowState((event) => onChange(event, context));
	// vscode.workspace.onDidSaveTextDocument(onChange);

	updateStatusBarItem(context);
}
export function onChange(event: vscode.WindowState, context:vscode.ExtensionContext) {
	// console.log("editor changed", event);
	const isTracking = context.globalState.get<boolean>('tracking:isTracking');
	console.log(isTracking);
	// return;
	
	if (event.focused === focused) { return; } // Also if focus lost twice without focus gotten, is this possible?

	if (!event.focused) { // focus lost
		console.log(maxIdleTime)
		setTimeout(() => {
			sendTelegramMessage();
		}, maxIdleTime);
		timeWhenFocusLost = new Date();
	} else { // Got focus again
		clearTimeout(idleTimeout);

		const timeWhenFocusGotten = new Date();
		const timeDifference = new Date(timeWhenFocusGotten.getTime() - timeWhenFocusLost.getTime());
		let timeString;
		if ((timeDifference.getTime() / 1000) > 2 ) {
			console.log("above idle time");
			if (timeDifference.getHours() > 1) {
				timeString = `${timeDifference.getHours()} hours ${timeDifference.getMinutes()} minutes`;

			} else if (timeDifference.getMinutes() > 1) {
				timeString = `${timeDifference.getMinutes()} minutes ${timeDifference.getSeconds()} seconds`;

			} else {
				timeString = `${timeDifference.getSeconds()} seconds`;
			}
			
			vscode.window.showInformationMessage(`You where idle for: ${timeString}. 
			Do you want to delete this from your clockify time?`,
			'Yes', 'Yes, continue tracking', 'No').then(selection => {
				console.log(selection);
				if(selection === "Yes") {
					//Delete it from time..
					// stopTracking(context);
					stopTrackingWithCustomTime(context,timeWhenFocusLost.toISOString());
				} else if ( selection === "No") {
					return;
				} else if ( selection === "Yes, continue tracking" ){
					stopTrackingWithCustomTime(context,timeWhenFocusLost.toISOString());
					startTracking(context);
					//start timer again..
				} else {
					console.log("hmmmmm???")
				}
			});

		} else {
			console.log("Idle threshold not reached");
		}

	}
	focused = event.focused;
}
export function openStatusBarMenu(context:vscode.ExtensionContext) {
	
	// vscode.window.showInformationMessage(`Do you want to start or stop your timer?`,`Start`, `Stop`).then((event) => {
	// 	if(event === "Start") {
	// 		startTracking(context);
	// 	} else if (event === "Stop") {
	// 		stopTracking(context);
	// 	}
	// })
}

export async function updateStatusBarItem(
	context: vscode.ExtensionContext,
	updateLast90DaysAverage = false
) {
	// let start = moment(new Date());
	let isTracking = context.globalState.get<boolean>('tracking:isTracking');

	// Get daily average for last 90 days
	if (updateLast90DaysAverage) {
		last90DaysAverage = await get90DayAverage();
	}
	const codeTimeAvg = last90DaysAverage
		? `${Math.round(last90DaysAverage.asHours() * 10) / 10} hrs`
		: '0 hrs';
	// Sum up current day's tracked time
	const currentDaySum = await getCurrentDaySum(context);
	const codeTimeToday = currentDaySum
		? currentDaySum.asHours() < 1
			? `${Math.round(currentDaySum.asMinutes() * 10) / 10} min`
			: `${Math.round(currentDaySum.asHours() * 10) / 10} hrs`
		: '0 hrs';

	//#region Get color
	let color = '#2196f3';
	// red >1h below avg
	if (last90DaysAverage && currentDaySum) {
		if (
			moment
				.duration(currentDaySum)
				.add(1, 'hour')
				.asMilliseconds() < last90DaysAverage.asMilliseconds()
		) {
			color = '#f44336';
		}
		// orange <1h below avg
		else if (currentDaySum.asMilliseconds() < last90DaysAverage.asMilliseconds()) {
			color = '#ff9800';
		}
		// blue == avg
		else if (currentDaySum.asMilliseconds() === last90DaysAverage.asMilliseconds()) {
			color = '#2196f3';
		}
		// green >= avg
		else {
			color = '#4caf50';
		}
	}
	let idleTime

	statusBarItem.color = color;
	//#endregion

	statusBarItem.tooltip = `Code time today vs. your daily average.${
		isTracking ? ` ${ICONS.Bullet} Tracking...` : ''
		}`;
	statusBarItem.text = `${codeTimeToday} | ${codeTimeAvg} ${isTracking ? ICONS.Clock : ''}`;

	// let end = moment(new Date());
	// let d = moment.duration(end.diff(start));
	// console.log('updateStatusBartItem', d.asMilliseconds());
}

function sendTelegramMessage() {
	console.log(botApiToken, telegramUserName, chatId);
	Axios.post(`https://api.telegram.org/bot${botApiToken}/sendMessage`,
               {
                    chat_id: chatId,
                    text: `@${telegramUserName} seems to be AFK but still clocking in. Give him a poke!`
               })
               .then((response) => { 
					console.log(response);
               }).catch((error) => {
                    console.log(error);
               });
}