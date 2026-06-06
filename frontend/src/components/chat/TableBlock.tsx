interface MessageContent {
  type: string
  table?: {
    headers: string[]
    rows: string[][]
  }
}

interface TableBlockProps {
  content: MessageContent
}

export function TableBlock({ content }: TableBlockProps) {
  const table = content.table

  if (!table || !table.headers || !table.rows) {
    return null
  }

  return (
    <div className="my-3 overflow-x-auto">
      <table className="w-full border-collapse border border-gray-300 rounded-lg overflow-hidden">
        <thead>
          <tr className="bg-gray-100">
            {table.headers.map((header, index) => (
              <th
                key={index}
                className="px-4 py-2 text-left text-xs font-semibold text-gray-700 uppercase border-b border-gray-300"
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row, rowIndex) => (
            <tr
              key={rowIndex}
              className="hover:bg-gray-50 transition-colors"
            >
              {row.map((cell, cellIndex) => (
                <td
                  key={cellIndex}
                  className="px-4 py-2 text-sm text-gray-700 border-b border-gray-200"
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
