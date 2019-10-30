import * as vscode from 'vscode';
import http from '../services/http.service';
import { providerStore } from '../treeView/stores';
import { WorkspacesProvider } from '../treeView/workspaces/workspaces.provider';
import { ClientsProvider } from '../treeView/clients/clients.providers';
import { ProjectsProvider } from '../treeView/projects/projects.provider';
import { TasksProvider } from '../treeView/tasks/tasks.provider';
import { TagsProvider } from '../treeView/tags/tags.provider';

export async function setTelegramApiKey() {
	const apiKey = await vscode.window
		.showInputBox({
			ignoreFocusOut: true,
			placeHolder: 'Enter your Telegram API key',
			prompt: 'Enter your Telegram API key'
		})
		.then((apiKey) => {
			if (apiKey === undefined) {
				throw new Error('No API key entered');
			}
			return apiKey;
		});

	// Add API key to config
	const config = vscode.workspace.getConfiguration('clockify');
	config.update('telegramApiKey', apiKey, true);

	// Authenticate
	// http.authenticate(apiKey);

}
