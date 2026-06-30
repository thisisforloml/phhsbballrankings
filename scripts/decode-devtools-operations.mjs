/**
 * Decode React DevTools operations batches into component names (read-only tree).
 */
export function decodeOperationsBatch(ops) {
  if (!ops?.length) return { strings: [], nodes: [], supportsProfiling: null };

  const rendererID = ops[0];
  const rootID = ops[1];
  const stringTableLength = ops[2];
  let i = 3;
  const strings = [];

  for (let s = 0; s < stringTableLength; s++) {
    const len = ops[i++];
    const chars = ops.slice(i, i + len);
    i += len;
    strings.push(String.fromCharCode(...chars));
  }

  const nodes = [];
  let supportsProfiling = null;

  while (i < ops.length) {
    const op = ops[i++];
    if (op === 1) {
      // TREE_OPERATION_ADD
      const id = ops[i++];
      const type = ops[i++];
      const parentID = ops[i++];
      const ownerID = ops[i++];
      const displayName = strings[type] ?? `type#${type}`;
      nodes.push({ op: "ADD", id, displayName, parentID, ownerID });
    } else if (op === 2) {
      const removeLen = ops[i++];
      const ids = ops.slice(i, i + removeLen);
      i += removeLen;
      nodes.push({ op: "REMOVE", ids });
    } else if (op === 4) {
      // TREE_OPERATION_REORDER_CHILDREN
      const id = ops[i++];
      const numChildren = ops[i++];
      const children = ops.slice(i, i + numChildren);
      i += numChildren;
      nodes.push({ op: "REORDER", id, children });
    } else if (op === 5) {
      // TREE_OPERATION_UPDATE_TREE_BASE_DURATION
      const id = ops[i++];
      const duration = ops[i++];
      nodes.push({ op: "UPDATE_DURATION", id, duration });
    } else if (op === 6) {
      // TREE_OPERATION_UPDATE_ERRORS_OR_WARNINGS
      i += 3;
    } else if (op === 10) {
      // TREE_OPERATION_SET_SUBTREE_MODE
      i += 2;
    } else {
      break;
    }
  }

  return { rendererID, rootID, strings, nodes, supportsProfiling };
}

export function summarizeOperationsBatches(batches) {
  const allNodes = [];
  const names = new Map();
  for (const batch of batches) {
    const decoded = decodeOperationsBatch(batch);
    for (const n of decoded.nodes) {
      if (n.displayName) names.set(n.id, n.displayName);
      if (n.op === "UPDATE_DURATION" && n.duration > 0) {
        allNodes.push({ id: n.id, name: names.get(n.id) ?? `fiber#${n.id}`, duration: n.duration });
      }
    }
    for (const n of decoded.nodes) {
      if (n.op === "ADD") allNodes.push({ id: n.id, name: n.displayName, duration: 0 });
    }
  }
  const ranked = [...allNodes]
    .filter((n) => n.duration > 0)
    .sort((a, b) => b.duration - a.duration);
  const uniqueNames = [...new Set([...names.values()])].sort();
  return { ranked, uniqueNames, componentCount: names.size };
}
