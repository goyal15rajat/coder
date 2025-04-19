coderAI
==================

`coderAI` is a Visual Studio Code extension designed to simplify the process of writing docstrings for python in the desired format for various programming languages. This tool leverages customizable prompts to ensure the generated docstrings meet your coding standards and project requirements.


Features
--------

-   **Generate Docstrings**: Automatically generate docstrings in your preferred format tailored to the programming language you're working with.

-   **Customizable Prompts**: Define custom prompts per language to guide the docstring generation process.

-   **Keyboard Shortcut**: Trigger docstring generation quickly with a single command (`cmd+h` on macOS or `ctrl+h` on Windows/Linux).

-   **AI Integration**: Leverages an AI engine for intelligent docstring generation using API configuration settings.


### Demo

```
def divide(a, b):
    """Divides two numbers.

    Args:
        a (float): The numerator.
        b (float): The denominator.

    Returns:
        float: The result of dividing a by b.

    Raises:
        ValueError: If b is zero, as division by zero is not allowed.
    """
    if b == 0:
        raise ValueError("Cannot divide by zero")
    return a / b
```

### Coming soon

 - Support for javascript

### Example

Write consistent, professional docstrings effortlessly:

```
# Input
 def add(a, b):
     return a + b

# Output (using Python-specific prompt)
"""
Adds two numbers.

Args:
    a (int): The first number.
    b (int): The second number.

Returns:
    int: The sum of the two numbers.
"""
```

* * * * *

Requirements
------------

This extension depends on:

1.  **AI Engine**: Ensure you have an AI service running and accessible via the configured URI and authentication settings.
2. **Language server**: Python https://marketplace.visualstudio.com/items?itemName=ms-python.python

* * * * *

Extension Settings
------------------

This extension contributes the following settings:

-   `**coder.aiEngineURI**` (default: `http://127.0.0.1:11434`): Specify the URI of the AI engine API.

-   `**coder.aiEngineAuthKey**` (default: `api-key`): Set the API header key for authentication.

-   `**coder.aiEngineAuthValue**` (default: `value`): Set the API header value for authentication.

-   `**coder.langPrompts**`:

    -   Define custom prompts for each language. Example:

        ```
        [
            {
                "language": "python",
                "prompt": "Add two numbers and return the result.\n\nArgs:\na (int or float): The first number to add.\nb (int or float): The second number to add.\n\nReturns:\nint or float: The sum of a and b.\n\nRaises:\nValueError: If `a` or `b` is not a number.\n\nExample:\n>>> add_numbers(3, 5)\n8\n>>> add_numbers(2.5, 4.5)\n7.0\n\n\nRules:\n1. Add Args, Returns, Raises if present in function else do not add\n2. Add Example if exmple is possible as per response else only add heading."
            }
        ]
        ```

-   `**coder.autoSave**` (default: `false`): Controls if extension will autosave changes or not.

-   `**coder.aiEngine**` : Controls which AIENgine is being used.

-   `**coder.engineDetails**`:

    -   Define AIEngine details. Example:

        ```
        {
            "OpenAI": {
                "url": "https://api.openai.com/v1/chat/completions",
                "key": "sk-key",
                "model": "gpt-4o-mini"
            },
            "Gemini": {
                "url": "https://generativelanguage.googleapis.com/v1beta/models",
                "key": "key",
                "model": "gemini-1.5-flash"
            }
        }
        ```

* * * * *

Commands
--------

-   **Command**: `coder.writeDocstring`

    -   **Title**: "CODER: Write docstring"

    -   **Trigger**: Generates a docstring based on the current cursor position and file language.

* * * * *

Keybindings
-----------

-   **Default Keybinding**: `cmd+h` (macOS) or `ctrl+h` (Windows/Linux)

-   **When**: `editorTextFocus`

* * * * *

Known Issues
------------

-   Some edge cases in language-specific prompts may result in incomplete docstrings.

-   Requires active configuration of the AI engine for optimal performance.

* * * * *

Release Notes
-------------

### 2.1.0

-   Initial release of `coderAI`.

-   Features include customizable docstring generation, AI integration, and support for Python.

### 2.3.0

-   Add support for AzureOpenAI

### 2.4.0

-   Bug fixes


**Enjoy generating professional docstrings with ease!**