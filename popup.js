// Get the current tab's URL and set it as the value of the first input field
chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  const currentTabUrl = tabs[0].url;
  document.getElementById('url1').value = currentTabUrl;
});

let filesList = [];
let selectedFiles = new Set();

// ===================================== //
// === moved here from background.js === //

const URL_PATTERNS = {
  github: {
    commit: /^https:\/\/([^/]+)\/([^/]+)\/([^/]+)\/commit\/([a-f0-9]+)(\/.*)?$/,
    prCommit: /^https:\/\/([^/]+)\/([^/]+)\/([^/]+)\/pull\/(\d+)\/commits\/([a-f0-9]+)(\/.*)?$/,
    pr: /^https:\/\/([^/]+)\/([^/]+)\/([^/]+)\/pull\/(\d+)(\/.*)?$/,
  },
  gitlab: {
    commit: /^https:\/\/([^/]+)\/([^/]+)\/([^/]+)\/-\/commit\/([a-f0-9]+)(\?.*)?$/,
    mrCommit: /^https:\/\/([^/]+)\/([^/]+)\/([^/]+)\/-\/merge_requests\/(\d+)\/diffs\?commit_id=([a-f0-9]+)$/,
    mr: /^https:\/\/([^/]+)\/([^/]+)\/([^/]+)\/-\/merge_requests\/(\d+)(\/.*)?$/,
  }
};

function extractGithubInfo(url) {
  // Try standalone commit pattern first
  const commitMatch = url.match(URL_PATTERNS.github.commit);
  if (commitMatch) {
    const [_, domain, owner, repo, commitHash] = commitMatch;
    return { type: 'github', domain, owner, repo, commitHash };
  }

  // Try PR commit pattern second
  const prCommitMatch = url.match(URL_PATTERNS.github.prCommit);
  if (prCommitMatch) {
    const [_, domain, owner, repo, prNumber, commitHash] = prCommitMatch;
    return { type: 'github', domain, owner, repo, prNumber, commitHash };
  }

  // Try PR pattern last
  const prMatch = url.match(URL_PATTERNS.github.pr);
  if (prMatch) {
    const [_, domain, owner, repo, prNumber] = prMatch;
    return { type: 'github', domain, owner, repo, prNumber };
  }

  return null;
}

function extractGitLabInfo(url) {
  // Try standalone commit pattern first
  const commitMatch = url.match(URL_PATTERNS.gitlab.commit);
  if (commitMatch) {
    const [_, domain, owner, repo, commitHash] = commitMatch;
    return { type: 'gitlab', domain, owner, repo, commitHash };
  }

  // Try MR commit pattern second
  const mrCommitMatch = url.match(URL_PATTERNS.gitlab.mrCommit);
  if (mrCommitMatch) {
    const [_, domain, owner, repo, mrNumber, commitHash] = mrCommitMatch;
    return { type: 'gitlab', domain, owner, repo, mrNumber, commitHash };
  }

  // Try MR pattern last
  const mrMatch = url.match(URL_PATTERNS.gitlab.mr);
  if (mrMatch) {
    const [_, domain, owner, repo, mrNumber] = mrMatch;
    return { type: 'gitlab', domain, owner, repo, mrNumber };
  }

  return null;
}

function extractPrInfo(url) {
  const githubInfo = extractGithubInfo(url);
  if (githubInfo) return githubInfo;

  const gitLabInfo = extractGitLabInfo(url);
  if (gitLabInfo) return gitLabInfo;

  throw new Error('Invalid PR or commit URL');
}

// ============= end copy ============== //
// ===================================== //

// Initialize file selector
const fileSelector = document.getElementById('fileSelector');
const filesContent = document.getElementById('filesContent');

fileSelector.addEventListener('click', () => {
  const isExpanded = filesContent.style.display === 'block';
  filesContent.style.display = isExpanded ? 'none' : 'block';
  fileSelector.classList.toggle('expanded', !isExpanded);

  if (!isExpanded && filesList.length === 0) {
    const url1 = document.getElementById('url1').value.trim();
    const url2 = document.getElementById('url2').value.trim();
    const filesContentElement = document.getElementById('files-content');
    const loadingIndicator = document.getElementById('files-loading-indicator');

    // Clear previous content
    filesContentElement.innerHTML = '';

    try {

    if (!url1 || !url2) {
      throw new Error('Please enter both PR URLs to view files for comparison.');
    }

    // Parse URLs first
    const info1 = extractPrInfo(url1);
    const info2 = extractPrInfo(url2);

    // Show loading indicator
    loadingIndicator.style.display = 'block';

    // Set a timeout to handle hanging requests
    const timeout = setTimeout(() => {
      loadingIndicator.style.display = 'none';
      filesContentElement.innerHTML = `
        <div style="padding: 12px; color: #86181d; background-color: #ffeef0; border-radius: 4px;">
          Request timed out. Please try again.
        </div>`;
    }, 30000); // 30 second timeout

    Promise.all([
      new Promise((resolve) => {
        chrome.runtime.sendMessage({ action: 'fetchFiles', url: url1, info: info1 }, resolve);
      }),
      new Promise((resolve) => {
        chrome.runtime.sendMessage({ action: 'fetchFiles', url: url2, info: info2 }, resolve);
      })
    ]).then(([response1, response2]) => {
      clearTimeout(timeout);
      loadingIndicator.style.display = 'none';

      if (response1.error || response2.error) {
        throw new Error(response1.error || response2.error);
      }

      // Merge and deduplicate files from both PRs
      const filesSet = new Set([
        ...(response1.files || []),
        ...(response2.files || [])
      ]);
      filesList = Array.from(filesSet).sort();
      renderFilesList();
    }).catch(error => {
      clearTimeout(timeout);
      loadingIndicator.style.display = 'none';
      filesContentElement.innerHTML = `
        <div style="padding: 12px; color: #86181d; background-color: #ffeef0; border-radius: 4px;">
          Error: ${error.message}
        </div>`;
    });

    } catch (error) {
      filesContentElement.innerHTML = `
        <div style="padding: 12px; color: #86181d; background-color: #ffeef0; border-radius: 4px;">
          ${error.message}
        </div>`;
    }
  }
});

function renderFilesList() {
  const filesContentElement = document.getElementById('files-content');
  const loadingIndicator = document.getElementById('files-loading-indicator');

  // Hide loading indicator
  loadingIndicator.style.display = 'none';

  if (filesList.length === 0) {
    filesContentElement.innerHTML = `
      <div style="padding: 12px; color: #24292e; background-color: #f6f8fa; border-radius: 4px;">
        No files found in either PR.
      </div>`;
    return;
  }

  filesContentElement.innerHTML = ''; // Clear existing content

  filesList.forEach(file => {
    const div = document.createElement('div');
    div.className = 'file-item';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.id = `file-${file}`;
    checkbox.checked = selectedFiles.has(file);
    checkbox.addEventListener('change', () => {
      if (checkbox.checked) {
        selectedFiles.add(file);
      } else {
        selectedFiles.delete(file);
      }
    });

    const label = document.createElement('label');
    label.htmlFor = `file-${file}`;
    label.textContent = file;

    div.appendChild(checkbox);
    div.appendChild(label);
    filesContentElement.appendChild(div);
  });
}

function resetFileSelection() {
  filesList = [];
  selectedFiles.clear();
  filesContent.style.display = 'none';
  fileSelector.classList.remove('expanded');

  // Clear the files content
  const filesContentElement = document.getElementById('files-content');
  if (filesContentElement) {
    filesContentElement.innerHTML = '';
  }
}

function clearCache() {
  chrome.runtime.sendMessage({ action: 'clearCache' });
}

const url1Input = document.getElementById('url1');
const url2Input = document.getElementById('url2');

// Add event listeners for URL input changes
url1Input.addEventListener('input', () => {
  resetFileSelection();
  clearCache();
});
url2Input.addEventListener('input', () => {
  resetFileSelection();
  clearCache();
});

function runComparison() {
  const url1 = document.getElementById('url1').value.trim();
  const url2 = document.getElementById('url2').value.trim();
  const ignoreContext = document.getElementById('ignoreContext').checked;
  const result = document.getElementById('result');
  const compareButton = document.getElementById('compare');

  // Disable button and show loading state
  compareButton.disabled = true;
  compareButton.textContent = 'Comparing...';

  result.textContent = 'Comparing...';
  result.classList.remove('error', 'success', 'failure');
  result.classList.add('loading');

  try {

  if (!url1 || !url2) {
    throw new Error('Please enter both URLs.');
  }

  const info1 = extractPrInfo(url1);
  const info2 = extractPrInfo(url2);

  chrome.runtime.sendMessage({
    action: 'compare',
    url1,
    url2,
    info1,
    info2,
    ignoreContext,
    selectedFiles: [...selectedFiles],
  }, (response) => {
    result.classList.remove('loading');
    // Re-enable button and restore text
    compareButton.disabled = false;
    compareButton.textContent = 'Compare';

    if (response.error) {
      result.textContent = `Error: ${response.error}`;
      result.classList.add('error');
    } else {
      if (response.same) {
        result.textContent = 'The diffs are identical!';
        result.classList.add('success');
      } else {
        result.textContent = 'The diffs are different!';
        result.classList.add('failure');
      }
    }
  });

  } catch (error) {
    result.classList.remove('loading');
    result.classList.add('error');
    result.textContent = `Error: ${error.message}`;
    compareButton.disabled = false;
    compareButton.textContent = 'Compare';
  }
}

// TODO: hoist all element retrieval to top of file
const compareButton = document.getElementById('compare');
compareButton.addEventListener('click', runComparison);

function handleEnterKey(event) {
  if (event.key === 'Enter') {
    runComparison();
  }
}

url1Input.addEventListener('keypress', handleEnterKey);
url2Input.addEventListener('keypress', handleEnterKey);

document.addEventListener('DOMContentLoaded', function() {
  const infoIcons = document.querySelectorAll('.info-icon-wrapper');

  infoIcons.forEach(icon => {
    icon.addEventListener('click', function(e) {
      // Find the closest tooltip
      const container = this.closest('.checkbox-header, .section-header');
      const tooltip = container.querySelector('.tooltip');

      // Toggle the tooltip
      tooltip.classList.toggle('show');

      // Hide tooltip when clicking anywhere else
      const hideTooltip = function(event) {
        if (!container.contains(event.target)) {
          tooltip.classList.remove('show');
          document.removeEventListener('click', hideTooltip);
        }
      };

      // Add the document click listener after a small delay
      setTimeout(() => {
        document.addEventListener('click', hideTooltip);
      }, 0);
    });
  });
});
