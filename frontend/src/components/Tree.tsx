export type TreeNode = { label: string; sub?: string; children?: TreeNode[] };

function Node({ node }: { node: TreeNode }) {
  return (
    <li className="flex flex-col items-center">
      <div className="card min-w-40 px-4 py-2.5 text-center">
        <p className="text-sm font-semibold">{node.label}</p>
        {node.sub && <p className="text-xs text-muted">{node.sub}</p>}
      </div>
      {node.children && node.children.length > 0 && (
        <>
          <span className="h-5 w-px bg-line" />
          <ul className="flex gap-6 border-t border-line pt-5">
            {node.children.map((c, i) => (
              <Node key={i} node={c} />
            ))}
          </ul>
        </>
      )}
    </li>
  );
}

export function Tree({ root }: { root: TreeNode }) {
  return (
    <div className="overflow-x-auto py-6">
      <ul className="flex justify-center">
        <Node node={root} />
      </ul>
    </div>
  );
}
