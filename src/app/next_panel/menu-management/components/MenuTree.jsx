"use client";

import { useMemo, useState } from "react";
import { ChevronIcon } from "./Icon";
import styles from "../styles.module.css";

// Turns the flat list returned by /api/menu into a parent -> children tree.
function buildTree(menus) {
    const byId = new Map();
    menus.forEach((m) => byId.set(m.id, { ...m, children: [] }));

    const roots = [];
    byId.forEach((node) => {
        if (node.parent_id && byId.has(node.parent_id)) {
            byId.get(node.parent_id).children.push(node);
        } else {
            roots.push(node);
        }
    });

    const sortByOrder = (a, b) =>
        (a.menu_order ?? 0) - (b.menu_order ?? 0) || a.id - b.id;

    const sortRecursive = (nodes) => {
        nodes.sort(sortByOrder);
        nodes.forEach((n) => sortRecursive(n.children));
    };
    sortRecursive(roots);

    return roots;
}

// Returns the set of node ids that match the search term or have a
// descendant that matches, so ancestors of a match stay visible/expanded.
function matchIds(nodes, term) {
    const matched = new Set();

    const walk = (node) => {
        const haystack = `${node.menu_key} ${node.menu_name} ${node.menu_title} ${
            node.menu_url || ""
        }`.toLowerCase();

        let selfMatch = haystack.includes(term);
        let childMatch = false;

        node.children.forEach((child) => {
            if (walk(child)) childMatch = true;
        });

        if (selfMatch || childMatch) {
            matched.add(node.id);
        }
        return selfMatch || childMatch;
    };

    nodes.forEach(walk);
    return matched;
}

function TreeNode({ node, depth, activeId, onSelect, expanded, toggle, visibleIds }) {
    if (visibleIds && !visibleIds.has(node.id)) return null;

    const hasChildren = node.children.length > 0;
    const isOpen = expanded.has(node.id);

    return (
        <div>
            <div
                className={`${styles.treeNode} ${
                    activeId === node.id ? styles.treeNodeActive : ""
                }`}
                style={{ paddingLeft: 8 + depth * 16 }}
                onClick={() => onSelect(node.id)}
            >
                {hasChildren ? (
                    <span
                        className={styles.treeToggle}
                        onClick={(e) => {
                            e.stopPropagation();
                            toggle(node.id);
                        }}
                    >
                        <ChevronIcon open={isOpen} />
                    </span>
                ) : (
                    <span className={styles.treeToggleSpacer} />
                )}

                <span className={styles.treeLabel}>{node.menu_title || node.menu_name}</span>

                <span className={styles.treeBadges}>
                    <span
                        className={`${styles.dot} ${
                            node.is_active ? styles.dotActive : styles.dotInactive
                        }`}
                        title={node.is_active ? "Active" : "Inactive"}
                    />
                    <span className={styles.typeTag}>{node.menu_type}</span>
                </span>
            </div>

            {hasChildren && isOpen && (
                <div>
                    {node.children.map((child) => (
                        <TreeNode
                            key={child.id}
                            node={child}
                            depth={depth + 1}
                            activeId={activeId}
                            onSelect={onSelect}
                            expanded={expanded}
                            toggle={toggle}
                            visibleIds={visibleIds}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

export default function MenuTree({ menus, activeId, onSelect, searchTerm }) {
    const tree = useMemo(() => buildTree(menus), [menus]);
    const [expanded, setExpanded] = useState(() => new Set());

    const term = searchTerm.trim().toLowerCase();
    const visibleIds = term ? matchIds(tree, term) : null;

    // Auto-expand every ancestor chain while searching.
    const effectiveExpanded = term ? visibleIds : expanded;

    const toggle = (id) => {
        setExpanded((prev) => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    };

    if (menus.length === 0) {
        return <div className={styles.emptyTree}>No menus yet. Create the first one.</div>;
    }

    if (term && visibleIds.size === 0) {
        return <div className={styles.emptyTree}>No menus match &ldquo;{searchTerm}&rdquo;.</div>;
    }

    return (
        <div>
            {tree.map((node) => (
                <TreeNode
                    key={node.id}
                    node={node}
                    depth={0}
                    activeId={activeId}
                    onSelect={onSelect}
                    expanded={effectiveExpanded}
                    toggle={toggle}
                    visibleIds={visibleIds}
                />
            ))}
        </div>
    );
}
