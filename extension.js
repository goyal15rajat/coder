const vscode = require('vscode');

// Helper function to get configuration with defaults
function getConfig(key, defaultValue) {
    return vscode.workspace.getConfiguration('coder').get(key, defaultValue);
}

// Function to handle common API errors
function handleApiError(error, engineName, response = null) {
    let message = `${engineName} API error: ${error.message || error}`;
    if (response) {
        message = `${engineName} API error ${response.status}: ${error.message || error}`;
        switch (response.status) {
            case 401:
                message += '. Please check your API key.';
                break;
            case 403:
                message += '. Please check your API key permissions or plan.';
                break;
            case 429:
                message += '. You might have exceeded your quota or rate limit.';
                break;
            case 500:
                message += '. The AI service might be experiencing issues.';
                break;
        }
    } else if (error.name === 'AbortError') {
        message = `${engineName} API request timed out. You can increase the timeout in the extension settings ('coder.requestTimeout').`;
    }
    vscode.window.showErrorMessage(message);
    console.error(message, error);
}

async function generateDocstringOpenAI(code, languageId) {
    const engineDetails = getConfig('engineDetails', {});
    const config = engineDetails.OpenAI;
    const requestTimeout = getConfig('requestTimeout', 30000);

    if (!config || !config.url || !config.key || !config.model) {
        vscode.window.showErrorMessage('OpenAI configuration is missing in settings.');
        return null;
    }

    const prompt = getPromptForLanguage(languageId, code);
    if (!prompt) return null;

    const payload = {
        model: config.model,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.2,
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), requestTimeout);

    try {
        const response = await fetch(config.url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${config.key}`
            },
            body: JSON.stringify(payload),
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: 'Failed to parse error response' }));
            handleApiError(new Error(errorData.error?.message || response.statusText), 'OpenAI', response);
            return null;
        }

        const data = await response.json();
        return data.choices?.[0]?.message?.content?.trim() || null;
    } catch (error) {
        clearTimeout(timeoutId);
        handleApiError(error, 'OpenAI', error.name === 'AbortError' ? null : { status: 'Network Error', statusText: error.message });
        return null;
    }
}

async function generateDocstringGemini(code, languageId) {
    const engineDetails = getConfig('engineDetails', {});
    const config = engineDetails.Gemini;
    const requestTimeout = getConfig('requestTimeout', 30000);

    if (!config || !config.url || !config.key || !config.model) {
        vscode.window.showErrorMessage('Gemini configuration is missing in settings.');
        return null;
    }

    const prompt = getPromptForLanguage(languageId, code);
    if (!prompt) return null;

    const payload = {
        contents: [{ parts: [{ text: prompt }] }]
    };

    const apiUrl = `${config.url}/${config.model}:generateContent?key=${config.key}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), requestTimeout);

    try {
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: 'Failed to parse error response' }));
            handleApiError(new Error(errorData.error?.message || response.statusText), 'Gemini', response);
            return null;
        }

        const data = await response.json();
        return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || null;
    } catch (error) {
        clearTimeout(timeoutId);
        handleApiError(error, 'Gemini', error.name === 'AbortError' ? null : { status: 'Network Error', statusText: error.message });
        return null;
    }
}

async function generateDocstringAzureOpenAI(code, languageId) {
    const engineDetails = getConfig('engineDetails', {});
    const config = engineDetails.AzureOpenAI;
    const requestTimeout = getConfig('requestTimeout', 30000);

    if (!config || !config.url || !config.key) {
        vscode.window.showErrorMessage('Azure OpenAI configuration (URL/Endpoint and Key) is missing.');
        return null;
    }

    const prompt = getPromptForLanguage(languageId, code);
    if (!prompt) return null;

    const payload = {
        messages: [{ role: "user", content: prompt }],
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), requestTimeout);

    try {
        const response = await fetch(config.url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'api-key': config.key
            },
            body: JSON.stringify(payload),
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: 'Failed to parse error response' }));
            handleApiError(new Error(errorData.error?.message || response.statusText), 'Azure OpenAI', response);
            return null;
        }

        const data = await response.json();
        return data.choices?.[0]?.message?.content?.trim() || null;
    } catch (error) {
        clearTimeout(timeoutId);
        handleApiError(error, 'Azure OpenAI', error.name === 'AbortError' ? null : { status: 'Network Error', statusText: error.message });
        return null;
    }
}

function getPromptForLanguage(languageId, code) {
    const languagePrompts = getConfig('languagePrompts', []);
    const langConfig = languagePrompts.find(lp => lp.language === languageId);

    let basePrompt = `Add a standard docstring to the following ${languageId} code. IMPORTANT: Respond ONLY with the complete, modified code block including the new docstring. Do not add any introductory text, explanations, or markdown formatting like \`\`\`.`;

    if (langConfig && langConfig.prompt) {
        basePrompt = `${langConfig.prompt}\n\nIMPORTANT: Respond ONLY with the complete, modified code block including the new docstring. Do not add any introductory text, explanations, or markdown formatting like \`\`\`.`;
    } else if (languageId === 'python') {
        basePrompt = `Generate a standard PEP 257 compliant docstring for the following Python code. Include descriptions for parameters and return values if applicable. IMPORTANT: Respond ONLY with the complete, modified code block including the new docstring. Do not add any introductory text, explanations, or markdown formatting like \`\`\`.`;
    } else {
        vscode.window.showErrorMessage(`No prompt configured for language: ${languageId}. Please configure it in settings.`);
        return null;
    }

    return `${basePrompt}\n\nCode:\n\`\`\`${languageId}\n${code}\n\`\`\``;
}

function parseAIResponse(aiResponse, originalCode) {
    if (!aiResponse || !originalCode) {
        return null;
    }

    const originalCodeTrimmed = originalCode.trim();
    const aiResponseTrimmed = aiResponse.trim();

    const codeBlockRegex = /```(?:\w*\n)?([\s\S]*?)```/;
    const match = aiResponseTrimmed.match(codeBlockRegex);
    const extractedCode = match ? match[1].trim() : aiResponseTrimmed;

    const originalLines = originalCodeTrimmed.split('\n').filter(line => line.trim() !== '');
    const extractedLines = extractedCode.split('\n');

    if (originalLines.length === 0) return null;

    const firstOriginalLine = originalLines[0];
    const lastOriginalLine = originalLines[originalLines.length - 1];

    let startIndex = -1;
    let endIndex = -1;

    for (let i = 0; i < extractedLines.length; i++) {
        if (extractedLines[i].trim() === firstOriginalLine.trim()) {
            startIndex = i;
            break;
        }
    }

    for (let i = extractedLines.length - 1; i >= 0; i--) {
        if (extractedLines[i].trim() === lastOriginalLine.trim()) {
            endIndex = i;
            break;
        }
    }

    if (startIndex !== -1 && endIndex !== -1 && startIndex <= endIndex) {
        const potentialBlock = extractedLines.slice(startIndex, endIndex + 1).join('\n');
        if (potentialBlock.includes(firstOriginalLine) && potentialBlock.includes(lastOriginalLine)) {
            console.log("Parsed response using start/end line matching.");
            return potentialBlock;
        }
    }

    if (extractedCode.includes(originalCodeTrimmed)) {
        console.warn("Parsing fallback: AI response contained original code, returning extracted block.");
        return extractedCode;
    }

    if (extractedCode === originalCodeTrimmed) {
        vscode.window.showWarningMessage("AI response did not seem to modify the code (no docstring added).");
        return null;
    }

    console.error("Failed to parse AI response reliably. Response:", aiResponse);
    vscode.window.showErrorMessage("Failed to parse the AI's response. The format might be unexpected.");
    return null;
}

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function findSymbolRange(editor, position) {
    let symbols = await vscode.commands.executeCommand('vscode.executeDocumentSymbolProvider', editor.document.uri);
    // Retry logic if symbols are initially undefined or empty
    if (!symbols || symbols.length === 0) {
        console.log("Initial symbol fetch failed or returned empty. Retrying after 2 seconds...");
        await delay(2000); // Wait for 2 seconds
        symbols = await vscode.commands.executeCommand('vscode.executeDocumentSymbolProvider', editor.document.uri);

        if (!symbols || symbols.length === 0) {
            console.log("Symbol fetch failed after retry.");
            vscode.window.showErrorMessage('Could not retrieve document symbols. File indexing might be in progress. Please try again shortly.');
            return null; // Indicate failure to find symbols
        }
        console.log("Symbols fetched successfully on retry.");
    }
	const flattenedSymbols = flattenSymbols(symbols);
	const currentSymbol = flattenedSymbols.findLast(symbol => 
		position.isAfterOrEqual(symbol.range.start) && position.isBeforeOrEqual(symbol.range.end)
	);
	
	let indentation = ''
	let selectedText = ''
	let symbolRange = null;
    if (!currentSymbol) {

		// Retrieve the entire content of the file
		vscode.window.showErrorMessage('0 or more than 1 function decleration found, Select whole function to generate docstring!!')
		symbolRange = editor.selection;
	} else {
		symbolRange = currentSymbol.range;

	}
    return symbolRange;
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

function activate(context) {
    console.log('Congratulations, your extension "coderAI" is now active!');

    let disposable = vscode.commands.registerCommand('coderAI.writeDocstring', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showInformationMessage('No active editor found.');
            return;
        }

        const document = editor.document;
        const selection = editor.selection;
        const languageId = document.languageId;

        const aiEngine = getConfig('aiEngine', '');
        if (!aiEngine) {
            vscode.window.showErrorMessage('Please select an AI engine in the CoderAI settings.');
            return;
        }

        const symbolRange = await findSymbolRange(editor, selection.active);
        console.log("Symbol range found:", symbolRange);
        if (!symbolRange) {
            vscode.window.showInformationMessage('Could not find a function or class definition at the cursor position.');
            return;
        }
        console.log("Symbol range: here");
        const originalCode = document.getText(symbolRange);

        console.log("Original code:", originalCode);

        vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: `CoderAI: Generating docstring using ${aiEngine}...`,
            cancellable: false
        }, async (progress) => {
            let aiResponse = null;
            try {
                switch (aiEngine) {
                    case 'OpenAI':
                        aiResponse = await generateDocstringOpenAI(originalCode, languageId);
                        break;
                    case 'Gemini':
                        aiResponse = await generateDocstringGemini(originalCode, languageId);
                        break;
                    case 'AzureOpenAI':
                        aiResponse = await generateDocstringAzureOpenAI(originalCode, languageId);
                        break;
                    default:
                        vscode.window.showErrorMessage(`Unsupported AI engine: ${aiEngine}`);
                        return;
                }

                if (aiResponse) {
                    const newCodeWithDocstring = parseAIResponse(aiResponse, originalCode);

                    if (newCodeWithDocstring) {
                        const firstLine = document.lineAt(symbolRange.start.line);
                        const indentationLevel = firstLine.firstNonWhitespaceCharacterIndex;
                        const indentation = ' '.repeat(indentationLevel);

                        const indentedNewCode = newCodeWithDocstring.split('\n').map((line, index) => {
                            if (index === 0 || line.trim() === '') {
                                return line;
                            }
                            return indentation + line;
                        }).join('\n');

                        await editor.edit(editBuilder => {
                            editBuilder.replace(symbolRange, indentedNewCode);
                        });

                        if (getConfig('autoSave', false)) {
                            await document.save();
                            vscode.window.showInformationMessage('Docstring generated and saved.');
                        } else {
                            vscode.window.showInformationMessage('Docstring generated.');
                        }
                    }
                }
            } catch (error) {
                console.error("Error during docstring generation process:", error);
                vscode.window.showErrorMessage(`An unexpected error occurred: ${error.message}`);
            }
        });
    });

    context.subscriptions.push(disposable);
}

function deactivate() {}

module.exports = {
    activate,
    deactivate
};
