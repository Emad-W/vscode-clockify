import * as vscode from 'vscode';
import * as _ from 'lodash';
import { TimeEntryRequest } from '../../api/interfaces';
import { addTimeentry } from '../../api/actions/timeEntry';
import { selectWorkspace } from '../../helpers/selectWorkspace';
import { selectProject } from '../../helpers/selectProject';
import { selectTask } from '../../helpers/selectTask';
import { getDescription } from '../../helpers/getDescription';
import { selectBillable } from '../../helpers/selectBillable';
import { selectTags } from '../../helpers/selectTags';
import { updateStatusBarItem } from '../../statusbar/init';
import { providerStore } from '../../treeView/stores';
import { TimeentriesProvider } from '../../treeView/timeentries/timeentries.provider';

export async function resumeTracking(context: vscode.ExtensionContext) {
	// 1. Select Workspace
	// 2. Select Project
	// 3. Select Task
	// 4. Description
	// 5. Billable
	// 6. Select Tags
	try {
		let newTimeentry: TimeEntryRequest = {} as TimeEntryRequest;
		newTimeentry.start = new Date().toISOString();

		console.log(context.globalState.get("tracking:workspaceId"));
		const workspaceId:string = context.globalState.get("tracking:workspaceId") || await selectWorkspace();
		newTimeentry.workspaceId = workspaceId;

		const projectId:string = context.globalState.get("tracking:projectId") || await selectProject(workspaceId, false);
		newTimeentry.projectId = projectId;

		const taskId:string = context.globalState.get("tracking:taskId") || await selectTask(workspaceId, projectId, false);
		newTimeentry.taskId = taskId;

		const description:string = context.globalState.get("tracking:description") || await getDescription(false);
		newTimeentry.description = description;

		let billable:boolean;
		if(context.globalState.get("tracking:billable") === "") {
			billable = await selectBillable(false);
		}else {
			billable = context.globalState.get("tracking:billable") || false;
		}
		
		newTimeentry.billable = billable;

		//#region GET TAGS ITEMS
		const tagIds:string[] = context.globalState.get("tracking:tagIds") || await selectTags(workspaceId, false);
		newTimeentry.tagIds = tagIds;

		// Add Time Entry
		const timeEntry = await addTimeentry(workspaceId, newTimeentry);
		if (timeEntry) {
			context.globalState.update('workspaceId', workspaceId);
			vscode.window.showInformationMessage('Tracking started');
		}

		// Update status bar item
		context.globalState.update('tracking:isTracking', true);
		updateStatusBarItem(context, true);

		// Update tree view
		const timentriesProvider = providerStore.get<TimeentriesProvider>('timeentries');
		timentriesProvider.refresh();
	} catch (err) {
		console.log(err);
	}
}
