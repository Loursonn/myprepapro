import { C } from "@/lib/theme"

interface ParamSeriesGridProps<T> {
  nb_series: number
  values: T[]
  onChange: (values: T[]) => void
  renderCell: (value: T, idx: number, onChange: (v: T) => void) => React.ReactNode
  label?: string
}

export function ParamSeriesGrid<T>({ nb_series, values, onChange, renderCell, label }: ParamSeriesGridProps<T>) {
  function handleCellChange(idx: number, v: T) {
    const next = [...values]
    next[idx] = v
    onChange(next)
  }

  return (
    <div>
      {label && (
        <div style={{ fontSize: 11, color: C.tx3, marginBottom: 6, fontWeight: 600 }}>{label}</div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${nb_series}, 1fr)`, gap: 6 }}>
        {Array.from({ length: nb_series }).map((_, i) => (
          <div key={i}>
            <div style={{ fontSize: 10, color: C.tx3, textAlign: "center", marginBottom: 4, fontWeight: 700 }}>
              S{i + 1}
            </div>
            {renderCell(values[i], i, (v) => handleCellChange(i, v))}
          </div>
        ))}
      </div>
    </div>
  )
}
