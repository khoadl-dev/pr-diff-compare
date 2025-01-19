let cachedDiffs = {};

// TODO: remove this
// ===================================== //
// === deprecated code to be removed === //

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

// ========== end deprecation ========== //
// ===================================== //

function constructDiffUrl(info) {
  if (info.type === 'github') {
    if (info.commitHash) {
      return `https://${info.domain}/${info.owner}/${info.repo}/commit/${info.commitHash}.diff`;
    }
    return `https://${info.domain}/${info.owner}/${info.repo}/pull/${info.prNumber}.diff`;
  } else if (info.type === 'gitlab') {
    if (info.commitHash) {
      return `https://${info.domain}/${info.owner}/${info.repo}/-/commit/${info.commitHash}.diff`;
    }
    return `https://${info.domain}/${info.owner}/${info.repo}/-/merge_requests/${info.mrNumber}.diff`;
  }
  throw new Error('Unknown repository type. Currently only GitHub and GitLab are supported.');
}

function parseDiff(diffText) {
  // doc: https://git-scm.com/docs/diff-format/2.9.5#_generating_patches_with_p
  const isMetadataLine = line =>
    line.startsWith('index ') ||
    line.startsWith('--- ') ||
    line.startsWith('+++ ') ||
    line.startsWith('@@ ') ||
    line.startsWith('old mode ') ||
    line.startsWith('new mode ') ||
    line.startsWith('deleted file mode ') ||
    line.startsWith('new file mode ') ||
    line.startsWith('copy from ') ||
    line.startsWith('copy to ') ||
    line.startsWith('rename from ') ||
    line.startsWith('rename to ') ||
    line.startsWith('similarity index ') ||
    line.startsWith('dissimilarity index ');

  const extractFilename = line => {
    const match = line.match(/diff --git a\/(.+) b\/.+/);
    return match ? match[1] : null;
  };

  const fileChunks = diffText.split('diff --git ').slice(1);

  return fileChunks.reduce((files, chunk) => {
    const lines = chunk.split('\n');
    const filename = extractFilename(`diff --git ${lines[0]}`);
    if (filename) {
      const content = lines.slice(1).filter(line => !isMetadataLine(line)).join('\n');
      files[filename] = content;
    }
    return files;
  }, {});
}

function compareDiffs(diff1Files, diff2Files, selectedFiles, ignoreContext) {
  // If no files are selected, compare all files
  if (!selectedFiles || selectedFiles.length === 0) {
    selectedFiles = [...new Set([...Object.keys(diff1Files), ...Object.keys(diff2Files)])];
  }

  for (const filename of selectedFiles) {
    const content1 = diff1Files[filename] || '';
    const content2 = diff2Files[filename] || '';

    if (ignoreContext) {
      const filtered1 = content1.split('\n')
        .filter(line => line.startsWith('+') || line.startsWith('-'))
        .join('\n');
      const filtered2 = content2.split('\n')
        .filter(line => line.startsWith('+') || line.startsWith('-'))
        .join('\n');

      if (filtered1 !== filtered2) return false;
    } else {
      if (content1 !== content2) return false;
    }
  }

  return true;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'fetchFiles') {
    const { url, info } = message;
    try {
      // Check if we already have the diff cached
      if (cachedDiffs[url]) {
        sendResponse({ files: Object.keys(cachedDiffs[url]) });
        return;
      }

      const diffUrl = constructDiffUrl(info);

      fetch(diffUrl, { credentials: 'include' })
        .then(response => {
          if (!response.ok) {
            throw new Error(`Request to ${response.url} failed with status ${response.status}`);
          }
          return response.text();
        })
        .then(diff => {
          const files = parseDiff(diff);
          // Cache the parsed diff
          cachedDiffs[url] = files;
          sendResponse({ files: Object.keys(files) });
        })
        .catch(error => sendResponse({ error: error.message }));

      return true;
    } catch (error) {
      sendResponse({ error: error.message });
    }
  }
  else if (message.action === 'compare') {
    try {
      const { url1, url2, info1, info2, ignoreContext, selectedFiles } = message;

      // Check if we have both diffs cached
      if (cachedDiffs[url1] && cachedDiffs[url2]) {
        const result = compareDiffs(cachedDiffs[url1], cachedDiffs[url2], selectedFiles, ignoreContext);
        sendResponse({ same: result });
        return;
      }

      const diffUrl1 = constructDiffUrl(info1);
      const diffUrl2 = constructDiffUrl(info2);

      Promise.all([
        // Only fetch if not cached
        cachedDiffs[url1] ?
          Promise.resolve(cachedDiffs[url1]) :
          fetch(diffUrl1, { credentials: 'include' })
            .then(response => {
              if (!response.ok) {
                throw new Error(`Request to ${response.url} failed with status ${response.status}`);
              }
              return response.text();
            })
            .then(diff => parseDiff(diff)),
        // Only fetch if not cached
        cachedDiffs[url2] ?
          Promise.resolve(cachedDiffs[url2]) :
          fetch(diffUrl2, { credentials: 'include' })
            .then(response => {
              if (!response.ok) {
                throw new Error(`Request to ${response.url} failed with status ${response.status}`);
              }
              return response.text();
            })
            .then(diff => parseDiff(diff))
      ]).then(([diff1Files, diff2Files]) => {
        // Cache the diffs if they weren't cached before
        if (!cachedDiffs[url1]) cachedDiffs[url1] = diff1Files;
        if (!cachedDiffs[url2]) cachedDiffs[url2] = diff2Files;

        const result = compareDiffs(diff1Files, diff2Files, selectedFiles, ignoreContext);
        sendResponse({ same: result });
      }).catch(error => {
        sendResponse({ error: error.message });
      });

      return true;
    } catch (error) {
      sendResponse({ error: error.message });
    }
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'clearCache') {
    cachedDiffs = {};
    sendResponse({ success: true });
  }
});
