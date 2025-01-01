# PR Diff Compare

This is a Chrome extension for comparing 2 PR (Pull Request/Merge Request) diffs.
A Firefox extension may come later :)

## Why?

This extension can help you compare the diffs of 2 PRs, especially when one is a cherry-pick version of the other. No more silly cherry-pick/merge/rebase mistakes!

## How it works

The tool aims to provide basic [git range-diff](https://git-scm.com/docs/git-range-diff) functionality for Github PRs and Gitlab MRs.
Some good explanations of the Git command can be found in this question [Can somebody explain the usage of git range-diff?](https://stackoverflow.com/a/61219652/14725572)

For now, the tool only outputs whether the diffs are the same or not. It does not show the detailed differences.

## Installation

This extension is not available on the Chrome Web Store, so you need to install it manually.

1. Download the latest release from this repo
2. Go to `chrome://extensions/`
3. Enable "Developer mode"
4. Click "Load unpacked" at the top left corner
5. Find and select the downloaded extension folder

## Usage

1. Open 2 PRs in 2 tabs
2. Copy one of the PR URLs
3. Go to the other PR tab
4. Click the extension icon or use the specified keyboard shortcut to open the popup
5. Paste the URL of the PR you copied in the second input box (the first input box is automatically filled with the current tab's URL)
6. Uncheck the "Ignore diff code context" if you don't want the surrounding (unchanged) code to affect the comparison
7. Click the file dropdown to select the file(s) you want to compare if needed
8. Click "Compare"

**Notes:**

* A PR URL must be in one of the following formats:
  * For Github: `https://github.com/<owner>/<repo>/pull/<pr-number>/<optional-extra-path>`
  * For Gitlab: `https://gitlab.com/<owner>/<repo>/-/merge_requests/<pr-number>/<optional-extra-path>`
* Example URLs:
  * PR 1: `https://github.com/owner/repo/pull/1`
  * PR 2: `https://github.com/owner/repo/pull/2/files`

**Screenshots:**

* ![docs/demo-gh-basic-different.png](docs/demo-gh-basic-different.png)

* ![docs/demo-gh-ignore-context-different.png](docs/demo-gh-ignore-context-different.png)

* ![docs/demo-gh-ignore-context-same.png](docs/demo-gh-ignore-context-same.png)

* ![docs/demo-gh-select-files-same.png](docs/demo-gh-select-files-same.png)

* ![docs/demo-gl-select-files-ignore-diff-same.png](docs/demo-gl-select-files-ignore-diff-same.png)

## Data privacy

This extension runs locally and does not collect any of your data.

## TODOs

* [ ] Keyboard triggered comparison -- run the comparison when "Enter" is hit on one of the input boxes
* [x] Option to run the comparison on specific file(s)
* [ ] Option to run the comparison on specific commit(s)
* [ ] [v2] Showing diff details -- this may require a diff parser

## Acknowledgements

* This tool is built mainly by Claude 3.5 Sonnet and GPT-4o.
* The extension's favicon is a modified version of the one provided by [Lucide](https://lucide.dev/icons/git-compare-arrows).
