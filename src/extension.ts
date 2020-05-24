
import * as vscode from 'vscode';
import { ExcalidrawEditorProvider } from './excalidrawEditor';

export function activate(context: vscode.ExtensionContext) {

	context.subscriptions.push(ExcalidrawEditorProvider.register(context));
}