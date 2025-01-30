// Import the module and reference it with the alias vscode in your code below
const vscode = require('vscode');
// const child_process = require('child_process')

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "coderAI" is now active!');

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with  registerCommand
	// The commandId parameter must match the command field in package.json
	const disposable = vscode.commands.registerCommand('coderAI.writeDocstring', async () => {
		// The code you place here will be executed every time your command is executed

		const editor = vscode.window.activeTextEditor;

		if (!editor) {
			vscode.window.showErrorMessage('No active window selected.')
		}


		const languageId = editor.document.languageId;

		vscode.window.showInformationMessage(`Generating docstring for ${languageId}`)

		const config = vscode.workspace.getConfiguration('coder')

		const langPrompts = config.get('languagePrompts')
		const autoSave = config.get('autoSave')
		const engineDetails = config.get('engineDetails')
		const aiEngine = config.get('aiEngine')
		// const pythonLinter = config.get('pythonLinter')
		// const pythonLinterConfigPath = config.get('pythonLinterConfigPath')

		if (aiEngine.trim() == "" ) {
			vscode.window.showErrorMessage('Invalid settings. make sure aiEngine and engineDetails should not be empty')
		}

		try {

			await vscode.window.withProgress(
				{
					location: vscode.ProgressLocation.Notification,
					title: 'Generating Doctring.',
					cancellable: false,
				},
				async () => {
					const symbols = await vscode.commands.executeCommand('vscode.executeDocumentSymbolProvider', editor.document.uri);

					const position = editor.selection.active;

					const flattenedSymbols = flattenSymbols(symbols);
					console.log('flattenedSymbols', flattenedSymbols)
					const currentSymbol = flattenedSymbols.findLast(symbol => 
						position.isAfterOrEqual(symbol.range.start) && position.isBeforeOrEqual(symbol.range.end)
					);
					
					let indentation = ''
					let selectedText = ''
					let symbolRangeUsed = false

					if (!currentSymbol) {
						// Retrieve the entire content of the file
						vscode.window.showErrorMessage('0 or more than 1 function decleration found, Select whole function to generate docstring!!')
						const selection = editor.selection;
						selectedText = editor.document.getText(selection);
					} else {
						const symbolRange = currentSymbol.range;
						indentation = ' '.repeat(symbolRange.c.e);
						selectedText = editor.document.getText(symbolRange);
						symbolRangeUsed = true
					}
					
					if (!selectedText.trim()) {
						vscode.window.showErrorMessage('No code selected to generate docstring!!')
					}

					const prompt = getDocstringPrompt(languageId, langPrompts)
					let newCode = await fetchEngineResponse(aiEngine, engineDetails, prompt, selectedText);

					if (!newCode) {
						vscode.window.showErrorMessage('Error generating docstring!!, Please try again.')
						return 
					}

					const newCodeList = newCode.split('\n');
					const indentedLines = newCodeList.map(line => indentation + line);
					indentedLines[0] = newCodeList[0]
					newCode =  indentedLines.join('\n');

					editor.edit((editBuilder) => {
						if (symbolRangeUsed){
							const symbolRange = currentSymbol.range;
							editBuilder.replace(symbolRange, newCode)
						}
						else {
							const selection = editor.selection;
							editBuilder.replace(selection, newCode)
						}
					});
					// const document = await vscode.workspace.openTextDocument({
					// 	content: newCode,
					// 	language: languageId,
					// });
					// await vscode.window.showTextDocument(document, {
					// 	preview: false,
					// });
					// vscode.window.showInformationMessage('Linting complete. Check the new window!');
					// const originalDocument = await vscode.workspace.openTextDocument({
					// 	content: selectedText,
					// 	language: languageId,
					// });
			
					// const lintedDocument = await vscode.workspace.openTextDocument({
					// 	content: newCode,
					// 	language: languageId,
					// });
					// await vscode.commands.executeCommand('vscode.diff', originalDocument.uri, lintedDocument.uri, 'Linting Changes');

					// vscode.window.showInformationMessage('Linting complete. Check the diff view!');
				}
			)

			if (autoSave) {
				editor.document.save()
			}

		} catch (error) {
			vscode.window.showErrorMessage(`Failed to generate docstring: ${error.message}`)
		}
	});

	context.subscriptions.push(disposable);
}


function flattenSymbols(symbols) {
    const result = [];
    for (const symbol of symbols) {
        result.push(symbol);
        if (symbol.children) {
            result.push(...flattenSymbols(symbol.children));
        }
    }
    return result;
}

const getDocstringPrompt = (languageId, langPrompts) => {

	let prompt = `For the provided code in ${languageId} language, add docstring and return the code without any change.`
	if (!languageId) {
		return prompt
	}
	const firstMatch = langPrompts.find(item => item.language.toString().toUpperCase() === languageId.toString().toUpperCase());

	if (firstMatch) {
		prompt = `For the provided code in ${languageId}, add docstring as per the example provided.\n Example-\n ${firstMatch.prompt}`
	}

	return prompt

}

function getFirstAndLastLine(inputString) {
	console.log('inputString', inputString)
    const lines = inputString.split('\n'); // Split the string into lines
    const firstLine = lines[0]; // First line
    const lastLine = lines[lines.length - 1]; // Last line
    return { firstLine, lastLine };
}

async function fetchEngineResponse(engine, engineDetails, prompt, functionCode) {
	
	switch(engine.toUpperCase()) {
		case 'OPENAI':
			let openAILines = await generateDocstringOpenAI(engineDetails.OpenAI.url, engineDetails.OpenAI.key, engineDetails.OpenAI.model, prompt, functionCode);
			return await parseAIResponse(openAILines, functionCode)
		case 'AZUREOPENAI':
				let AzureOpenAILines = await generateDocstringAzureOpenAI(engineDetails.OpenAI.url, engineDetails.OpenAI.key, engineDetails.OpenAI.model, prompt, functionCode);
				return await parseAIResponse(AzureOpenAILines, functionCode)
		case 'GEMINI':
			let geminiLines = await generateDocstringGemini(engineDetails.Gemini.url, engineDetails.Gemini.key, engineDetails.Gemini.model, prompt, functionCode);
			return await parseAIResponse(geminiLines, functionCode)
			
		case 'DEEPSEEK':
			let deepseekLines = await generateDocstringDeepseek(engineDetails.url, engineDetails.authValue, prompt, functionCode);
			return await parseAIResponse(deepseekLines, functionCode)
		default:
			vscode.window.showErrorMessage('Invalid Engine selected')
	}

}

async function parseAIResponse(responseLines, functionCode) {

	console.log('functionCode', functionCode, 'reponse', responseLines)
	try {
		const { firstLine, lastLine } = getFirstAndLastLine(functionCode);

		console.log('lastLine', firstLine)

		const trimmed_lines = responseLines.map(s => s.trim());
		
		const firstLineIndex = trimmed_lines.indexOf(firstLine.trim());
		const lastLineIndex = trimmed_lines.lastIndexOf(lastLine.trim());
		const relevantLines = responseLines.slice(firstLineIndex, lastLineIndex + 1);
		return relevantLines.join('\n');
	}
	catch (error) {
		vscode.window.showErrorMessage(`Error while parsing AI response: ${error}`);
		return null;
	}
}

async function generateDocstringDeepseek(uri, key, prompt, functionCode) {

	let lines = ""
	try {
		const payload = {
			messages: [
				{
					role: "system",
					content: `You are a coding assistant which generates doctrings. Add doctring to the code and return the output. Do not edit or change code or code format`
				},
				{
					role: "user",
					content: `${prompt}\n Code -\n${functionCode}`
				},

			],
			temperature: 0,
			frequency_penalty: 0,
			presence_penalty: 0,
			max_tokens: 4096,
			stop: null
		};

		const response = await fetch(uri, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"api-key": key,
			},
			body: JSON.stringify(payload),
		});

		if (!response.ok) {
			const error = await response.text();
			vscode.window.showErrorMessage(`Deepseek API error: ${error}`);
			return null;
		}

		const data = await response.json();
		console.log('data', data)

		lines = data.choices[0].message.content.split('\n');
	} catch (error) {
		vscode.window.showErrorMessage("Please retry - Error generating docstring:", error);
		return null;
	}
}

async function generateDocstringGemini(uri, key, model, prompt, functionCode) {

	let lines = ""
	try {
		const payload = {
			"contents": [
				{
					parts: [
						{
							text: `You are a coding assistant which generates doctrings. Add doctring to the code and return the output. Do not edit or change code or code format`
						},
						{
							text: `${prompt}\n Code -\n${functionCode}`
						}

					]
				}
			]
		};
		console.log('model', model)
		const response = await fetch(`${uri}/${model}:generateContent?key=${key}`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json"
			},
			body: JSON.stringify(payload),
		});

		if (!response.ok) {
			const error = await response.text();
			console.log('error', response.status)
			vscode.window.showErrorMessage(`Gemini API error ${response.status}: ${error}`);
			return null;
		}

		const data = await response.json();
		console.log('data', data)

		lines = data.candidates[0].content.parts[0].text.split('\n');
		return lines
	} catch (error) {
		vscode.window.showErrorMessage(`Please retry - Error generating docstring: ${error}`);
		return null;
	}
}

async function generateDocstringOpenAI(uri, key, model, prompt, functionCode) {

	let lines = ""
	try {
		const payload = {
			model: model,
			messages: [
				{
					role: "system",
					content: `You are a coding assistant which generates doctrings. Add doctring to the code and return the output. Do not edit or change code or code format`
				},
				{
					role: "user",
					content: `${prompt}\n Code -\n${functionCode}`
				},

			],
			temperature: 0,
			frequency_penalty: 0,
			presence_penalty: 0,
			max_tokens: 4096,
			stop: null
		};

		const response = await fetch(uri, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"Authorization": `Bearer ${key}`,
			},
			body: JSON.stringify(payload),
		});

		if (!response.ok) {
			const error = await response.text();
			vscode.window.showErrorMessage(`OpenAI API error: ${error}`);
			return null;
		}

		const data = await response.json();
		console.log('data', data)

		lines = data.choices[0].message.content.split('\n');
		return lines
	} catch (error) {
		vscode.window.showErrorMessage("Please retry - Error generating docstring:", error);
		return null;
	}
}

async function generateDocstringAzureOpenAI(uri, key, model, prompt, functionCode) {

	let lines = ""
	try {
		const payload = {
			model: model,
			messages: [
				{
					role: "system",
					content: `You are a coding assistant which generates doctrings. Add doctring to the code and return the output. Do not edit or change code or code format`
				},
				{
					role: "user",
					content: `${prompt}\n Code -\n${functionCode}`
				},

			],
			temperature: 0,
			frequency_penalty: 0,
			presence_penalty: 0,
			max_tokens: 4096,
			stop: null
		};

		const response = await fetch(uri, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"api-key": `${key}`,
			},
			body: JSON.stringify(payload),
		});

		if (!response.ok) {
			const error = await response.text();
			vscode.window.showErrorMessage(`OpenAI API error: ${error}`);
			return null;
		}

		const data = await response.json();
		console.log('data', data)

		lines = data.choices[0].message.content.split('\n');
		return lines
	} catch (error) {
		vscode.window.showErrorMessage("Please retry - Error generating docstring:", error);
		return null;
	}
}


// This method is called when your extension is deactivated
function deactivate() { }

module.exports = {
	activate,
	deactivate
}
