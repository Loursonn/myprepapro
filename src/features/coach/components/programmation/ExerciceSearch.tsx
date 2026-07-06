import { useState, useEffect, useRef } from "react"
import { C } from "@/lib/theme"
import { supabase } from "@/integrations/supabase/client"
import { toast } from "sonner"
import { Search, Plus } from "lucide-react"

const VIOLET = "#7B6FFF"

interface ExerciceSearchProps {
  value: string
  onSelect: (exercise: { id: string; name: string; ex_type?: string; youtube_id?: string }) => void
  onClose: () => void
}

interface ExerciseRow {
  id: string
  name: string
  ex_type?: string | null
  youtube_id?: string | null
}

const TYPE_COLOR: Record<string, string> = {
  muscu: VIOLET,
  halterophilie: "#8b5cf6",
  plio: "#F5A623",
  mobilite: C.g,
}

function typeColor(ex_type: string | null | undefined): string {
  return TYPE_COLOR[ex_type ?? ""] ?? C.tx3
}

export function ExerciceSearch({ value, onSelect, onClose }: ExerciceSearchProps) {
  const [search, setSearch] = useState(value)
  const [results, setResults] = useState<ExerciseRow[]>([])
  const [loading, setLoading] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout>>()
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    clearTimeout(timerRef.current)
    if (!search.trim()) {
      setResults([])
      return
    }
    timerRef.current = setTimeout(async () => {
      setLoading(true)
      const { data } = await supabase
        .from('exercises')
        .select('id, name, ex_type, youtube_id')
        .ilike('name', `%${search.trim()}%`)
        .limit(10)
      setResults((data ?? []) as ExerciseRow[])
      setLoading(false)
    }, 300)
    return () => clearTimeout(timerRef.current)
  }, [search])

  async function handleCreate() {
    const name = search.trim()
    if (!name) return
    try {
      const { data, error } = await supabase
        .from('exercises')
        .insert({ name, is_verified: false })
        .select('id, name, ex_type, youtube_id')
        .single()
      if (error) throw error
      toast.success(`Exercice "${name}" créé`)
      onSelect({ id: data.id, name: data.name, ex_type: data.ex_type ?? undefined, youtube_id: data.youtube_id ?? undefined })
    } catch {
      toast.error("Erreur lors de la création de l'exercice")
    }
  }

  const showCreate = search.trim() && !results.some(r => r.name.toLowerCase() === search.trim().toLowerCase())

  return (
    <div style={{ position: "relative" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", borderRadius: 8, border: "1px solid " + C.brdL, background: C.s2 }}>
        <Search size={13} color={C.tx3} />
        <input
          ref={inputRef}
          value={search}
          onChange={e => setSearch(e.target.value)}
          onKeyDown={e => { if (e.key === 'Escape') onClose() }}
          placeholder="Rechercher un exercice…"
          style={{
            flex: 1, background: "transparent", border: "none",
            color: C.tx, fontSize: 13, fontFamily: "inherit", outline: "none",
          }}
        />
        {loading && (
          <div style={{ width: 12, height: 12, borderRadius: "50%", border: "2px solid " + VIOLET, borderTopColor: "transparent", animation: "spin 0.6s linear infinite" }} />
        )}
      </div>

      {(results.length > 0 || showCreate) && (
        <div style={{
          position: "absolute", top: "100%", left: 0, right: 0, zIndex: 100,
          background: C.s1, border: "1px solid " + C.brdL, borderRadius: 10,
          marginTop: 4, maxHeight: 240, overflowY: "auto", boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
        }}>
          {results.map(ex => (
            <button
              key={ex.id}
              onClick={() => onSelect({ id: ex.id, name: ex.name, ex_type: ex.ex_type ?? undefined, youtube_id: ex.youtube_id ?? undefined })}
              style={{
                width: "100%", display: "flex", alignItems: "center", gap: 8,
                padding: "8px 12px", border: "none", borderBottom: "1px solid " + C.brd,
                background: "transparent", cursor: "pointer", fontFamily: "inherit", textAlign: "left",
              }}
              onMouseEnter={e => (e.currentTarget.style.background = C.s2)}
              onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
            >
              {ex.ex_type && (
                <span style={{
                  fontSize: 9, fontWeight: 700, padding: "1px 5px", borderRadius: 3,
                  background: typeColor(ex.ex_type) + "20", color: typeColor(ex.ex_type),
                  flexShrink: 0,
                }}>{ex.ex_type}</span>
              )}
              <span style={{ fontSize: 13, color: C.tx }}>{ex.name}</span>
            </button>
          ))}
          {showCreate && (
            <button
              onClick={handleCreate}
              style={{
                width: "100%", display: "flex", alignItems: "center", gap: 8,
                padding: "8px 12px", border: "none", background: "transparent",
                cursor: "pointer", fontFamily: "inherit", textAlign: "left",
              }}
              onMouseEnter={e => (e.currentTarget.style.background = C.s2)}
              onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
            >
              <Plus size={13} color={VIOLET} />
              <span style={{ fontSize: 13, color: VIOLET, fontWeight: 600 }}>
                Créer "{search.trim()}"
              </span>
            </button>
          )}
        </div>
      )}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
